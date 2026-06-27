import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import HistoryIcon from "@mui/icons-material/History";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Pagination,
  Paper,
  Radio,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { formatStorytellerDate } from "@/data/storyteller.ts";

export interface StoryEditHistoryItem {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  words: number;
}

interface StoryEditHistoryProps {
  items: StoryEditHistoryItem[];
  loading?: boolean;
  leftVersionId: string;
  rightVersionId: string;
  comparePath: string;
  onLeftVersionChange: (versionId: string) => void;
  onRightVersionChange: (versionId: string) => void;
  isRightVersionDisabled?: (versionId: string) => boolean;
  newItemMessage?: string;
  helperMessage?: string;
  isNewItem?: boolean;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
}

export function StoryEditHistory({
  items,
  loading = false,
  leftVersionId,
  rightVersionId,
  comparePath,
  onLeftVersionChange,
  onRightVersionChange,
  isRightVersionDisabled,
  newItemMessage = "第一次存檔後才會產生編輯歷史。",
  helperMessage = "請依序選擇要比對的新舊版本後再按下「比對選取版本」",
  isNewItem = false,
  page = 1,
  pageCount = 1,
  onPageChange,
}: StoryEditHistoryProps) {
  if (isNewItem) {
    return (
      <Alert severity="info" variant="outlined">
        {newItemMessage}
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {loading && (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={24} />
        </Stack>
      )}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
      >
        <Typography color="text.secondary">
          選擇兩個版本後可以比對標題與 Markdown 內容差異。
        </Typography>
        <Button
          href={comparePath || undefined}
          disabled={!comparePath}
          variant="contained"
          startIcon={<CompareArrowsIcon />}
        >
          比對選取版本
        </Button>
      </Stack>

      {(!leftVersionId || !rightVersionId) && (
        <Alert severity="info" variant="outlined">
          {helperMessage}
        </Alert>
      )}

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 1 }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" align="center">
                舊
              </TableCell>
              <TableCell padding="checkbox" align="center">
                新
              </TableCell>
              <TableCell>版本</TableCell>
              <TableCell>來源</TableCell>
              <TableCell>字數</TableCell>
              <TableCell>建立時間</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.id}
                hover
                selected={
                  leftVersionId === item.id || rightVersionId === item.id
                }
              >
                <TableCell padding="checkbox">
                  <Radio
                    checked={leftVersionId === item.id}
                    onChange={() => onLeftVersionChange(item.id)}
                    inputProps={{
                      "aria-label": `選擇 ${item.id} 作為舊版本`,
                    }}
                  />
                </TableCell>
                <TableCell padding="checkbox">
                  <Radio
                    checked={rightVersionId === item.id}
                    disabled={
                      isRightVersionDisabled
                        ? isRightVersionDisabled(item.id)
                        : leftVersionId === item.id
                    }
                    onChange={() => onRightVersionChange(item.id)}
                    inputProps={{
                      "aria-label": `選擇 ${item.id} 作為新版本`,
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <HistoryIcon color="primary" />
                    <Stack spacing={0.5}>
                      <Typography fontWeight={800}>{item.title}</Typography>
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={item.source} />
                </TableCell>
                <TableCell>{item.words.toLocaleString()}</TableCell>
                <TableCell>{formatStorytellerDate(item.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {pageCount > 1 && onPageChange && (
        <Stack direction="row" justifyContent="center">
          <Pagination
            count={pageCount}
            page={page}
            onChange={(_, nextPage) => onPageChange(nextPage)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Stack>
      )}
    </Stack>
  );
}
