package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestUniquePermissionKeysDropsDuplicatesPreservingOrder(t *testing.T) {
	keys := uniquePermissionKeys([]storytellerModel.PermissionKey{
		storytellerModel.PermissionStoryRead,
		storytellerModel.PermissionStoryUpdate,
		storytellerModel.PermissionStoryRead,
	})

	require.Equal(t, []storytellerModel.PermissionKey{
		storytellerModel.PermissionStoryRead,
		storytellerModel.PermissionStoryUpdate,
	}, keys)
}

func TestUniquePermissionKeysHandlesEmptyInput(t *testing.T) {
	keys := uniquePermissionKeys(nil)

	require.Empty(t, keys)
}
