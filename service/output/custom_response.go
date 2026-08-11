package output

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/utils/v2"
)

func Success(out any, message ...string) error {
	msg := utils.StatusMessage(fiber.StatusOK)
	if len(message) > 0 {
		msg = message[0]
	}
	return New(fiber.StatusOK, CustomCodeSuccess, out, msg)
}

func InternalServiceError(err error) error {
	return New(fiber.StatusInternalServerError, CustomCodeInternalServiceError, nil, err.Error())
}

func DBError(err error) error {
	return New(fiber.StatusInternalServerError, CustomCodeDBError, nil, err.Error())
}

func ESError(err error) error {
	return New(fiber.StatusInternalServerError, CustomCodeESError, nil, err.Error())
}

func ExternalServiceError(err error) error {
	return New(fiber.StatusServiceUnavailable, CustomCodeExternalServiceError, nil, err.Error())
}

func BadRequest(err error) error {
	return New(fiber.StatusBadRequest, CustomCodeBadRequest, nil, err.Error())
}

func Unauthorized(err error) error {
	return New(fiber.StatusUnauthorized, CustomCodeUnauthorized, nil, err.Error())
}

func NotFound(err error) error {
	return New(fiber.StatusNotFound, CustomCodeNotFound, nil, err.Error())
}

func Maintenance(message string, data any) error {
	return New(fiber.StatusServiceUnavailable, CustomCodeMaintenance, data, message)
}
