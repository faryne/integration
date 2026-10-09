package storyteller

import (
	"errors"
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func TestModerationReasonAppliesToTarget(t *testing.T) {
	all := &storytellerModel.ModerationReason{ReasonKey: "spam"}
	work := &storytellerModel.ModerationReason{ReasonKey: "unmarked_adult_content", AppliesTo: storytellerModel.StringList{"project", "story", "lore"}}
	author := &storytellerModel.ModerationReason{ReasonKey: "impersonation", AppliesTo: storytellerModel.StringList{"user", "author_profile"}}
	cases := []struct {
		reason *storytellerModel.ModerationReason
		target storytellerModel.ReportTargetType
		want   bool
	}{
		{all, storytellerModel.ReportTargetComment, true},
		{work, storytellerModel.ReportTargetStory, true},
		{work, storytellerModel.ReportTargetComment, false},
		// 請求用的 author 要對到 user／author_profile
		{author, storytellerModel.ReportTargetAuthor, true},
		{author, storytellerModel.ReportTargetAuthorProfile, true},
		{author, storytellerModel.ReportTargetProject, false},
	}
	for _, c := range cases {
		if got := c.reason.AppliesToTarget(c.target); got != c.want {
			t.Errorf("%s → %s = %v, want %v", c.reason.ReasonKey, c.target, got, c.want)
		}
	}
}

func TestCheckReportReason(t *testing.T) {
	spam := &storytellerModel.ModerationReason{ReasonKey: "spam", IsReportable: true}
	other := &storytellerModel.ModerationReason{ReasonKey: storytellerModel.ModerationReasonOther, IsReportable: true}
	internal := &storytellerModel.ModerationReason{ReasonKey: "tos_violation"}
	work := &storytellerModel.ModerationReason{ReasonKey: "unmarked_adult_content", IsReportable: true, AppliesTo: storytellerModel.StringList{"project"}}

	if note, err := checkReportReason(spam, storytellerModel.ReportTargetComment, "  "); err != nil || note != "" {
		t.Fatalf("spam without note: note=%q err=%v", note, err)
	}
	if _, err := checkReportReason(other, storytellerModel.ReportTargetComment, " "); !errors.Is(err, ErrReportNoteRequired) {
		t.Fatalf("other without note: err=%v", err)
	}
	if note, err := checkReportReason(other, storytellerModel.ReportTargetComment, "  洗版 \r\n"); err != nil || note != "洗版" {
		t.Fatalf("other with note: note=%q err=%v", note, err)
	}
	if _, err := checkReportReason(internal, storytellerModel.ReportTargetComment, ""); !errors.Is(err, ErrReportInvalidReason) {
		t.Fatalf("internal-only reason: err=%v", err)
	}
	if _, err := checkReportReason(work, storytellerModel.ReportTargetComment, ""); !errors.Is(err, ErrReportInvalidReason) {
		t.Fatalf("reason not applicable: err=%v", err)
	}
	long := strings.Repeat("字", storytellerModel.ReportNoteMaxRunes+1)
	var validation PostValidationError
	if _, err := checkReportReason(spam, storytellerModel.ReportTargetComment, long); !errors.As(err, &validation) {
		t.Fatalf("note too long: err=%v", err)
	}
}
