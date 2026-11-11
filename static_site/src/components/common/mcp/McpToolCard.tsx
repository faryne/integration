import { useState } from "react";
import {
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import type { McpParamSchema, McpTool } from "@/apis/common/mcpTools.ts";

// 參數型別的顯示：enum 列出可選值，oneOf／anyOf（字串或陣列）統一寫成 string／array
const typeOf = (s: McpParamSchema) =>
  s.enum
    ? `enum（${s.enum.join("／")}）`
    : s.oneOf || s.anyOf
      ? "string／array"
      : (s.type ?? "");

/**
 * MCP 工具卡片：中文名稱、工具名稱、說明，參數表預設收合。
 * 參數說明直接用 schema 的英文原文（不另外翻譯，避免兩份不同步）；手機版隱藏「型別」欄
 */
export function McpToolCard({
  tool,
  title,
  description,
}: {
  tool: McpTool;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const params = Object.entries(tool.inputSchema.properties ?? {});
  const required = tool.inputSchema.required ?? [];
  const cellSx = { px: 0.75, py: 0.75, fontSize: 12, verticalAlign: "top" };
  const typeSx = { ...cellSx, display: { xs: "none", sm: "table-cell" } };

  return (
    <Stack
      spacing={0.75}
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 1.75,
        textAlign: "left",
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 800 }}>{title}</Typography>
      <Typography
        component="code"
        sx={{ color: "primary.main", fontFamily: "monospace", fontSize: 12 }}
      >
        {tool.name}
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: 13 }}>
        {description}
      </Typography>
      {params.length > 0 && (
        <Button
          onClick={() => setOpen((v) => !v)}
          size="small"
          sx={{ alignSelf: "flex-start", minWidth: 0, px: 0 }}
        >
          {open ? "收合參數" : `參數（${params.length}）`}
        </Button>
      )}
      {open && (
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={cellSx}>參數</TableCell>
                <TableCell sx={typeSx}>型別</TableCell>
                <TableCell sx={cellSx}>說明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {params.map(([name, s]) => (
                <TableRow key={name}>
                  <TableCell sx={{ ...cellSx, whiteSpace: "nowrap" }}>
                    <Box component="code" sx={{ fontFamily: "monospace" }}>
                      {name}
                    </Box>
                    {required.includes(name) && (
                      <Box
                        component="span"
                        sx={{ color: "primary.main", ml: 0.5 }}
                      >
                        必填
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={typeSx}>{typeOf(s)}</TableCell>
                  <TableCell sx={cellSx}>{s.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Stack>
  );
}
