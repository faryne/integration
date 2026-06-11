package auth

import (
	"time"

	"faryne.dev/middleware/encrypted"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

type encryptedDemoRequest struct {
	A string `json:"a" schema:"a"`
	B string `json:"b" schema:"b"`
}

type encryptedDemoResponse struct {
	ReceivedPayload string               `json:"received_payload"`
	BoundPayload    encryptedDemoRequest `json:"bound_payload"`
	UserId          uint64               `json:"user_id"`
	FirebaseUID     string               `json:"firebase_uid"`
	HandledAt       string               `json:"handled_at"`
}

func EncryptedDemo(ctx fiber.Ctx) error {
	session := encrypted.AuthSession(ctx)
	if session == nil {
		return output.InternalServiceError(fiber.ErrInternalServerError)
	}

	var req encryptedDemoRequest
	payload := encrypted.DecryptedPayload(ctx, &req)
	if err := encrypted.DecryptedPayloadBindError(ctx); err != nil {
		return output.BadRequest(err)
	}

	return output.Success(encryptedDemoResponse{
		ReceivedPayload: payload,
		BoundPayload:    req,
		UserId:          session.UserId,
		FirebaseUID:     session.FirebaseUID,
		HandledAt:       time.Now().Format(time.RFC3339),
	})
}
