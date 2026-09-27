package storytelleraudit

import (
	"context"
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestBuildEvent(t *testing.T) {
	now := time.Date(2026, 9, 27, 10, 0, 0, 123456000, time.FixedZone("TST", 8*60*60))
	requestContext, ok := RequestContextFrom(WithRequestContext(context.Background(), RequestContext{
		RequestID: "request-1", Source: storytellerModel.AuditSourceMCP, AuthMethod: storytellerModel.AuditAuthMethodPAT,
		CredentialRef: "sst_abcdef", ActorUserID: 42, IP: "203.0.113.8", UserAgent: strings.Repeat("鯨", 300),
	}))
	require.True(t, ok)
	event, err := BuildEvent(requestContext, EventInput{
		Action: "story.update", ProjectID: uint64Pointer(10), TargetType: "story", TargetPublicID: "story-1",
		Summary: storytellerModel.AuditSummary{"version_id": 20},
	}, now)
	require.NoError(t, err)
	require.Len(t, event.EventID, 26)
	require.Equal(t, now.UTC(), event.OccurredAt)
	require.Equal(t, storytellerModel.AuditActorTypeUser, event.ActorType)
	require.Equal(t, uint64(42), *event.ActorUserID)
	require.Equal(t, "sst_abcdef", *event.CredentialRef)
	require.Len(t, []rune(*event.UserAgent), 255)
	require.Equal(t, storytellerModel.AuditOutcomeSuccess, event.Outcome)
	require.Equal(t, 20, event.Summary["version_id"])
}

func TestBuildEventRejectsEmptyAction(t *testing.T) {
	_, err := BuildEvent(RequestContext{}, EventInput{}, time.Now())
	require.EqualError(t, err, "audit action is required")
}

func uint64Pointer(value uint64) *uint64 { return &value }
