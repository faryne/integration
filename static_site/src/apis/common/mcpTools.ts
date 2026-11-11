import axios from "axios";
import { useQuery } from "@tanstack/react-query";

/** MCP tools/list 回傳的單一工具（只取頁面需要的欄位） */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    properties?: Record<string, McpParamSchema>;
    required?: string[];
  };
}

export interface McpParamSchema {
  type?: string;
  enum?: string[];
  oneOf?: unknown[];
  anyOf?: unknown[];
  description?: string;
}

// 工具清單很少變，同一個瀏覽階段內不用重抓
const MCP_TOOLS_STALE_TIME = 60 * 60 * 1000;

/**
 * 向 MCP endpoint 要工具清單（JSON-RPC tools/list）。後端是無狀態的，不用先 initialize、也不用登入；
 * endpoint 傳後端路徑（例：`${VITE_API_BASE}/joyu-mcp`），正式站與本機都走 API base
 */
export function useMcpTools(endpoint: string) {
  return useQuery({
    queryKey: ["mcp-tools", endpoint],
    queryFn: async () =>
      (
        await axios.post<{ result: { tools: McpTool[] } }>(endpoint, {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        })
      ).data.result.tools,
    staleTime: MCP_TOOLS_STALE_TIME,
  });
}
