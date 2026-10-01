package storyteller

import (
	"cmp"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	notifyService "faryne.dev/service/storytellernotify"
	"go.uber.org/zap"
)

const (
	// publishScanLimit 是每輪最多處理幾話；正常 5 分鐘內不會超過，超過的留給下一輪。
	publishScanLimit = 2000
	// publishPayloadStoryLimit 是一則通知快照最多列幾話，其餘只記總數（前端顯示「以及其他 N 話」）。
	publishPayloadStoryLimit = 50
)

type publishScanRepository interface {
	NotificationPublishCandidates(limit int) ([]storytellerModel.NotificationPublishCandidate, error)
	ProjectHasPublishedStory(projectID uint64) (bool, error)
	ProjectByID(id uint64) (*storytellerModel.Project, error)
	StoryProfilesByStoryIDs(storyIDs []uint64) (map[uint64][]uint64, error)
	UserProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.UserProfile, error)
	AuthorProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.AuthorProfile, error)
	NotificationRecipients(projectID, authorUserID uint64, profileIDs []uint64) ([]uint64, error)
	ClaimPublishedStories(storyIDs []uint64, rows []*storytellerModel.Notification) (bool, error)
}

type publishScanStats struct {
	Projects      int
	Stories       int
	Notifications int
}

// RunNotificationPublishScan 每 5 分鐘找出「現在對讀者可見、但還沒通知過」的話，依專案聚合後
// 派送給追蹤者與收藏者。不在每個寫入點 hook：新建、改狀態、冊完成、搬冊、專案轉公開、
// MCP／單機 publish 都會讓話變可見，集中在這裡掃描才不會漏。
func RunNotificationPublishScan() {
	startedAt := time.Now()
	stats, err := scanPublishedStories(NewService().repo)
	emitStorytellerCronAudit("system.notification.fanout", startedAt, storytellerModel.AuditSummary{
		"projects": stats.Projects, "stories": stats.Stories, "notifications": stats.Notifications,
	}, err)
	if err != nil {
		log.Logger().Error("Storyteller notification publish scan failed", zap.Error(err))
	}
}

func scanPublishedStories(repo publishScanRepository) (publishScanStats, error) {
	var stats publishScanStats
	candidates, err := repo.NotificationPublishCandidates(publishScanLimit)
	if err != nil {
		return stats, err
	}
	// 候選已依 project_id 排序，切成每個專案一批；單一專案失敗不影響其他專案
	var errs []error
	for start := 0; start < len(candidates); {
		end := start
		for end < len(candidates) && candidates[end].ProjectID == candidates[start].ProjectID {
			end++
		}
		sent, claimed, err := publishProjectBatch(repo, candidates[start:end])
		if err != nil {
			errs = append(errs, err)
		} else if claimed {
			stats.Projects++
			stats.Stories += end - start
			stats.Notifications += sent
		}
		start = end
	}
	return stats, errors.Join(errs...)
}

// publishProjectBatch 處理同一個專案這一輪新公開的話；先前沒有任何話公開過的就是「新作品公開」。
func publishProjectBatch(repo publishScanRepository, batch []storytellerModel.NotificationPublishCandidate) (int, bool, error) {
	first := batch[0]
	project, err := repo.ProjectByID(first.ProjectID)
	if err != nil {
		return 0, false, err
	}
	published, err := repo.ProjectHasPublishedStory(project.ID)
	if err != nil {
		return 0, false, err
	}
	storyIDs := make([]uint64, 0, len(batch))
	for _, c := range batch {
		storyIDs = append(storyIDs, c.ID)
	}
	profileIDs, authors, err := batchIdentities(repo, project.UserID, storyIDs)
	if err != nil {
		return 0, false, err
	}
	recipients, err := repo.NotificationRecipients(project.ID, project.UserID, profileIDs)
	if err != nil {
		return 0, false, err
	}

	payload := storytellerModel.NotificationPayload{
		ProjectPublicID: project.PublicID, ProjectSlug: project.Slug, ProjectName: project.Name, Rating: project.Rating,
		Authors: authors, StoryTotal: len(batch),
	}
	for i, c := range batch {
		if i < publishPayloadStoryLimit {
			payload.Stories = append(payload.Stories, storytellerModel.NotificationStory{
				PublicID: c.PublicID, Title: c.Title, WordCount: c.WordCount, VolumeTitle: c.VolumeTitle,
			})
		}
		payload.WordTotal += c.WordCount
	}
	kind, groupKey := storytellerModel.NotificationKindStoryPublished, "story.published:"+project.PublicID+":"+first.PublicID
	payload.Title, payload.Body = publishStoryText(payload)
	if !published {
		kind, groupKey = storytellerModel.NotificationKindProjectPublished, "project.published:"+project.PublicID
		payload.Description, payload.Tags = project.Description, decodeProjectTags(project.Tags)
		payload.Title, payload.Body = publishProjectText(payload)
	}

	inputs := make([]notifyService.Input, 0, len(recipients))
	seen := map[uint64]struct{}{project.UserID: {}} // 作者自己不收通知；同時追蹤又收藏的只收一則
	for _, userID := range recipients {
		if _, dup := seen[userID]; dup {
			continue
		}
		seen[userID] = struct{}{}
		inputs = append(inputs, notifyService.Input{UserID: userID, Kind: kind, GroupKey: groupKey, ProjectID: &project.ID, Payload: payload})
	}
	rows, err := notifyService.NewRows(inputs)
	if err != nil {
		return 0, false, err
	}
	claimed, err := repo.ClaimPublishedStories(storyIDs, rows)
	return len(rows), claimed, err
}

// publishAuthorText 是通知文字摘要裡的署名；筆名都解析不到時（不該發生）退回「作者」。
func publishAuthorText(payload storytellerModel.NotificationPayload) string {
	if len(payload.Authors) == 0 {
		return "作者"
	}
	return strings.Join(payload.Authors, "、")
}

// publishStoryText 產生新話通知的純文字摘要：列前 3 話標題，其餘只寫總數。
func publishStoryText(payload storytellerModel.NotificationPayload) (string, string) {
	title := fmt.Sprintf("%s 的《%s》更新了", publishAuthorText(payload), payload.ProjectName)
	if payload.StoryTotal > 1 {
		title += fmt.Sprintf(" %d 話", payload.StoryTotal)
	}
	names := make([]string, 0, 3)
	for _, story := range payload.Stories[:min(3, len(payload.Stories))] {
		if story.VolumeTitle != "" {
			story.Title = story.VolumeTitle + "・" + story.Title
		}
		names = append(names, story.Title)
	}
	body := strings.Join(names, "、")
	if payload.StoryTotal > len(names) {
		body += fmt.Sprintf(" 等 %d 話", payload.StoryTotal)
	}
	return title, body
}

// publishProjectText 產生新作品通知的純文字摘要：有簡介用簡介，沒有就寫話數與字數。
func publishProjectText(payload storytellerModel.NotificationPayload) (string, string) {
	title := fmt.Sprintf("%s 發表了新作品《%s》", publishAuthorText(payload), payload.ProjectName)
	return title, cmp.Or(strings.TrimSpace(payload.Description), fmt.Sprintf("目前 %d 話，約 %d 字", payload.StoryTotal, payload.WordTotal))
}

// batchIdentities 回傳這批話的署名身份（沒有 pivot 列＝帳號本人 profile 0）與對應筆名，依出現順序。
func batchIdentities(repo publishScanRepository, ownerID uint64, storyIDs []uint64) ([]uint64, []string, error) {
	profileMap, err := repo.StoryProfilesByStoryIDs(storyIDs)
	if err != nil {
		return nil, nil, err
	}
	profileIDs := make([]uint64, 0)
	for _, id := range storyIDs {
		ids := profileMap[id]
		if len(ids) == 0 {
			ids = []uint64{0}
		}
		for _, profileID := range ids {
			if !slices.Contains(profileIDs, profileID) {
				profileIDs = append(profileIDs, profileID)
			}
		}
	}
	users, err := repo.UserProfilesByIDs([]uint64{ownerID})
	if err != nil {
		return nil, nil, err
	}
	extras, err := repo.AuthorProfilesByIDs(slices.DeleteFunc(slices.Clone(profileIDs), func(id uint64) bool { return id == 0 }))
	if err != nil {
		return nil, nil, err
	}
	authors := make([]string, 0, len(profileIDs))
	for _, profileID := range profileIDs {
		if name := identityOutputFromMaps(ownerID, profileID, users, extras).PenName; name != "" && !slices.Contains(authors, name) {
			authors = append(authors, name)
		}
	}
	return profileIDs, authors, nil
}
