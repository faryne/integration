package storyteller

import (
	"errors"
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

type fakePersonalAccessTokenAuthRepository struct {
	row *storytellerModel.PersonalAccessToken
	err error
}

func (f fakePersonalAccessTokenAuthRepository) PersonalAccessTokenByHash(string) (*storytellerModel.PersonalAccessToken, error) {
	return f.row, f.err
}

func (fakePersonalAccessTokenAuthRepository) TouchPersonalAccessTokenLastUsed(uint64) error {
	return nil
}

func TestPersonalAccessTokenPublicIDUsesIndependentRandomID(t *testing.T) {
	first, err := generatePersonalAccessTokenPublicID()
	require.NoError(t, err)
	second, err := generatePersonalAccessTokenPublicID()
	require.NoError(t, err)

	require.True(t, strings.HasPrefix(first, "pat_"))
	require.Len(t, first, len("pat_")+16)
	require.NotEqual(t, first, second)
}

func TestAuthenticateExpiredPersonalAccessTokenKeepsSafeAttribution(t *testing.T) {
	now := time.Now()
	result, err := authenticatePersonalAccessToken(fakePersonalAccessTokenAuthRepository{row: &storytellerModel.PersonalAccessToken{
		UserID: 42, PublicID: "pat_public", Label: "automation", ExpiresAt: timePointer(now.Add(-time.Minute)),
	}}, "sst_secret", now)

	require.ErrorIs(t, err, errPersonalAccessTokenInvalid)
	require.Equal(t, uint64(42), result.UserID)
	require.Equal(t, "pat_public", result.CredentialRef)
	require.Equal(t, "expired", result.DeniedReason)
}

func TestAuthenticateUnknownPersonalAccessTokenHasNoAttribution(t *testing.T) {
	result, err := authenticatePersonalAccessToken(fakePersonalAccessTokenAuthRepository{err: errors.New("not found")}, "sst_unknown", time.Now())

	require.ErrorIs(t, err, errPersonalAccessTokenInvalid)
	require.Nil(t, result)
}

func timePointer(value time.Time) *time.Time { return &value }
