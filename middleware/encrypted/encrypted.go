package encrypted

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	authService "faryne.dev/service/auth"
	cryptoService "faryne.dev/service/crypto"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/schema"
)

const (
	LocalDecryptedPayload  = "encrypted.decrypted_payload"
	LocalAuthSession       = "encrypted.auth_session"
	HeaderEncryptKey       = "X-Encrypt-Key"
	HeaderSessionExpiresAt = "X-Session-Expires-At"
	QueryPayload           = "payload"
)

var queryDecoder = schema.NewDecoder()

func New() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		encryptKey := strings.TrimSpace(ctx.Get(HeaderEncryptKey))
		if encryptKey == "" {
			return output.Unauthorized(errors.New("X-Encrypt-Key header is required"))
		}

		session, err := authService.GetSessionByEncryptKey(encryptKey)
		if err != nil {
			return output.Unauthorized(err)
		}

		encryptedPayload := requestPayload(ctx)
		if encryptedPayload == "" {
			return output.BadRequest(errors.New("encrypted request payload is required"))
		}

		decryptedPayload, err := cryptoService.DecryptString(encryptKey, encryptedPayload)
		if err != nil {
			return output.BadRequest(err)
		}

		ctx.Locals(LocalDecryptedPayload, decryptedPayload)
		ctx.Locals(LocalAuthSession, session)
		ctx.Set(HeaderSessionExpiresAt, session.ExpiresAt)

		if err := ctx.Next(); err != nil {
			if handled, handleErr := handleOutputError(ctx, err); handleErr != nil {
				return handleErr
			} else if !handled {
				return err
			}
		}

		responseBody := string(ctx.Response().Body())
		encryptedResponse, err := cryptoService.EncryptString(encryptKey, responseBody)
		if err != nil {
			return output.InternalServiceError(err)
		}

		ctx.Response().Header.SetContentType("text/plain; charset=utf-8")
		ctx.Response().SetBodyString(encryptedResponse)
		return nil
	}
}

func handleOutputError(ctx fiber.Ctx, err error) (bool, error) {
	response, ok := err.(output.CommonOutputInterface)
	if !ok {
		return false, nil
	}

	costTime := float64(-1)
	endTime := float64(time.Now().UnixMilli())
	if startTime := ctx.Locals("start_time"); startTime != nil {
		if startedAt, ok := startTime.(int64); ok {
			costTime = (endTime - float64(startedAt)) / float64(time.Microsecond)
		}
	}

	uri := ctx.Scheme() + "://" + ctx.Hostname() + ctx.Path()
	if ctx.Request().URI().QueryArgs().Len() > 0 {
		uri = uri + "?" + ctx.Request().URI().QueryArgs().String()
	}

	finalOutput := response.Output(costTime, uri)
	finalOutput.Method = ctx.Method()
	body, marshalErr := json.Marshal(finalOutput)
	if marshalErr != nil {
		return true, marshalErr
	}

	ctx.Status(finalOutput.Code)
	ctx.Response().Header.SetContentType("application/json; charset=utf-8")
	ctx.Response().SetBody(body)
	return true, nil
}

func DecryptedPayload(ctx fiber.Ctx, out ...any) string {
	payload, _ := ctx.Locals(LocalDecryptedPayload).(string)
	if len(out) == 0 || out[0] == nil || payload == "" {
		return payload
	}

	if err := bindPayload(payload, out[0]); err != nil {
		ctx.Locals(LocalDecryptedPayload+".bind_error", err)
	}
	return payload
}

func DecryptedPayloadBindError(ctx fiber.Ctx) error {
	err, _ := ctx.Locals(LocalDecryptedPayload + ".bind_error").(error)
	return err
}

func AuthSession(ctx fiber.Ctx) *modelAuth.RedisSession {
	session, _ := ctx.Locals(LocalAuthSession).(*modelAuth.RedisSession)
	return session
}

func bindPayload(payload string, out any) error {
	trimmed := strings.TrimSpace(payload)
	if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
		return json.Unmarshal([]byte(trimmed), out)
	}

	values, err := url.ParseQuery(trimmed)
	if err != nil {
		return err
	}
	return queryDecoder.Decode(out, values)
}

func requestPayload(ctx fiber.Ctx) string {
	if ctx.Method() == fiber.MethodGet {
		return strings.TrimSpace(ctx.Query(QueryPayload))
	}
	return strings.TrimSpace(string(ctx.Request().Body()))
}
