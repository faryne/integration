package storyteller

import (
	"errors"
	"fmt"
)

// VersionConflictError 表示 conditional write 的基準版本已落後；transaction 必須直接回滾，
// 不能沿用一般網頁存檔「照樣寫入、事後標記」的語意。
type VersionConflictError struct {
	Resource        string
	LatestVersionID uint64
}

func (e *VersionConflictError) Error() string {
	return fmt.Sprintf("%s version conflict: latest version is %d", e.Resource, e.LatestVersionID)
}

func IsVersionConflict(err error) bool {
	var conflict *VersionConflictError
	return errors.As(err, &conflict)
}
