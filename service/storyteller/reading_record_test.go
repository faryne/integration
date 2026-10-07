package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

// fakeReadingRepo 模擬 DB 的 upsert 語意（取最大值），讓測試能驗證 service 的過濾與整理邏輯。
type fakeReadingRepo struct {
	project   storytellerModel.Project
	drafts    []storytellerModel.Story
	published []storytellerModel.Story
	lores     []storytellerModel.Lore
	records   map[uint64]storytellerModel.ReadingRecord
	upserted  [][]storytellerModel.ReadingRecord
}

func (f *fakeReadingRepo) ProjectByPublicIDForReader(uint64, string) (*storytellerModel.Project, error) {
	return &f.project, nil
}
func (f *fakeReadingRepo) Stories(uint64) ([]storytellerModel.Story, error) {
	return append(append([]storytellerModel.Story{}, f.published...), f.drafts...), nil
}
func (f *fakeReadingRepo) PublishedStories(uint64) ([]storytellerModel.Story, error) {
	return f.published, nil
}
func (f *fakeReadingRepo) ReaderLores(_ uint64, includeDrafts bool) ([]storytellerModel.Lore, error) {
	out := make([]storytellerModel.Lore, 0, len(f.lores))
	for _, lore := range f.lores {
		if includeDrafts || lore.Status == storytellerModel.StoryStatusCompleted {
			out = append(out, lore)
		}
	}
	return out, nil
}
func (f *fakeReadingRepo) ReadingRecords(uint64, uint64) ([]storytellerModel.ReadingRecord, error) {
	out := make([]storytellerModel.ReadingRecord, 0, len(f.records))
	for _, row := range f.records {
		out = append(out, row)
	}
	return out, nil
}
func (f *fakeReadingRepo) UpsertReadingRecords(rows []storytellerModel.ReadingRecord) error {
	f.upserted = append(f.upserted, rows)
	for _, row := range rows {
		if existing, ok := f.records[row.TargetID]; ok && existing.Progress > row.Progress {
			row.Progress = existing.Progress
		}
		f.records[row.TargetID] = row
	}
	return nil
}

func newFakeReadingRepo(ownerID uint64) *fakeReadingRepo {
	return &fakeReadingRepo{
		project:   storytellerModel.Project{ID: 1, UserID: ownerID},
		published: []storytellerModel.Story{{ID: 10, PublicID: "pub-a"}, {ID: 11, PublicID: "pub-b"}},
		drafts:    []storytellerModel.Story{{ID: 12, PublicID: "draft-c"}},
		lores: []storytellerModel.Lore{
			{ID: 20, PublicID: "lore-pub", Status: storytellerModel.StoryStatusCompleted},
			{ID: 21, PublicID: "lore-draft", Status: storytellerModel.StoryStatusDraft},
		},
		records: map[uint64]storytellerModel.ReadingRecord{},
	}
}

func storyInput(publicID string, progress int) storytellerModel.ReadingRecordInput {
	return storytellerModel.ReadingRecordInput{TargetType: storytellerModel.ReadingTargetStory, TargetPublicID: publicID, Progress: progress}
}

func TestSaveReadingRecordsClampsAndKeepsMaxPerTarget(t *testing.T) {
	repo := newFakeReadingRepo(99)
	out, err := saveReadingRecords(repo, 1, "p", []storytellerModel.ReadingRecordInput{
		storyInput("pub-a", 30), storyInput("pub-a", 70), storyInput("pub-a", 50), storyInput("pub-b", 180), storyInput("pub-b", -5),
	})
	require.NoError(t, err)
	require.Len(t, repo.upserted[0], 2, "同一篇只能寫一筆，否則同一個 INSERT 會撞到自己的唯一鍵")
	require.EqualValues(t, 70, repo.records[10].Progress)
	require.EqualValues(t, 100, repo.records[11].Progress)
	require.Len(t, out, 2)
}

func TestSaveReadingRecordsSkipsUnreadableTargets(t *testing.T) {
	repo := newFakeReadingRepo(99)
	_, err := saveReadingRecords(repo, 1, "p", []storytellerModel.ReadingRecordInput{
		storyInput("draft-c", 40), storyInput("missing", 40), storyInput("pub-a", 20),
		{TargetType: storytellerModel.ReadingTargetLore, TargetPublicID: "pub-a", Progress: 20},
		{TargetType: storytellerModel.ReadingTargetLore, TargetPublicID: "lore-draft", Progress: 20},
	})
	require.NoError(t, err)
	require.Len(t, repo.upserted[0], 1, "別人的草稿、不存在的篇章、種類對不上的 id、未公開的設定都要略過")
	require.EqualValues(t, 10, repo.upserted[0][0].TargetID)
}

func TestSaveReadingRecordsLetsOwnerTrackDrafts(t *testing.T) {
	repo := newFakeReadingRepo(1)
	out, err := saveReadingRecords(repo, 1, "p", []storytellerModel.ReadingRecordInput{storyInput("draft-c", 40)})
	require.NoError(t, err)
	require.Len(t, out, 1)
	require.Equal(t, "draft-c", out[0].TargetPublicID)
}

func TestSaveReadingRecordsRejectsOversizedBatch(t *testing.T) {
	inputs := make([]storytellerModel.ReadingRecordInput, storytellerModel.ReadingRecordMaxBatch+1)
	_, err := saveReadingRecords(newFakeReadingRepo(99), 1, "p", inputs)
	require.Error(t, err)
}

func TestReadingRecordsHidesUnpublishedStories(t *testing.T) {
	repo := newFakeReadingRepo(99)
	// 讀過之後被作者改回草稿的篇章，不能再出現在讀者的進度列表
	repo.records[12] = storytellerModel.ReadingRecord{TargetType: storytellerModel.ReadingTargetStory, TargetID: 12, Progress: 80}
	repo.records[10] = storytellerModel.ReadingRecord{TargetType: storytellerModel.ReadingTargetStory, TargetID: 10, Progress: 40}
	out, err := readingRecords(repo, 1, "p")
	require.NoError(t, err)
	require.Len(t, out, 1)
	require.Equal(t, "pub-a", out[0].TargetPublicID)
}

func TestSaveReadingRecordsTracksPublishedLore(t *testing.T) {
	repo := newFakeReadingRepo(99)
	out, err := saveReadingRecords(repo, 1, "p", []storytellerModel.ReadingRecordInput{
		{TargetType: storytellerModel.ReadingTargetLore, TargetPublicID: "lore-pub", Progress: 100},
	})
	require.NoError(t, err)
	require.Len(t, out, 1)
	require.Equal(t, storytellerModel.ReadingTargetLore, out[0].TargetType)
	require.Equal(t, "lore-pub", out[0].TargetPublicID)
}
