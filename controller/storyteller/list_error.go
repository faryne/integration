package storyteller

import (
	"faryne.dev/repository"
	"faryne.dev/service/output"
)

// listError 給專案底下的列表 API（作品、冊、設定、資產與其分組）用：專案或篩選用的分組
// 不存在時回 404，跟 GET /projects/:project 一致；其餘錯誤維持原本的 400。
// 之前一律回 400，網址帶錯專案 id 時前端會看到專案 404、子資源 400 混在一起。
func listError(err error) error {
	if repository.IsRecordNotFound(err) {
		return output.NotFound(err)
	}
	return output.BadRequest(err)
}
