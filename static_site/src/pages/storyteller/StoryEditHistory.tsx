import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import RestoreIcon from "@mui/icons-material/Restore";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
  Tooltip,
  Typography,
} from "@mui/material";
import { formatStorytellerDate } from "@/data/storyteller.ts";

export interface StoryEditHistoryItem {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  words: number;
  // 這個版本是「回復到某個舊版本」產生的，帶那個來源版本的 id。
  revertedFromVersionId?: string | null;
  // 存檔當下 base_version_id 已經不是最新版本，帶當時真正最新的那個版本 id。
  conflictedWithVersionId?: string | null;
}

interface StoryEditHistoryProps {
  items: StoryEditHistoryItem[];
  // 「回復自」「衝突」chip 要顯示對方版本的建立時間，得從完整（未分頁）清單查，
  // 不然分到別頁的版本會查不到。不傳就退回用 items 自己查（可能查不到分頁外的版本）。
  allItems?: StoryEditHistoryItem[];
  loading?: boolean;
  leftVersionId: string;
  rightVersionId: string;
  onCompare: () => void;
  onLeftVersionChange: (versionId: string) => void;
  onRightVersionChange: (versionId: string) => void;
  isRightVersionDisabled?: (versionId: string) => boolean;
  newItemMessage?: string;
  helperMessage?: string;
  isNewItem?: boolean;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  // 不傳 onRevert 就不顯示「操作」這欄；currentVersionId 是目前真正最新的版本 id，
  // 那一列不會顯示回復按鈕（回復到自己沒有意義）。
  onRevert?: (versionId: string) => void;
  revertingVersionId?: string | null;
  currentVersionId?: string;
  // Agent（Skill）編輯歷史不需要「來源」欄——那格原本顯示的是版本存檔來源
  // （手動/自動/AI 助理），對 Skill prompt 版本沒有意義，預設仍顯示給
  // Story／Lore 編輯歷史用。
  showSourceColumn?: boolean;
}

export function StoryEditHistory({
  items,
  allItems,
  loading = false,
  leftVersionId,
  rightVersionId,
  onCompare,
  onLeftVersionChange,
  onRightVersionChange,
  isRightVersionDisabled,
  newItemMessage = "第一次存檔後才會產生編輯歷史。",
  helperMessage = "請依序選擇要比對的新舊版本後再按下「比對選取版本」",
  isNewItem = false,
  page = 1,
  pageCount = 1,
  onPageChange,
  onRevert,
  revertingVersionId,
  currentVersionId,
  showSourceColumn = true,
}: StoryEditHistoryProps) {
  if (isNewItem) {
    return (
      <Alert severity="info" variant="outlined">
        {newItemMessage}
      </Alert>
    );
  }

  const itemById = new Map((allItems ?? items).map((item) => [item.id, item]));
  // 版本號用建立順序編號（最舊 = 1），不是後端的 DB id——DB id 不連續、對使用者沒有意義，
  // 這個編號也不會因為之後新增/刪除版本而讓既有版本被重新編號（往前數，不是往後數）。
  const versionNumberById = new Map(
    [...(allItems ?? items)]
      .reverse()
      .map((item, index) => [item.id, index + 1]),
  );
  const describeReferencedVersion = (versionId: string) => {
    const seq = versionNumberById.get(versionId);
    return seq !== undefined ? `版本 #${seq}` : `版本 #${versionId}`;
  };
  const referencedVersionTooltip = (versionId: string) => {
    const referenced = itemById.get(versionId);
    return referenced
      ? `建立於 ${formatStorytellerDate(referenced.createdAt)}`
      : "";
  };

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
          onClick={onCompare}
          disabled={!leftVersionId || !rightVersionId}
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
              <TableCell align="center">版本號</TableCell>
              <TableCell>標題</TableCell>
              {showSourceColumn && <TableCell>來源</TableCell>}
              <TableCell>字數</TableCell>
              <TableCell>建立時間</TableCell>
              {onRevert && <TableCell align="center">操作</TableCell>}
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
                <TableCell align="center">
                  <Chip
                    size="small"
                    label={`#${versionNumberById.get(item.id) ?? item.id}`}
                  />
                </TableCell>
                <TableCell>
                  <Stack spacing={0.5}>
                    <Typography fontWeight={800}>{item.title}</Typography>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {item.revertedFromVersionId && (
                        <Tooltip
                          title={referencedVersionTooltip(
                            item.revertedFromVersionId,
                          )}
                        >
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`回復自${describeReferencedVersion(item.revertedFromVersionId)}`}
                          />
                        </Tooltip>
                      )}
                      {item.conflictedWithVersionId && (
                        <Tooltip
                          title={referencedVersionTooltip(
                            item.conflictedWithVersionId,
                          )}
                        >
                          <Chip
                            size="small"
                            color="warning"
                            variant="outlined"
                            label={`與${describeReferencedVersion(item.conflictedWithVersionId)}衝突`}
                          />
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                </TableCell>
                {showSourceColumn && (
                  <TableCell>
                    <Chip size="small" label={item.source} />
                  </TableCell>
                )}
                <TableCell>{item.words.toLocaleString()}</TableCell>
                <TableCell>{formatStorytellerDate(item.createdAt)}</TableCell>
                {onRevert && (
                  <TableCell align="center">
                    {item.id !== currentVersionId && (
                      <Tooltip title="回復到這個版本">
                        <span>
                          <IconButton
                            size="small"
                            disabled={revertingVersionId === item.id}
                            onClick={() => onRevert(item.id)}
                          >
                            {revertingVersionId === item.id ? (
                              <CircularProgress size={18} />
                            ) : (
                              <RestoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
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
