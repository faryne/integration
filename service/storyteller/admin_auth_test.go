package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func TestDerivePlatformPermissions(t *testing.T) {
	auth := derivePlatformPermissions([]storytellerModel.PermissionKey{
		storytellerModel.PermissionAdminReportUpdate,
		storytellerModel.PermissionAdminCommentDelete,
		// project scope 的 key 不能混進平台權限
		storytellerModel.PermissionStoryUpdate,
	})
	if !auth.Has(storytellerModel.PermissionAdminReportRead) {
		t.Fatal("admin.report.update 應推導出 admin.report.read")
	}
	if auth.Has(storytellerModel.PermissionAdminCommentDelete, storytellerModel.PermissionAdminProjectDelete) {
		t.Fatal("沒有 admin.project.delete 時 Has 應回 false")
	}
	for _, key := range []storytellerModel.PermissionKey{storytellerModel.PermissionStoryUpdate, storytellerModel.PermissionStoryRead, storytellerModel.PermissionProjectRead, "admin.comment.read"} {
		if auth[key] {
			t.Fatalf("不應出現 %s", key)
		}
	}
}
