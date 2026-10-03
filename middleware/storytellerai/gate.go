// Package storytellerai 是站內 AI 助理的開關閘門：STORYTELLER_AI_ASSISTANT_ENABLED 為 false 時，
// 掛上 Gate 的路由一律回 403，不進 handler。MCP 不經過這些路由，不受影響。
package storytellerai

import (
	"faryne.dev/config"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// customCodeAIAssistantDisabled：AI 助理停用，前端不應該呼叫到；出現代表有遺漏的入口沒藏好。
const customCodeAIAssistantDisabled output.CustomCode = "403101"

func Gate() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		if !config.EnvConfig().StorytellerAIAssistantEnabled {
			return output.New(fiber.StatusForbidden, customCodeAIAssistantDisabled, nil, "AI 助理功能目前停用")
		}
		return ctx.Next()
	}
}
