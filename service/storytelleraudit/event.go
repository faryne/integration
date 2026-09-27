package storytelleraudit

import (
	"crypto/rand"
	"errors"
	"math/big"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const crockfordBase32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

type EventInput struct {
	Action         string
	ProjectID      *uint64
	TargetType     string
	TargetPublicID string
	Summary        storytellerModel.AuditSummary
}

func BuildEvent(ctx RequestContext, input EventInput, now time.Time) (*storytellerModel.AuditEvent, error) {
	if input.Action == "" {
		return nil, errors.New("audit action is required")
	}
	eventID, err := newULID(now)
	if err != nil {
		return nil, err
	}
	actorType := storytellerModel.AuditActorTypeSystem
	var actorUserID *uint64
	if ctx.ActorUserID != 0 {
		actorType, actorUserID = storytellerModel.AuditActorTypeUser, &ctx.ActorUserID
	}
	return &storytellerModel.AuditEvent{
		EventID:        eventID,
		OccurredAt:     now.UTC(),
		ActorType:      actorType,
		ActorUserID:    actorUserID,
		Source:         ctx.Source,
		AuthMethod:     ctx.AuthMethod,
		CredentialRef:  stringPointer(ctx.CredentialRef),
		IP:             stringPointer(ctx.IP),
		UserAgent:      stringPointer(ctx.UserAgent),
		RequestID:      stringPointer(ctx.RequestID),
		ProjectID:      input.ProjectID,
		Action:         input.Action,
		TargetType:     stringPointer(input.TargetType),
		TargetPublicID: stringPointer(input.TargetPublicID),
		Outcome:        storytellerModel.AuditOutcomeSuccess,
		Summary:        input.Summary,
	}, nil
}

// newULID 以標準 ULID 的 48-bit 毫秒時間＋80-bit crypto/rand entropy 編碼，
// 避免只為一個 26 字元 ID 引入額外 runtime dependency。
func newULID(now time.Time) (string, error) {
	var raw [16]byte
	millis := uint64(now.UnixMilli())
	for i := 5; i >= 0; i-- {
		raw[i] = byte(millis)
		millis >>= 8
	}
	if _, err := rand.Read(raw[6:]); err != nil {
		return "", err
	}
	n := new(big.Int).SetBytes(raw[:])
	base := big.NewInt(32)
	rem := new(big.Int)
	encoded := make([]byte, 26)
	for i := len(encoded) - 1; i >= 0; i-- {
		n.QuoRem(n, base, rem)
		encoded[i] = crockfordBase32[rem.Int64()]
	}
	return string(encoded), nil
}
