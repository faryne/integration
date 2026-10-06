#!/bin/sh
# SteamLoom Skill 安裝程式（macOS／Linux）
#   curl -fsSL {{INSTALLER_URL}} | sh
#
# 會做的事：
#   1. 下載最新版 SKILL.md
#   2. 偵測 Claude Code（~/.claude）與 Codex（~/.codex），有哪個就裝到哪個的 skills 目錄
#   3. 已經裝過的話比對版本，有新版才覆蓋
#   4. 移除舊版 {{LEGACY_NAME}}（只刪確認是 SteamLoom 舊版 Skill 的資料夾）
# 不會讀寫上述 skills 目錄以外的任何檔案，也不需要 sudo。
# 本機測試可用 STEAMLOOM_SKILL_URL 換掉下載來源。

set -eu

# 整支包在 main 裡、最後一行才呼叫：curl 中途斷線時不會執行到一半的 script
main() {
	skill_url="${STEAMLOOM_SKILL_URL:-{{SKILL_URL}}}"
	tmp="$(mktemp)"
	trap 'rm -f "$tmp"' EXIT

	if ! curl -fsSL "$skill_url" -o "$tmp"; then
		echo "! 下載 SKILL.md 失敗：$skill_url" >&2
		exit 1
	fi
	latest="$(skill_version "$tmp")"
	if [ -z "$latest" ]; then
		echo "! 下載到的檔案不是 SteamLoom Skill：$skill_url" >&2
		exit 1
	fi

	echo "SteamLoom Skill 安裝程式　最新版本 v$latest"
	echo

	has_claude=0
	has_codex=0
	[ -d "$HOME/.claude" ] && has_claude=1
	{ [ -d "$HOME/.codex" ] || [ -d "$HOME/.agents" ]; } && has_codex=1
	if [ "$has_claude" -eq 0 ] && [ "$has_codex" -eq 0 ]; then
		echo "! 沒有偵測到 Claude Code 或 Codex"
		echo "  找不到 ~/.claude，也找不到 ~/.codex。"
		echo "  先安裝 Claude Code 或 Codex 並啟動過一次，再重新執行這行指令。"
		exit 1
	fi

	install_or_skip "$has_claude" "Claude Code" "$HOME/.claude/skills"
	install_or_skip "$has_codex" "Codex" "$HOME/.agents/skills"
	echo
	echo "完成。不用重啟，新版本會自動載入。"
}

# skill_version 讀 SKILL.md frontmatter 的 version（metadata 底下的 version: "x.y.z"）
skill_version() {
	sed -n 's/^  version: "\(.*\)"$/\1/p' "$1" | head -n 1
}

# install_or_skip <是否偵測到> <顯示名稱> <skills 目錄>
install_or_skip() {
	if [ "$1" -eq 1 ]; then
		install_to "$2" "$3"
	else
		printf '%s\n  - 沒有偵測到 %s，略過\n' "$2" "$2"
	fi
}

# install_to <顯示名稱> <skills 目錄>：比對版本後安裝，並移除同目錄下的舊版
install_to() {
	dir="$2/{{SKILL_NAME}}"
	printf '%-12s %s\n' "$1" "$dir"
	current=""
	if [ -f "$dir/SKILL.md" ]; then
		current="$(skill_version "$dir/SKILL.md")"
	fi
	if [ "$current" = "$latest" ]; then
		echo "  - 已是最新版 v$latest，不用更新"
	else
		mkdir -p "$dir"
		cp "$tmp" "$dir/SKILL.md"
		if [ -n "$current" ]; then
			echo "  ✓ 已從 v$current 更新到 v$latest"
		else
			echo "  ✓ 已安裝 v$latest"
		fi
	fi

	legacy="$2/{{LEGACY_NAME}}"
	if [ -f "$legacy/SKILL.md" ] && grep -q '^name: {{LEGACY_NAME}}$' "$legacy/SKILL.md"; then
		rm -rf "$legacy"
		echo "  ✓ 已移除舊版 $legacy"
	fi
}

main "$@"
