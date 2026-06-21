import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ApiIcon from "@mui/icons-material/Api";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useEffect, useMemo, useState } from "react";
import { useCallMcpTool, useMcpTools } from "@/apis/tools/mcp.ts";
import { useTitle } from "@/helpers/title.tsx";
import type { McpSchema, McpTool } from "@/apis/tools/mcp.ts";
import type { FormEvent } from "react";

type FormValues = Record<string, string>;

function schemaType(schema?: McpSchema) {
  if (!schema) {
    return "unknown";
  }
  if (schema.type === "array" && schema.items?.type) {
    return `${schema.items.type}[]`;
  }
  return schema.type ?? "unknown";
}

function formatConstraints(schema: McpSchema) {
  const constraints: string[] = [];

  if (
    typeof schema.minItems === "number" ||
    typeof schema.maxItems === "number"
  ) {
    constraints.push(
      `長度 ${schema.minItems ?? 0} - ${schema.maxItems ?? "不限"}`,
    );
  }
  if (schema.enum?.length) {
    constraints.push(`可用值：${schema.enum.map(String).join(", ")}`);
  }
  if (schema.default !== undefined) {
    constraints.push(`預設：${String(schema.default)}`);
  }

  return constraints;
}

function parseFormValue(schema: McpSchema, value: string) {
  if (value.trim() === "") {
    return undefined;
  }

  switch (schema.type) {
    case "integer":
      return Number.parseInt(value, 10);
    case "number":
      return Number.parseFloat(value);
    case "boolean":
      return value === "true" || value === "1" || value.toLowerCase() === "yes";
    case "array":
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) =>
            schema.items?.type === "integer" ? Number.parseInt(item, 10) : item,
          );
      }
    case "object":
      return JSON.parse(value);
    case "string":
    default:
      return value;
  }
}

function buildArguments(tool: McpTool, values: FormValues) {
  const args: Record<string, unknown> = {};

  for (const [name, schema] of Object.entries(
    tool.inputSchema?.properties ?? {},
  )) {
    const parsed = parseFormValue(schema, values[name] ?? "");
    if (parsed !== undefined) {
      args[name] = parsed;
    }
  }

  return args;
}

function initialFormValues(tool?: McpTool) {
  if (!tool) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(tool.inputSchema?.properties ?? {}).map(([name, schema]) => {
      if (schema.default !== undefined) {
        return [name, String(schema.default)];
      }
      return [name, ""];
    }),
  );
}

function callPayload(tool: McpTool, values: FormValues) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: tool.name,
      arguments: buildArguments(tool, values),
    },
  };
}

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function ServerSetup() {
  const apiBase = String(import.meta.env.VITE_API_BASE ?? "");
  const endpoint =
    typeof window === "undefined"
      ? `${apiBase}/mcp`
      : `${apiBase || window.location.origin}/mcp`;
  const config = {
    mcpServers: {
      "faryne.dev": {
        url: endpoint,
      },
    },
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TerminalIcon color="primary" />
          <Typography component="h1" variant="h5" sx={{ fontWeight: 900 }}>
            加入 MCP server
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
          這個端點使用 HTTP JSON-RPC。將下列設定加入支援 remote MCP server 的
          client 後，即可透過 /mcp 呼叫本站工具。
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            overflowX: "auto",
            borderRadius: 1,
            bgcolor: "#101418",
            color: "#e9f4f4",
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          <code>{pretty(config)}</code>
        </Box>
        <Alert severity="info" variant="outlined">
          左側方法清單會從 tools/list 讀取並在瀏覽器端快取 1
          小時；切換方法或重新進入頁面時不會每次重新請求。
        </Alert>
      </Stack>
    </Paper>
  );
}

function ToolDetail({ tool }: { tool: McpTool }) {
  const properties = Object.entries(tool.inputSchema?.properties ?? {});
  const required = new Set(tool.inputSchema?.required ?? []);
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(tool),
  );
  const callTool = useCallMcpTool();
  const payload = useMemo(() => callPayload(tool, values), [tool, values]);

  useEffect(() => {
    setValues(initialFormValues(tool));
    callTool.reset();
  }, [tool.name]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    callTool.mutate({
      name: tool.name,
      arguments: buildArguments(tool, values),
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
      <Stack component="form" spacing={2.5} onSubmit={submit}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <ApiIcon color="primary" />
            <Typography component="h1" variant="h5" sx={{ fontWeight: 900 }}>
              {tool.name}
            </Typography>
          </Stack>
          {tool.description && (
            <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.8 }}>
              {tool.description}
            </Typography>
          )}
        </Box>

        <Divider />

        {properties.length === 0 ? (
          <Alert severity="info" variant="outlined">
            此方法不需要參數，直接送出即可預覽呼叫結果。
          </Alert>
        ) : (
          <Stack spacing={2}>
            {properties.map(([name, schema]) => {
              const constraints = formatConstraints(schema);
              const helperText = [
                schema.description || "此參數目前沒有額外說明。",
                constraints.join(" / "),
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <Box
                  key={name}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      md: "220px minmax(0, 1fr)",
                    },
                    gap: { xs: 1, md: 2 },
                    alignItems: "start",
                  }}
                >
                  <Stack spacing={0.75}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        sx={{ fontFamily: "monospace", fontWeight: 800 }}
                      >
                        {name}
                      </Typography>
                      {required.has(name) && (
                        <Chip label="必填" size="small" color="primary" />
                      )}
                    </Stack>
                    <Chip
                      label={schemaType(schema)}
                      size="small"
                      variant="outlined"
                      sx={{ alignSelf: "flex-start" }}
                    />
                  </Stack>
                  <TextField
                    fullWidth
                    size="small"
                    label={name}
                    value={values[name] ?? ""}
                    helperText={helperText}
                    multiline={
                      schema.type === "object" || schema.type === "array"
                    }
                    minRows={schema.type === "object" ? 4 : 1}
                    placeholder={
                      schema.type === "array"
                        ? "可輸入 JSON array 或用逗號分隔"
                        : undefined
                    }
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [name]: event.target.value,
                      }))
                    }
                  />
                </Box>
              );
            })}
          </Stack>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            type="submit"
            variant="contained"
            startIcon={
              callTool.isPending ? (
                <CircularProgress color="inherit" size={16} />
              ) : (
                <PlayArrowIcon />
              )
            }
            disabled={callTool.isPending}
          >
            呼叫並預覽結果
          </Button>
          <Button
            type="button"
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => navigator.clipboard.writeText(pretty(payload))}
          >
            複製呼叫 payload
          </Button>
        </Stack>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
            即將送出的 JSON-RPC payload
          </Typography>
          <CodeBlock value={pretty(payload)} />
        </Box>

        {callTool.isError && (
          <Alert severity="error" variant="outlined">
            呼叫失敗：{callTool.error.message}
          </Alert>
        )}

        {callTool.data && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>
              呼叫結果
            </Typography>
            <CodeBlock value={pretty(callTool.data)} />
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 2,
        overflowX: "auto",
        borderRadius: 1,
        bgcolor: "#101418",
        color: "#e9f4f4",
        fontSize: 13,
        lineHeight: 1.6,
      }}
    >
      <code>{value}</code>
    </Box>
  );
}

export default function McpToolsPage() {
  const tools = useMcpTools();
  const [selectedToolName, setSelectedToolName] = useState("");
  useTitle("MCP 方法列表", {
    path: "/tools/mcp",
    robots: "index, follow",
  });

  const selectedTool = useMemo(
    () => tools.data?.find((tool) => tool.name === selectedToolName),
    [selectedToolName, tools.data],
  );

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 5 } }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(280px, 0.42fr) 1fr" },
          gap: 3,
          alignItems: "start",
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            position: { lg: "sticky" },
            top: { lg: 88 },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              MCP 方法
            </Typography>
            <Typography variant="body2" color="text.secondary">
              tools/list client cache: 1 小時
            </Typography>
          </Box>
          <Divider />

          {tools.isLoading && (
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              sx={{ p: 2 }}
            >
              <CircularProgress size={20} />
              <Typography color="text.secondary">讀取中...</Typography>
            </Stack>
          )}

          {tools.isError && (
            <Alert severity="error" variant="outlined" sx={{ m: 2 }}>
              MCP 方法清單讀取失敗：{tools.error.message}
            </Alert>
          )}

          {tools.data && tools.data.length === 0 && (
            <Alert severity="info" variant="outlined" sx={{ m: 2 }}>
              目前後端沒有回傳任何 MCP 方法。
            </Alert>
          )}

          <List disablePadding>
            {tools.data?.map((tool) => {
              const properties = Object.keys(
                tool.inputSchema?.properties ?? {},
              );

              return (
                <ListItemButton
                  key={tool.name}
                  selected={selectedToolName === tool.name}
                  onClick={() => setSelectedToolName(tool.name)}
                  sx={{ alignItems: "flex-start", py: 1.5 }}
                >
                  <ListItemText
                    primary={
                      <Typography
                        sx={{ fontFamily: "monospace", fontWeight: 800 }}
                      >
                        {tool.name}
                      </Typography>
                    }
                    secondary={`${properties.length} 個參數`}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Paper>

        {selectedTool ? <ToolDetail tool={selectedTool} /> : <ServerSetup />}
      </Box>
    </Container>
  );
}
