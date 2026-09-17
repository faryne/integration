package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestProjectAuthorizationOwnerHasEveryPermission(t *testing.T) {
	authorization := ProjectAuthorization{IsOwner: true}

	require.True(t, authorization.Has(storytellerModel.PermissionStoryUpdate))
	require.True(t, authorization.Has(storytellerModel.PermissionAssetCreate))
}

func TestProjectAuthorizationNonOwnerOnlyHasGrantedPermissions(t *testing.T) {
	authorization := ProjectAuthorization{
		Permissions: map[storytellerModel.PermissionKey]bool{
			storytellerModel.PermissionStoryRead:   true,
			storytellerModel.PermissionStoryUpdate: true,
		},
	}

	require.True(t, authorization.Has(storytellerModel.PermissionStoryRead))
	require.True(t, authorization.Has(storytellerModel.PermissionStoryUpdate))
	require.False(t, authorization.Has(storytellerModel.PermissionStoryCreate))
	require.False(t, authorization.Has(storytellerModel.PermissionProjectUpdate))
}

func TestProjectAuthorizationNonOwnerWithNoGrantsHasNoPermissions(t *testing.T) {
	authorization := ProjectAuthorization{}

	require.False(t, authorization.Has(storytellerModel.PermissionStoryRead))
	require.False(t, authorization.Has(storytellerModel.PermissionProjectRead))
}

func TestDerivePermissionsUpdateImpliesReadOnSameResource(t *testing.T) {
	derived := derivePermissions(map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionStoryUpdate: true,
	})

	require.True(t, derived[storytellerModel.PermissionStoryUpdate])
	require.True(t, derived[storytellerModel.PermissionStoryRead])
	require.False(t, derived[storytellerModel.PermissionStoryCreate])
}

func TestDerivePermissionsCreateImpliesReadOnSameResource(t *testing.T) {
	derived := derivePermissions(map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionAssetCreate: true,
	})

	require.True(t, derived[storytellerModel.PermissionAssetCreate])
	require.True(t, derived[storytellerModel.PermissionAssetRead])
}

func TestDerivePermissionsAnyNonProjectPermissionImpliesProjectRead(t *testing.T) {
	derived := derivePermissions(map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionLoreCollectionRead: true,
	})

	require.True(t, derived[storytellerModel.PermissionProjectRead])
}

func TestDerivePermissionsPlainReadDoesNotImplyProjectReadTwice(t *testing.T) {
	// project.read 本身不該因為規則 2 被誤判成「非 project 權限」而重複觸發；
	// 這裡確認純粹只有 project.read 時，集合裡就只有這一個 key。
	derived := derivePermissions(map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionProjectRead: true,
	})

	require.Equal(t, map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionProjectRead: true,
	}, derived)
}

func TestDerivePermissionsDoesNotLeakFalseEntries(t *testing.T) {
	// 呼叫端可能傳一個值為 false 的 map（例如上游用同一個 map 做增量更新），
	// 這種 key 不該被當成「有授權」而推導出額外權限。
	derived := derivePermissions(map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionStoryUpdate: false,
	})

	require.Empty(t, derived)
}

func TestDerivePermissionsIgnoresUnknownFormatKeys(t *testing.T) {
	derived := derivePermissions(map[storytellerModel.PermissionKey]bool{
		storytellerModel.PermissionKey("not-a-dotted-key"): true,
	})

	require.True(t, derived[storytellerModel.PermissionKey("not-a-dotted-key")])
	require.False(t, derived[storytellerModel.PermissionProjectRead])
}

func TestValidateProjectRoleNameTrimsAndRejectsEmpty(t *testing.T) {
	name, err := validateProjectRoleName("  Editors  ")
	require.NoError(t, err)
	require.Equal(t, "Editors", name)

	_, err = validateProjectRoleName("   ")
	require.Error(t, err)
}

func TestValidateProjectRoleNameRejectsTooLong(t *testing.T) {
	tooLong := make([]byte, roleNameMaxLength+1)
	for i := range tooLong {
		tooLong[i] = 'a'
	}

	_, err := validateProjectRoleName(string(tooLong))

	require.Error(t, err)
}
