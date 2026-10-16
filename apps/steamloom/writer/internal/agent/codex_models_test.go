package agent

import (
	"slices"
	"testing"
)

func TestCodexRequestArgsIncludeSelectedModelAndEffort(t *testing.T) {
	args, err := codexRequestArgs(Request{Model: "gpt-5.6-luna", ReasoningEffort: "high"}, "/tmp/writer")
	if err != nil {
		t.Fatal(err)
	}
	if !containsPair(args, "--model", "gpt-5.6-luna") || !containsPair(args, "-c", `model_reasoning_effort="high"`) {
		t.Fatalf("Codex args must include selected profile: %v", args)
	}
}

func TestCodexRequestArgsApplyProfileWhenResuming(t *testing.T) {
	args, err := codexRequestArgs(Request{SessionID: "session-id", Model: "gpt-5.6-sol", ReasoningEffort: "ultra"}, "/tmp/writer")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(args, "resume") || !containsPair(args, "--model", "gpt-5.6-sol") || !containsPair(args, "-c", `model_reasoning_effort="ultra"`) {
		t.Fatalf("resumed Codex args must include selected profile: %v", args)
	}
}

func TestNormalizeCodexModelsUsesInvocationModelAndSkipsHidden(t *testing.T) {
	rows := []codexModelRow{
		{ID: "picker-id", Model: "gpt-model", DisplayName: "GPT Model", IsDefault: true, DefaultReasoningEffort: "medium", SupportedEfforts: []struct {
			ReasoningEffort string `json:"reasoningEffort"`
			Description     string `json:"description"`
		}{{ReasoningEffort: "medium", Description: "Balanced"}}},
		{ID: "hidden", Model: "hidden", Hidden: true},
	}
	models := normalizeCodexModels(rows)
	if len(models) != 1 || models[0].ID != "gpt-model" || models[0].DisplayName != "GPT Model" || !models[0].IsDefault || models[0].SupportedReasoningEfforts[0].ID != "medium" {
		t.Fatalf("unexpected normalized models: %#v", models)
	}
}

func TestRequestRejectsUnsafeExecutionProfile(t *testing.T) {
	for _, req := range []Request{
		{ProjectID: "project", Prompt: "hello", Model: "--help"},
		{ProjectID: "project", Prompt: "hello", ReasoningEffort: "high\nmodel=bad"},
	} {
		if err := req.validate(); err == nil {
			t.Fatalf("unsafe profile must be rejected: %#v", req)
		}
	}
}

func TestOtherAgentsIgnoreCodexExecutionProfile(t *testing.T) {
	req := Request{Model: "gpt-5.6-sol", ReasoningEffort: "high"}
	normalizeExecutionProfile("claude", &req)
	if req.Model != "" || req.ReasoningEffort != "" {
		t.Fatalf("non-Codex profile must be cleared: %#v", req)
	}
}
