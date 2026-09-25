package storyteller

import (
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestParseAssistantMemoryCandidate(t *testing.T) {
	raw := `前置雜訊<MemoryDraft>
<ShouldRemember>true</ShouldRemember>
<Name><![CDATA[對話口吻]]></Name>
<Content><![CDATA[使用者希望梭梭使用自然的台灣口語，並保留完整句子的呼吸感。]]></Content>
<Scope>account</Scope><Kind>preference</Kind><Priority>80</Priority>
<SupersedesPublicID><![CDATA[memory-old]]></SupersedesPublicID>
</MemoryDraft>後置雜訊`

	candidate, err := parseAssistantMemoryCandidate(raw, storytellerModel.AssistantMemoryScopeStory)
	require.NoError(t, err)
	require.True(t, candidate.ShouldRemember)
	require.Equal(t, "對話口吻", candidate.Name)
	require.Equal(t, storytellerModel.AssistantMemoryScopeAccount, candidate.Scope)
	require.Equal(t, storytellerModel.AssistantMemoryKindPreference, candidate.Kind)
	require.Equal(t, uint8(80), candidate.Priority)
	require.Equal(t, "memory-old", candidate.SupersedesPublicID)
}

func TestParseAssistantMemoryCandidateAllowsEmptyNoMemoryResponse(t *testing.T) {
	candidate, err := parseAssistantMemoryCandidate(`<MemoryDraft><ShouldRemember>false</ShouldRemember><SupersedesPublicID>memory-old</SupersedesPublicID></MemoryDraft>`, storytellerModel.AssistantMemoryScopeLore)
	require.NoError(t, err)
	require.False(t, candidate.ShouldRemember)
	require.Equal(t, storytellerModel.AssistantMemoryScopeLore, candidate.Scope)
	require.Equal(t, storytellerModel.AssistantMemoryKindContext, candidate.Kind)
	require.Empty(t, candidate.SupersedesPublicID)
}

func TestParseAssistantMemoryCandidateRejectsUnavailableScope(t *testing.T) {
	_, err := parseAssistantMemoryCandidate(`<MemoryDraft><ShouldRemember>true</ShouldRemember><Name>專案決策</Name><Content>只適用目前設定的規則。</Content><Scope>story</Scope><Kind>decision</Kind><Priority>50</Priority></MemoryDraft>`, storytellerModel.AssistantMemoryScopeLore)
	require.ErrorIs(t, err, ErrAssistantMemoryScopeInvalid)
}

func TestBuildAssistantMemoryGenerationPromptEscapesConversation(t *testing.T) {
	prompt := buildAssistantMemoryGenerationPrompt(
		&storytellerModel.Project{Name: `A & B`, PublicID: "project-1"},
		&storytellerModel.AgentChatTarget{Kind: "story", TargetPublicID: "story-1"},
		storytellerModel.AssistantMemoryScopeStory,
		[]storytellerModel.StoryChatMessageOutput{{Role: storytellerModel.ChatMessageRoleUser, Content: `<script> & request`}},
		[]storytellerModel.AssistantMemory{{PublicID: "memory-1", ScopeType: storytellerModel.AssistantMemoryScopeAccount, Kind: storytellerModel.AssistantMemoryKindPreference, Content: `偏好 A&B`, IsPinned: true}},
	)

	require.Contains(t, prompt, "<AllowedScopes>account,project,story</AllowedScopes>")
	require.Contains(t, prompt, "A &amp; B")
	require.Contains(t, prompt, "&lt;script&gt; &amp; request")
	require.Contains(t, prompt, `public_id="memory-1" scope="account" kind="preference" pinned="true"`)
	require.False(t, strings.Contains(prompt, "<script>"))
}

func TestValidateAssistantMemorySupersedes(t *testing.T) {
	candidate := assistantMemoryCandidate{ShouldRemember: true, Scope: storytellerModel.AssistantMemoryScopeStory, SupersedesPublicID: "old-memory"}

	require.NoError(t, validateAssistantMemorySupersedes(candidate, []storytellerModel.AssistantMemory{{
		PublicID: "old-memory", ScopeType: storytellerModel.AssistantMemoryScopeStory,
	}}))
	require.ErrorIs(t, validateAssistantMemorySupersedes(candidate, []storytellerModel.AssistantMemory{{
		PublicID: "old-memory", ScopeType: storytellerModel.AssistantMemoryScopeStory, IsPinned: true,
	}}), ErrAssistantMemorySupersedeConflict)
	require.ErrorIs(t, validateAssistantMemorySupersedes(candidate, []storytellerModel.AssistantMemory{{
		PublicID: "old-memory", ScopeType: storytellerModel.AssistantMemoryScopeProject,
	}}), ErrAssistantMemorySupersedeConflict)
}
