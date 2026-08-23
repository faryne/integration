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

// 粗略費用估算用的單價表（美元／百萬 tokens）。供應商調整定價時需要手動更新這裡；
// 找不到對應模型時不用預設值瞎猜，直接不顯示費用，只呈現 token 數。
const modelPricingPerMillionTokens: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4.5": { input: 0.8, output: 4 },
  "grok-4": { input: 3, output: 15 },
  "gemini-2.5-pro": { input: 1.25, output: 5 },
};

function estimateCostUsd(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
) {
  const pricing = modelPricingPerMillionTokens[modelName];
  if (!pricing) {
    return null;
  }
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

interface TokenTotals {
  inputTokens: number;
  outputTokens: number;
}

// project／story／lore 這個粒度的分組可能混合多個不同 model 的用量（同一個
// story 可能先後用 Grok 又用 Claude），沒辦法像以前「一列一定只有一個
// model_name」那樣直接估算費用——費用估算只在最底層的單次執行明細
// （AgentUsageLogTable，每一列都還是單一 model_name）才準確、才顯示。
function sumTokens(
  rows: { input_tokens: number; output_tokens: number }[],
): TokenTotals {
  return rows.reduce<TokenTotals>(
    (acc, row) => {
      acc.inputTokens += row.input_tokens;
      acc.outputTokens += row.output_tokens;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0 },
  );
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
    () => sumTokens(groups.flatMap((group) => group.items)),
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
        系統記錄到的用量估算，並非供應商官方帳單金額。若同一把金鑰有在別處使用，或供應商計費方式與
        API 回傳的 usage
        有落差，金額會對不上。適合用來觀察相對用量與異常暴增，正式請款請以供應商後台為準。
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
  const keyTotals = useMemo(() => sumTokens(group.items), [group.items]);
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
        <Typography variant="body2" color="text.secondary">
          {(keyTotals.inputTokens + keyTotals.outputTokens).toLocaleString()}{" "}
          tokens
        </Typography>
      </Stack>
      <Collapse in={open}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>專案</TableCell>
                <TableCell align="right">輸入</TableCell>
                <TableCell align="right">輸出</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectGroups.map((projectGroup) => (
                <ProjectUsageRow
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

function ProjectUsageRow({
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
    () => sumTokens(projectGroup.items),
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
        <TableCell align="right">
          {projectTotals.inputTokens.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {projectTotals.outputTokens.toLocaleString()}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={3} sx={{ p: 0, bgcolor: "action.hover" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 5 }}>故事／設定集</TableCell>
                  <TableCell align="right">輸入</TableCell>
                  <TableCell align="right">輸出</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectGroup.items.map((item) => (
                  <StoryLoreUsageRow
                    key={`${item.story_id ?? "s"}-${item.lore_id ?? "l"}`}
                    item={item}
                    providerApiKeyId={providerApiKeyId}
                    month={month}
                  />
                ))}
              </TableBody>
            </Table>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function StoryLoreUsageRow({
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
        <TableCell sx={{ pl: 5 }}>
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
        <TableCell align="right">
          {item.input_tokens.toLocaleString()}
        </TableCell>
        <TableCell align="right">
          {item.output_tokens.toLocaleString()}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={3} sx={{ p: 0, bgcolor: "action.hover" }}>
            <AgentUsageLogTable
              providerApiKeyId={providerApiKeyId}
              storyId={item.story_id}
              loreId={item.lore_id}
              month={month}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

const usageLogPageSize = 20;

function AgentUsageLogTable({
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
      <Stack alignItems="center" sx={{ py: 2 }}>
        <CircularProgress size={20} />
      </Stack>
    );
  }

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        這個月沒有執行紀錄。
      </Typography>
    );
  }

  return (
    <Stack spacing={0}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 8 }}>時間</TableCell>
            <TableCell>Skill</TableCell>
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
          {items.map((row) => {
            const cost = estimateCostUsd(
              row.model_name,
              row.input_tokens,
              row.output_tokens,
            );
            return (
              <TableRow key={row.id}>
                <TableCell sx={{ pl: 8, color: "text.secondary" }}>
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell>{row.agent_name || "－"}</TableCell>
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
                  {cost === null ? "－" : formatUsd(cost)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="flex-end" sx={{ p: 1 }}>
          <Pagination
            size="small"
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
          />
        </Stack>
      )}
    </Stack>
  );
}
