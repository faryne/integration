import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface McpSchema {
  type?: string;
  description?: string;
  items?: McpSchema;
  properties?: Record<string, McpSchema>;
  required?: string[];
  minItems?: number;
  maxItems?: number;
  enum?: Array<string | number | boolean | null>;
  default?: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: McpSchema;
}

interface McpToolsListResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    tools: McpTool[];
  };
  error?: {
    code: number;
    message: string;
  };
}

const mcpToolsCacheKey = "faryne:mcp:tools";
const mcpToolsCacheMaxAgeMs = 1000 * 60 * 60;
const mcpToolsCacheGcMs = 1000 * 60 * 60 * 24;

interface McpCallToolResponse {
  jsonrpc: "2.0";
  id: number;
  result?: {
    content: Array<{
      type: string;
      text?: string;
    }>;
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

function readCachedTools() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(mcpToolsCacheKey);
    if (!raw) {
      return undefined;
    }

    const cached = JSON.parse(raw) as {
      updatedAt: number;
      tools: McpTool[];
    };
    if (Date.now() - cached.updatedAt > mcpToolsCacheMaxAgeMs) {
      return undefined;
    }

    return cached;
  } catch {
    return undefined;
  }
}

function writeCachedTools(tools: McpTool[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      mcpToolsCacheKey,
      JSON.stringify({
        updatedAt: Date.now(),
        tools,
      }),
    );
  } catch {
    // localStorage can fail in private browsing or when storage is full.
  }
}

export function useMcpTools() {
  const cached = readCachedTools();

  return useQuery({
    queryKey: ["mcp", "tools"],
    initialData: cached?.tools,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: mcpToolsCacheMaxAgeMs,
    gcTime: mcpToolsCacheGcMs,
    queryFn: async () => {
      const response = await axios.post<McpToolsListResponse>(
        `${import.meta.env.VITE_API_BASE ?? ""}/mcp`,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const tools = response.data.result?.tools ?? [];
      writeCachedTools(tools);

      return tools;
    },
  });
}

export function useCallMcpTool() {
  return useMutation({
    mutationFn: async (input: {
      name: string;
      arguments: Record<string, unknown>;
    }) => {
      const response = await axios.post<McpCallToolResponse>(
        `${import.meta.env.VITE_API_BASE ?? ""}/mcp`,
        {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: input,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
        },
      );

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    },
  });
}
