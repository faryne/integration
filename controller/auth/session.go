package auth

import (
	"errors"
	"strings"

	authService "faryne.dev/service/auth"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

func CreateSession(ctx fiber.Ctx) error {
	idToken, err := bearerToken(ctx.Get("Authorization"))
	if err != nil {
		return output.BadRequest(err)
	}

	resp, err := authService.CreateSession(idToken)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(resp)
}

func DestroySession(ctx fiber.Ctx) error {
	encryptKey := strings.TrimSpace(ctx.Get("X-Encrypt-Key"))
	if encryptKey == "" {
		return output.BadRequest(errors.New("X-Encrypt-Key header is required"))
	}

	if err := authService.DestroySession(encryptKey); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"destroyed": true})
}

func bearerToken(header string) (string, error) {
	header = strings.TrimSpace(header)
	if header == "" {
		return "", errors.New("Authorization header is required")
	}

	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
		return "", errors.New("Authorization header must be Bearer token")
	}
	return strings.TrimSpace(parts[1]), nil
}
