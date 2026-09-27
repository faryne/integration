package storytelleraudit

import (
	"encoding/json"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestOutcomeClassificationAndFailureRedaction(t *testing.T) {
	require.Equal(t, storytellerModel.AuditOutcomeDenied, OutcomeForHTTPStatus(403))
	require.Equal(t, storytellerModel.AuditOutcomeFailed, OutcomeForHTTPStatus(400))
	summary := FailureSummary(400, "400001")
	require.Equal(t, "validation", summary["error_category"])
	require.NotContains(t, summary, "message")
}

func TestCredentialSummaryRedactsSecret(t *testing.T) {
	summary := CredentialSummary(map[string]any{
		"provider": "openai", "label": "main", "api_key": "sk-super-secret-1234",
	}, map[string]any{"id": 9})
	encoded, err := json.Marshal(summary)
	require.NoError(t, err)
	require.NotContains(t, string(encoded), "sk-super-secret")
	require.Equal(t, "1234", summary["secret_last4"])
	patSummary := CredentialSummary(map[string]any{"label": "automation"}, map[string]any{
		"public_id": "pat_public", "token": "sst_private_9876",
	})
	patEncoded, err := json.Marshal(patSummary)
	require.NoError(t, err)
	require.NotContains(t, string(patEncoded), "sst_private")
	require.Equal(t, "9876", patSummary["secret_last4"])
}

func TestSystemContextBuildsSystemCronEvent(t *testing.T) {
	stream := &fakeStreamAdder{}
	SetDefaultProducer(newProducer(stream, nil))
	defer SetDefaultProducer(nil)

	err := EmitSystem(EventInput{Action: "system.memory_draft.cleanup"})
	require.NoError(t, err)
	require.Len(t, stream.added, 1)
	var event storytellerModel.AuditEvent
	require.NoError(t, json.Unmarshal([]byte(stream.added[0]), &event))
	require.Equal(t, storytellerModel.AuditActorTypeSystem, event.ActorType)
	require.Equal(t, storytellerModel.AuditSourceCron, event.Source)
	require.Nil(t, event.ActorUserID)
	require.Empty(t, event.RequestID)
}

func TestAnonymousDeniedEventIsNotClassifiedAsSystem(t *testing.T) {
	event, err := BuildEvent(RequestContext{
		Source: storytellerModel.AuditSourceMCP, AuthMethod: storytellerModel.AuditAuthMethodPAT,
	}, EventInput{Action: "auth.pat.denied", Outcome: storytellerModel.AuditOutcomeDenied}, time.Now())
	require.NoError(t, err)
	require.Equal(t, storytellerModel.AuditActorTypeUser, event.ActorType)
	require.Nil(t, event.ActorUserID)
}
