import { storytellerVersionSourceLabel } from "@steamloom-web/data/storytellerVersionSource.ts";
import { Box, Chip, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { useTranslation } from "react-i18next";
import { backend, type DocumentItem } from "@/lib/backend.ts";
import { dateTimeFormat } from "@/lib/format.ts";
import { useBackendData } from "@/lib/useBackendData.ts";

// 編輯歷史分頁：先列出版本；比對差異與還原之後再做。
export function HistoryPanel({ project, item }: { project: string; item: DocumentItem }) {
  const { t } = useTranslation();
  const versions = useBackendData(() => backend.Versions(project, item.kind, item.public_id), [project, item.kind, item.public_id]);
  if (versions === null) return <CircularProgress size={24} sx={{ m: 4 }} />;
  // 版本號依建立順序從 1 開始編，列表新的在上
  const rows = [...(versions ?? [])].sort((a, b) => b.id - a.id);
  return (
    <Box sx={{ flex: 1, overflow: "auto" }}>
      <Table size="small" stickyHeader sx={{ maxWidth: 860 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t("workspace.history.version")}</TableCell>
            <TableCell>{t("workspace.history.source")}</TableCell>
            <TableCell align="right">{t("workspace.history.wordCount")}</TableCell>
            <TableCell>{t("workspace.history.createdAt")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((version, index) => (
            <TableRow key={version.id} hover>
              <TableCell sx={{ color: "text.secondary" }}>#{rows.length - index}</TableCell>
              <TableCell>
                {/* 外部工具（MCP／OAuth）寫入的版本用強調色標出來 */}
                <Chip
                  size="small"
                  variant="outlined"
                  color={version.source?.startsWith("mcp:") ? "primary" : "default"}
                  label={storytellerVersionSourceLabel(version.source)}
                />
              </TableCell>
              <TableCell align="right">{version.word_count.toLocaleString()}</TableCell>
              <TableCell>{dateTimeFormat.format(new Date(version.created_at))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
