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

// SkillInstallerSh／SkillInstallerPs1 提供 Skill 安裝程式（curl … | sh、irm … | iex）。
// 預設 inline 回傳讓 curl／irm 直接執行；帶 ?download=1 時改成附件，給連接頁的「下載安裝程式」按鈕用。
func SkillInstallerSh(ctx fiber.Ctx) error { return sendSkillInstaller(ctx, "sh") }

func SkillInstallerPs1(ctx fiber.Ctx) error { return sendSkillInstaller(ctx, "ps1") }

func sendSkillInstaller(ctx fiber.Ctx, ext string) error {
	// charset 一定要帶：irm 依 charset 解碼，沒帶的話 Windows PowerShell 會把中文當成 ISO-8859-1
	ctx.Set(fiber.HeaderContentType, "text/plain; charset=utf-8")
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
	if ctx.Query("download") != "" {
		ctx.Set(fiber.HeaderContentDisposition, `attachment; filename="skill-installer.`+ext+`"`)
	}
	return ctx.SendString(storyteller.MCPSkillInstaller(ext))
}
