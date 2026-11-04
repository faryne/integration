package av

import "faryne.dev/model/entity/opendata/av"

// RepositoryDMMVideoSubmission 影片修改提交單（dmm_video_submissions）
type RepositoryDMMVideoSubmission = RepositorySubmission[av.DMMVideoSubmission]

func NewDMMVideoSubmission() *RepositoryDMMVideoSubmission {
	return newSubmission[av.DMMVideoSubmission]()
}
