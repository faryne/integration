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
