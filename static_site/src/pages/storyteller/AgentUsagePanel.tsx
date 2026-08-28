import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useStorytellerAgentUsageLogs,
  useStorytellerAgentUsageSummary,
  useStorytellerProviderAPIKeys,
} from "@/apis/storyteller.ts";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import type { StorytellerAgentUsageSummaryRow } from "@/types/storyteller.ts";

const providerLabelMap: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  grok: "Grok",
  gemini: "Gemini",
};

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 每 token 單價數字很小（例如 0.00000125），toLocaleString
// 在這個範圍會切成科學記號不好讀，固定用小數點格式顯示、去掉多餘的尾端 0。
function formatPricePerToken(value: number) {
  return `$${value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "")}`;
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function recentMonthOptions(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) =>
    monthValue(new Date(now.getFullYear(), now.getMonth() - index, 1)),
  );
}

interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  // null 代表這些列裡沒有任何一筆抓得到價格快照（例如全部都是 self_hosted／
  // openrouter 自訂 model 名稱），不是「花費是 0 元」。
  costUsd: number | null;
}

function sumUsage(
  rows: {
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd?: number;
  }[],
): UsageTotals {
  let costUsd: number | null = null;
  const totals = rows.reduce(
    (acc, row) => {
      acc.inputTokens += row.input_tokens;
      acc.outputTokens += row.output_tokens;
      if (row.estimated_cost_usd !== undefined) {
        costUsd = (costUsd ?? 0) + row.estimated_cost_usd;
      }
      return acc;
    },
    { inputTokens: 0, outputTokens: 0 },
  );
  return { ...totals, costUsd };
}

interface KeyGroup {
  providerApiKeyId: number;
  provider: string;
  label: string;
  items: StorytellerAgentUsageSummaryRow[];
}

function groupByProviderAPIKey(
  rows: StorytellerAgentUsageSummaryRow[],
): KeyGroup[] {
  const groups = new Map<number, KeyGroup>();
  for (const row of rows) {
    let group = groups.get(row.provider_apikey_id);
    if (!group) {
      group = {
        providerApiKeyId: row.provider_apikey_id,
        provider: row.provider,
        label: row.provider_apikey_label,
        items: [],
      };
      groups.set(row.provider_apikey_id, group);
    }
    group.items.push(row);
  }
  return Array.from(groups.values());
}

interface ProjectGroup {
  projectId: number | null;
  projectName: string;
  items: StorytellerAgentUsageSummaryRow[];
}

// project_id 為 null 代表這筆用量記錄的 chat 關聯不到任何故事/設定集（例如對應
// 的 chat 已被刪除），另外歸一組顯示，不能直接漏掉這筆用量。
function groupByProject(rows: StorytellerAgentUsageSummaryRow[]): ProjectGroup[] {
  const groups = new Map<number, ProjectGroup>();
  const key = (projectId: number | null) => projectId ?? -1;
  for (const row of rows) {
    const groupKey = key(row.project_id);
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        projectId: row.project_id,
        projectName: row.project_name || "（無法歸屬到專案）",
        items: [],
      };
      groups.set(groupKey, group);
    }
    group.items.push(row);
  }
  return Array.from(groups.values());
}

export function StorytellerAgentUsagePanel() {
  const [month, setMonth] = useState(() => monthValue(new Date()));
  const [searchParams, setSearchParams] = useSearchParams();
  const filterApiKeyId = searchParams.get("apikey")
    ? Number(searchParams.get("apikey"))
    : null;

  const { data: rows = [], isLoading } = useStorytellerAgentUsageSummary(month);
  // 用來在篩選單一金鑰時顯示名稱；清單本身已經是後端依登入使用者過濾過的結果，
  // 所以就算網址列被人手動帶了別人的 id，這裡也查不到、不會洩漏內容。
  const { data: apiKeys = [] } = useStorytellerProviderAPIKeys();

  const allGroups = useMemo(() => groupByProviderAPIKey(rows), [rows]);
  const groups = useMemo(
    () =>
      filterApiKeyId === null
        ? allGroups
        : allGroups.filter(
            (group) => group.providerApiKeyId === filterApiKeyId,
          ),
    [allGroups, filterApiKeyId],
  );
  const totals = useMemo(
    () => sumUsage(groups.flatMap((group) => group.items)),
    [groups],
  );

  const filteredApiKey =
    filterApiKeyId === null
      ? undefined
      : apiKeys.find((apiKey) => apiKey.id === filterApiKeyId);

  function clearApiKeyFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete("apikey");
    setSearchParams(next, { replace: true });
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1.5}
      >
        <Typography variant="h6" fontWeight={800}>
          API Key 用量報表
        </Typography>
        <TextField
          select
          size="small"
          label="月份"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          sx={{ minWidth: 160 }}
        >
          {recentMonthOptions().map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Alert severity="warning" variant="outlined">
        以下數字為 {STORYTELLER_APP_NAME}
        系統記錄到的用量估算，正式請款請以供應商後台為準。
      </Alert>

      {filterApiKeyId !== null && (
        <Alert
          severity="info"
          variant="outlined"
          action={
            <Button size="small" onClick={clearApiKeyFilter}>
              顯示全部金鑰
            </Button>
          }
        >
          {filteredApiKey
            ? `僅顯示「${filteredApiKey.label || "（未命名）"}」這把金鑰的用量`
            : "找不到這把金鑰，可能已被刪除或不屬於你的帳號"}
        </Alert>
      )}

      <Grid container spacing={1.5}>
        <SummaryCard label="使用中金鑰" value={`${groups.length} 把`} />
        <SummaryCard
          label="輸入 tokens"
          value={totals.inputTokens.toLocaleString()}
        />
        <SummaryCard
          label="輸出 tokens"
          value={totals.outputTokens.toLocaleString()}
        />
        <SummaryCard
          label="估算總費用"
          value={totals.costUsd === null ? "－" : formatUsd(totals.costUsd)}
        />
      </Grid>

      {isLoading ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={28} />
        </Stack>
      ) : groups.length === 0 ? (
        <Alert severity="info" variant="outlined">
          {filterApiKeyId !== null
            ? "這把金鑰這個月沒有用量紀錄。"
            : "這個月沒有用量紀錄。"}
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {groups.map((group) => (
            <KeyUsageCard
              key={group.providerApiKeyId}
              group={group}
              month={month}
              defaultOpen={filterApiKeyId !== null}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 6, md: 3 }}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={500}>
          {value}
        </Typography>
      </Paper>
    </Grid>
  );
}

// 整個 Key 底下只有一張表、一個 <TableHead>——輸入／輸出／估算費用欄位不管是
// 專案彙總列、故事/設定集彙總列、還是最底層單次執行明細列，全部是同一張表裡的
// TableRow，天然共用同一組欄寬，不需要像三個各自獨立巢狀 <Table> 那樣另外做
// 對齊處理。專案／故事列沒有 Skill／模型／估算費用可顯示的地方，一律印「－」。
const usageLogPageSize = 20;
const usageTableColumnCount = 5;

function KeyUsageCard({
  group,
  month,
  defaultOpen = false,
}: {
  group: KeyGroup;
  month: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const keyTotals = useMemo(() => sumUsage(group.items), [group.items]);
  const projectGroups = useMemo(() => groupByProject(group.items), [group.items]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ p: 1.5, cursor: "pointer" }}
        onClick={() => setOpen((value) => !value)}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ minWidth: 0 }}
        >
          <IconButton size="small" disableRipple>
            <ExpandMoreIcon
              fontSize="small"
              sx={{
                transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 0.15s",
              }}
            />
          </IconButton>
          <Chip
            size="small"
            label={providerLabelMap[group.provider] ?? group.provider}
          />
          <Typography noWrap>{group.label || "（未命名）"}</Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="baseline">
          <Typography variant="body2" color="text.secondary">
            {(
              keyTotals.inputTokens + keyTotals.outputTokens
            ).toLocaleString()}{" "}
            tokens
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {keyTotals.costUsd === null ? "－" : formatUsd(keyTotals.costUsd)}
          </Typography>
        </Stack>
      </Stack>
      <Collapse in={open}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>項目</TableCell>
                <TableCell
                  sx={{ fontFamily: "monospace", fontSize: 12 }}
                >
                  模型
                </TableCell>
                <TableCell align="right">輸入</TableCell>
                <TableCell align="right">輸出</TableCell>
                <TableCell align="right">估算費用</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectGroups.map((projectGroup) => (
                <ProjectUsageRows
                  key={projectGroup.projectId ?? "none"}
                  projectGroup={projectGroup}
                  providerApiKeyId={group.providerApiKeyId}
                  month={month}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
}

function ProjectUsageRows({
  projectGroup,
  providerApiKeyId,
  month,
}: {
  projectGroup: ProjectGroup;
  providerApiKeyId: number;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const projectTotals = useMemo(
    () => sumUsage(projectGroup.items),
    [projectGroup.items],
  );

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: "pointer" }}
        onClick={() => setOpen((value) => !value)}
      >
        <TableCell>
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              verticalAlign: "middle",
              mr: 0.5,
              color: "text.disabled",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.15s",
            }}
          />
          {projectGroup.projectName}
        </TableCell>
        <TableCell>－</TableCell>
        <TableCell align="right">
          {projectTotals.inputTokens.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {projectTotals.outputTokens.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {projectTotals.costUsd === null
            ? "－"
            : formatUsd(projectTotals.costUsd)}
        </TableCell>
      </TableRow>
      {open &&
        projectGroup.items.map((item) => (
          <StoryLoreUsageRows
            key={`${item.story_id ?? "s"}-${item.lore_id ?? "l"}`}
            item={item}
            providerApiKeyId={providerApiKeyId}
            month={month}
          />
        ))}
    </>
  );
}

function StoryLoreUsageRows({
  item,
  providerApiKeyId,
  month,
}: {
  item: StorytellerAgentUsageSummaryRow;
  providerApiKeyId: number;
  month: string;
}) {
  const [open, setOpen] = useState(false);
  const title =
    item.story_title || item.lore_title || "（無法歸屬到故事／設定集）";

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: "pointer" }}
        onClick={() => setOpen((value) => !value)}
      >
        <TableCell sx={{ pl: 4 }}>
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              verticalAlign: "middle",
              mr: 0.5,
              color: "text.disabled",
              transform: open ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.15s",
            }}
          />
          {title}
        </TableCell>
        <TableCell>－</TableCell>
        <TableCell align="right">
          {item.input_tokens.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {item.output_tokens.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {item.estimated_cost_usd === undefined
            ? "－"
            : formatUsd(item.estimated_cost_usd)}
        </TableCell>
      </TableRow>
      {open && (
        <AgentUsageLogRows
          providerApiKeyId={providerApiKeyId}
          storyId={item.story_id}
          loreId={item.lore_id}
          month={month}
        />
      )}
    </>
  );
}

function AgentUsageLogRows({
  providerApiKeyId,
  storyId,
  loreId,
  month,
}: {
  providerApiKeyId: number;
  storyId: number | null;
  loreId: number | null;
  month: string;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useStorytellerAgentUsageLogs(
    providerApiKeyId,
    storyId,
    loreId,
    month,
    page,
    usageLogPageSize,
  );
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / usageLogPageSize));

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={usageTableColumnCount} align="center" sx={{ py: 2 }}>
          <CircularProgress size={18} />
        </TableCell>
      </TableRow>
    );
  }

  if (items.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={usageTableColumnCount}
          sx={{ pl: 8, color: "text.secondary" }}
        >
          這個月沒有執行紀錄。
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {items.map((row) => {
        const cost = row.estimated_cost_usd ?? null;
        return (
          <TableRow key={row.id}>
            <TableCell sx={{ pl: 8, color: "text.secondary" }}>
              {new Date(row.created_at).toLocaleString()}
            </TableCell>
            <TableCell
              sx={{
                fontFamily: "monospace",
                fontSize: 12,
                color: "text.secondary",
              }}
            >
              {row.model_name}
            </TableCell>
            <TableCell align="right">
              {row.input_tokens.toLocaleString()}
            </TableCell>
            <TableCell align="right">
              {row.output_tokens.toLocaleString()}
            </TableCell>
            <TableCell align="right">
              {cost === null ||
              row.input_token_price_usd === undefined ||
              row.output_token_price_usd === undefined ? (
                "－"
              ) : (
                <Tooltip
                  title={`${row.input_tokens.toLocaleString()}×${formatPricePerToken(row.input_token_price_usd)} + ${row.output_tokens.toLocaleString()}×${formatPricePerToken(row.output_token_price_usd)}`}
                >
                  <span>{formatUsd(cost)}</span>
                </Tooltip>
              )}
            </TableCell>
          </TableRow>
        );
      })}
      {totalPages > 1 && (
        <TableRow>
          <TableCell colSpan={usageTableColumnCount} sx={{ p: 1 }}>
            <Stack direction="row" justifyContent="flex-end">
              <Pagination
                size="small"
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
              />
            </Stack>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
