# SteamLoom Skill 安裝程式（Windows PowerShell 5.1／PowerShell 7）
#   irm {{INSTALLER_URL}} | iex
#
# 會做的事：
#   1. 下載最新版 SKILL.md
#   2. 偵測 Claude Code（%USERPROFILE%\.claude）與 Codex（%USERPROFILE%\.codex），有哪個就裝到哪個的 skills 目錄
#   3. 已經裝過的話比對版本，有新版才覆蓋
#   4. 移除舊版 {{LEGACY_NAME}}（只刪確認是 SteamLoom 舊版 Skill 的資料夾）
# 不會讀寫上述 skills 目錄以外的任何檔案，也不需要系統管理員權限。
# 本機測試可用 $env:STEAMLOOM_SKILL_URL 換掉下載來源。

# 整支包在 script block 裡、最後一行才執行：下載中途斷線時不會執行到一半
& {
	$ErrorActionPreference = 'Stop'
	# 舊版 Windows PowerShell 預設可能沒開 TLS 1.2
	[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

	$skillUrl = if ($env:STEAMLOOM_SKILL_URL) { $env:STEAMLOOM_SKILL_URL } else { '{{SKILL_URL}}' }
	$utf8 = New-Object System.Text.UTF8Encoding($false)

	# 讀 SKILL.md frontmatter 的 version（metadata 底下的 version: "x.y.z"）；用 UTF-8 讀，避免中文被當成系統字碼頁
	function Get-SkillVersion([string]$path) {
		foreach ($line in [IO.File]::ReadAllLines($path, $utf8)) {
			if ($line -match '^  version: "(.*)"$') { return $Matches[1] }
		}
		return ''
	}

	# 比對版本後安裝，並移除同目錄下的舊版
	function Install-Skill([string]$label, [string]$skillsDir) {
		$dir = Join-Path $skillsDir '{{SKILL_NAME}}'
		Write-Host ('{0,-12} {1}' -f $label, $dir)
		$target = Join-Path $dir 'SKILL.md'
		$current = if (Test-Path $target) { Get-SkillVersion $target } else { '' }
		if ($current -eq $latest) {
			Write-Host "  - 已是最新版 v$latest，不用更新"
		} else {
			New-Item -ItemType Directory -Force -Path $dir | Out-Null
			Copy-Item -Force $tmp $target
			if ($current) { Write-Host "  √ 已從 v$current 更新到 v$latest" -ForegroundColor Green }
			else { Write-Host "  √ 已安裝 v$latest" -ForegroundColor Green }
		}

		$legacy = Join-Path $skillsDir '{{LEGACY_NAME}}'
		$legacyFile = Join-Path $legacy 'SKILL.md'
		if ((Test-Path $legacyFile) -and ([IO.File]::ReadAllLines($legacyFile, $utf8) -contains 'name: {{LEGACY_NAME}}')) {
			Remove-Item -Recurse -Force $legacy
			Write-Host "  √ 已移除舊版 $legacy" -ForegroundColor Green
		}
	}

	$tmp = [IO.Path]::GetTempFileName()
	try {
		try {
			Invoke-WebRequest -UseBasicParsing -Uri $skillUrl -OutFile $tmp
		} catch {
			Write-Host "! 下載 SKILL.md 失敗：$skillUrl" -ForegroundColor Yellow
			return
		}
		$latest = Get-SkillVersion $tmp
		if (-not $latest) {
			Write-Host "! 下載到的檔案不是 SteamLoom Skill：$skillUrl" -ForegroundColor Yellow
			return
		}

		Write-Host "SteamLoom Skill 安裝程式　最新版本 v$latest"
		Write-Host ''

		$home_ = $env:USERPROFILE
		$hasClaude = Test-Path (Join-Path $home_ '.claude')
		$hasCodex = (Test-Path (Join-Path $home_ '.codex')) -or (Test-Path (Join-Path $home_ '.agents'))
		if (-not $hasClaude -and -not $hasCodex) {
			Write-Host '! 沒有偵測到 Claude Code 或 Codex' -ForegroundColor Yellow
			Write-Host "  找不到 $home_\.claude，也找不到 $home_\.codex。"
			Write-Host '  先安裝 Claude Code 或 Codex 並啟動過一次，再重新執行這行指令。'
			return
		}

		foreach ($tool in @(
			@{ Found = $hasClaude; Label = 'Claude Code'; Dir = Join-Path $home_ '.claude\skills' },
			@{ Found = $hasCodex; Label = 'Codex'; Dir = Join-Path $home_ '.agents\skills' }
		)) {
			if ($tool.Found) { Install-Skill $tool.Label $tool.Dir }
			else { Write-Host $tool.Label; Write-Host "  - 沒有偵測到 $($tool.Label)，略過" -ForegroundColor DarkGray }
		}
		Write-Host ''
		Write-Host '完成。不用重啟，新版本會自動載入。'
	} finally {
		Remove-Item -Force -ErrorAction SilentlyContinue $tmp
	}
}
