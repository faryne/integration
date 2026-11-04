package av

import "faryne.dev/model/entity/opendata/av"

// RepositoryDMMActressSubmission 女優上稿提交單（dmm_actress_submissions）
type RepositoryDMMActressSubmission = RepositorySubmission[av.DMMActressSubmission]

func NewDMMActressSubmission() *RepositoryDMMActressSubmission {
	return newSubmission[av.DMMActressSubmission]()
}
