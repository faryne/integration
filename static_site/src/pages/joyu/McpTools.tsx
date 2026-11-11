import { useState } from "react";
import { Box, Skeleton, Stack, Typography } from "@mui/material";

import { useMcpTools } from "@/apis/common/mcpTools.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { McpConnectGuide } from "@/components/common/mcp/McpConnectGuide.tsx";
import { McpToolCard } from "@/components/common/mcp/McpToolCard.tsx";
import {
  JOYU_MCP_ENDPOINT,
  JOYU_MCP_GROUPS,
  JOYU_MCP_HIDDEN_TOOLS,
  JOYU_MCP_NAME,
  JOYU_MCP_TOOL_META,
  type JoyuMcpGroup,
} from "@/data/joyuMcpTools.ts";
import { useTitle } from "@/helpers/title.tsx";

// 頁面直接向後端要工具清單；正式站與本機都走 API base 底下的 /joyu-mcp
const toolsEndpoint = `${import.meta.env.VITE_API_BASE}/joyu-mcp`;

const cardsSx = {
  alignItems: "start",
  display: "grid",
  gap: 1.5,
  gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
} as const;

/**
 * joyu.fyi MCP 工具頁（/mcp-tools）：連線網址、各 AI 服務的連線方式、工具列表。
 * 工具清單即時取自後端 tools/list，中文名稱與分組來自 data/joyuMcpTools.ts（沒有對照的進「其他」顯示英文描述）。
 * 不能放在 /mcp：nginx 會把 joyu.fyi/mcp 的所有請求轉給後端
 */
export function JoyuMcpTools() {
  useTitle("MCP 工具");
  const q = useMcpTools(toolsEndpoint);
  const [errorClosed, setErrorClosed] = useState(false);

  // 依對照表分組；ping 之類的測試工具不顯示
  const groups = new Map<
    JoyuMcpGroup,
    {
      tool: NonNullable<typeof q.data>[number];
      title: string;
      description: string;
    }[]
  >();
  for (const tool of q.data ?? []) {
    if (JOYU_MCP_HIDDEN_TOOLS.includes(tool.name)) continue;
    const meta = JOYU_MCP_TOOL_META[tool.name] ?? {
      group: "其他",
      title: tool.name,
      description: tool.description,
    };
    groups.set(meta.group, [
      ...(groups.get(meta.group) ?? []),
      { tool, ...meta },
    ]);
  }

  return (
    <Stack spacing={3.5} sx={{ maxWidth: 980, textAlign: "left" }}>
      <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
        MCP 工具
      </Typography>
      <McpConnectGuide endpoint={JOYU_MCP_ENDPOINT} name={JOYU_MCP_NAME} />

      <Box component="section">
        <Typography
          component="h2"
          sx={{ fontSize: 18, fontWeight: 800, mb: 1.5 }}
        >
          工具
        </Typography>
        {q.isPending ? (
          <Box sx={cardsSx}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} variant="rounded" sx={{ height: 120 }} />
            ))}
          </Box>
        ) : (
          <Stack spacing={2.5}>
            {JOYU_MCP_GROUPS.filter((g) => groups.has(g)).map((g) => (
              <Box key={g}>
                <Typography
                  component="h3"
                  sx={{
                    color: "text.secondary",
                    fontSize: 15,
                    fontWeight: 600,
                    mb: 1,
                  }}
                >
                  {g}
                </Typography>
                <Box sx={cardsSx}>
                  {groups.get(g)!.map(({ tool, title, description }) => (
                    <McpToolCard
                      description={description}
                      key={tool.name}
                      title={title}
                      tool={tool}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <CustomSnackbar
        message="工具清單讀取失敗，請稍後再試"
        onClose={() => setErrorClosed(true)}
        open={q.isError && !errorClosed}
        severity="error"
      />
    </Stack>
  );
}
