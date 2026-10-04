package storytellermcp

import (
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// SkillMarkdown 提供 SteamLoom Skill 的 SKILL.md：MCP 連接頁的預覽、下載，以及 Claude Code／Codex
// 的 curl 一行安裝指令都讀這裡。內容不含任何使用者資料或憑證，不需要登入。
func SkillMarkdown(ctx fiber.Ctx) error {
	ctx.Set(fiber.HeaderContentType, "text/markdown; charset=utf-8")
	ctx.Set(fiber.HeaderContentDisposition, `attachment; filename="SKILL.md"`)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return ctx.SendString(storyteller.MCPSkillMarkdown())
}

// SkillZip 提供 `steamloom/SKILL.md` 的 ZIP，給只收 ZIP 的 Claude.ai／ChatGPT 上傳。
func SkillZip(ctx fiber.Ctx) error {
	data, err := storyteller.MCPSkillZip()
	if err != nil {
		return output.InternalServiceError(err)
	}
	ctx.Set(fiber.HeaderContentType, "application/zip")
	ctx.Set(fiber.HeaderContentDisposition, `attachment; filename="`+storyteller.MCPSkillName+`.zip"`)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return ctx.Send(data)
}
