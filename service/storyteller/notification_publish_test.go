package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

type fakePublishScanRepo struct {
	candidates  []storytellerModel.NotificationPublishCandidate
	published   map[uint64]bool
	projects    map[uint64]*storytellerModel.Project
	profiles    map[uint64][]uint64
	followers   []uint64
	conflict    bool
	claimed     [][]uint64
	notified    []*storytellerModel.Notification
	gotProfiles []uint64
}

func (f *fakePublishScanRepo) NotificationPublishCandidates(int) ([]storytellerModel.NotificationPublishCandidate, error) {
	return f.candidates, nil
}
func (f *fakePublishScanRepo) ProjectHasPublishedStory(id uint64) (bool, error) {
	return f.published[id], nil
}
func (f *fakePublishScanRepo) ProjectByID(id uint64) (*storytellerModel.Project, error) {
	return f.projects[id], nil
}
func (f *fakePublishScanRepo) StoryProfilesByStoryIDs([]uint64) (map[uint64][]uint64, error) {
	return f.profiles, nil
}
func (f *fakePublishScanRepo) UserProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.UserProfile, error) {
	return map[uint64]storytellerModel.UserProfile{ids[0]: {UserID: ids[0], PenName: "本名"}}, nil
}
func (f *fakePublishScanRepo) AuthorProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.AuthorProfile, error) {
	out := map[uint64]storytellerModel.AuthorProfile{}
	for _, id := range ids {
		out[id] = storytellerModel.AuthorProfile{ID: id, PenName: "鴉羽"}
	}
	return out, nil
}
func (f *fakePublishScanRepo) NotificationRecipients(_, _ uint64, profileIDs []uint64) ([]uint64, error) {
	f.gotProfiles = profileIDs
	return f.followers, nil
}
func (f *fakePublishScanRepo) ClaimPublishedStories(ids []uint64, rows []*storytellerModel.Notification) (bool, error) {
	if f.conflict {
		return false, nil
	}
	f.claimed = append(f.claimed, ids)
	f.notified = append(f.notified, rows...)
	return true, nil
}

func candidate(id, projectID uint64, publicID string) storytellerModel.NotificationPublishCandidate {
	return storytellerModel.NotificationPublishCandidate{ID: id, ProjectID: projectID, PublicID: publicID, Title: publicID, WordCount: 100}
}

func newPublishRepo() *fakePublishScanRepo {
	return &fakePublishScanRepo{
		published: map[uint64]bool{10: true},
		projects: map[uint64]*storytellerModel.Project{
			10: {ID: 10, PublicID: "p10", UserID: 7, Name: "霧都旅館"},
			20: {ID: 20, PublicID: "p20", UserID: 7, Name: "夜蛾的信箋", Tags: `["奇幻"]`},
		},
		// 第 2 話署名 profile 3，其他沒有 pivot 列＝帳號本人
		profiles: map[uint64][]uint64{2: {3}},
		// 作者自己（7）與重複的讀者（5）都要被濾掉
		followers: []uint64{5, 7, 5, 6},
	}
}

func TestPublishScanAggregatesPerProject(t *testing.T) {
	repo := newPublishRepo()
	repo.candidates = []storytellerModel.NotificationPublishCandidate{candidate(1, 10, "s1"), candidate(2, 10, "s2"), candidate(3, 20, "s3")}
	stats, err := scanPublishedStories(repo)
	require.NoError(t, err)
	require.Equal(t, publishScanStats{Projects: 2, Stories: 3, Notifications: 4}, stats)
	require.Equal(t, [][]uint64{{1, 2}, {3}}, repo.claimed)

	// 專案 10 先前已有話公開 → 新話通知，一批只發一則、group_key 以第一話為準
	update := repo.notified[0]
	require.Equal(t, storytellerModel.NotificationKindStoryPublished, update.Kind)
	require.Equal(t, "story.published:p10:s1", update.GroupKey)
	require.Equal(t, 2, update.Payload.StoryTotal)
	require.Equal(t, []string{"本名", "鴉羽"}, update.Payload.Authors)
	require.ElementsMatch(t, []uint64{5, 6}, []uint64{repo.notified[0].UserID, repo.notified[1].UserID})

	// 專案 20 第一次有話公開 → 新作品通知，帶簡介與 tags
	debut := repo.notified[2]
	require.Equal(t, storytellerModel.NotificationKindProjectPublished, debut.Kind)
	require.Equal(t, "project.published:p20", debut.GroupKey)
	require.Equal(t, []string{"奇幻"}, debut.Payload.Tags)
	require.Equal(t, []uint64{0}, repo.gotProfiles)
}

func TestPublishScanCapsPayloadStories(t *testing.T) {
	repo := newPublishRepo()
	for i := range publishPayloadStoryLimit + 5 {
		repo.candidates = append(repo.candidates, candidate(uint64(100+i), 10, "s"))
	}
	_, err := scanPublishedStories(repo)
	require.NoError(t, err)
	require.Len(t, repo.notified[0].Payload.Stories, publishPayloadStoryLimit)
	require.Equal(t, publishPayloadStoryLimit+5, repo.notified[0].Payload.StoryTotal)
	require.Equal(t, uint((publishPayloadStoryLimit+5)*100), repo.notified[0].Payload.WordTotal)
}

func TestPublishScanSkipsBatchClaimedElsewhere(t *testing.T) {
	repo := newPublishRepo()
	repo.conflict = true
	repo.candidates = []storytellerModel.NotificationPublishCandidate{candidate(1, 10, "s1")}
	stats, err := scanPublishedStories(repo)
	require.NoError(t, err)
	require.Equal(t, publishScanStats{}, stats)
}
