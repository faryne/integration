import { useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

// 各 AI 服務的連線方式（不需身分驗證的 MCP）：steps 是設定介面的操作步驟，code 是要貼的指令／設定。
// 指令格式同 SteamLoom（pages/storyteller/mcpClientSetup.ts）；選單名稱有變時改這裡
const guidesOf = (endpoint: string, name: string) => [
  {
    key: "claude",
    label: "Claude",
    steps: [
      "設定 › 連接器 › 新增自訂連接器",
      `名稱填 ${name}，網址貼上 ${endpoint}`,
    ],
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    steps: [
      "設定 › 應用程式與連接器 › 進階設定，開啟開發者模式",
      `建立連接器，網址貼上 ${endpoint}，驗證選「無」`,
      "新對話的 + 選單選這個連接器",
    ],
  },
  {
    key: "claude-code",
    label: "Claude Code",
    code: `claude mcp add --transport http ${name} ${endpoint}`,
  },
  {
    key: "codex",
    label: "Codex",
    code: `codex mcp add ${name} --url ${endpoint}`,
  },
  {
    key: "other",
    label: "其他",
    code: JSON.stringify(
      { mcpServers: { [name]: { url: endpoint } } },
      null,
      2,
    ),
  },
];

const boxSx = {
  bgcolor: "background.paper",
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  p: 1.5,
} as const;

/** MCP 連線說明：連線網址（可複製）＋各服務分頁。endpoint 是對外的連線網址、name 是建議的伺服器名稱 */
export function McpConnectGuide({
  endpoint,
  name,
}: {
  endpoint: string;
  name: string;
}) {
  const guides = guidesOf(endpoint, name);
  const [key, setKey] = useState(guides[0].key);
  const [snack, setSnack] = useState<"ok" | "fail">();
  const guide = guides.find((g) => g.key === key)!;
  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(
      () => setSnack("ok"),
      () => setSnack("fail"),
    );

  return (
    <Stack spacing={3}>
      <Box component="section">
        <Typography
          component="h2"
          sx={{ fontSize: 18, fontWeight: 800, mb: 1.5 }}
        >
          連線網址
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          sx={{ ...boxSx, alignItems: "center" }}
        >
          <Typography
            component="code"
            noWrap
            sx={{ flex: 1, fontFamily: "monospace", fontSize: 15 }}
          >
            {endpoint}
          </Typography>
          <Button
            onClick={() => copy(endpoint)}
            size="small"
            variant="contained"
          >
            複製
          </Button>
        </Stack>
      </Box>

      <Box component="section">
        <Typography
          component="h2"
          sx={{ fontSize: 18, fontWeight: 800, mb: 1.5 }}
        >
          連線方式
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.25 }}>
          {guides.map((g) => (
            <Chip
              clickable
              color={g.key === key ? "primary" : "default"}
              key={g.key}
              label={g.label}
              onClick={() => setKey(g.key)}
              variant={g.key === key ? "filled" : "outlined"}
            />
          ))}
        </Stack>
        <Box sx={{ ...boxSx, textAlign: "left" }}>
          {guide.steps ? (
            <Box
              component="ol"
              sx={{ fontSize: 14, lineHeight: 1.8, m: 0, pl: 2.5 }}
            >
              {guide.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </Box>
          ) : (
            // 複製按鈕放在指令下方，不蓋住可橫向捲動的長指令
            <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
              <Box
                component="pre"
                sx={{
                  alignSelf: "stretch",
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  fontSize: 13,
                  m: 0,
                  overflowX: "auto",
                  p: 1.25,
                }}
              >
                {guide.code}
              </Box>
              <Button
                onClick={() => copy(guide.code!)}
                size="small"
                variant="contained"
              >
                複製
              </Button>
            </Stack>
          )}
        </Box>
      </Box>

      <CustomSnackbar
        message={snack === "ok" ? "已複製" : "複製失敗，請手動選取"}
        onClose={() => setSnack(undefined)}
        open={!!snack}
        severity={snack === "ok" ? "success" : "error"}
      />
    </Stack>
  );
}
