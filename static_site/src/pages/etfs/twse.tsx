import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useDeferredValue,
  useCallback,
} from "react";
import {
  Alert,
  Grid,
  Typography,
  Box,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  TableContainer,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Tabs,
  Tab,
  Chip,
  Stack,
  Button,
  useTheme,
  Divider,
  Container,
  TableSortLabel,
  CircularProgress,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Snackbar,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FilterListIcon from "@mui/icons-material/FilterList";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import DensitySmallIcon from "@mui/icons-material/DensitySmall";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ShareIcon from "@mui/icons-material/Share";
import ApexCharts from "apexcharts/candlestick";
import { useTitle } from "@/helpers/title.tsx";
import {
  useGetTwseEtfCodeList,
  useGetTwseEtfExInfo,
  useGetTwseEtfInfo,
  useGetTwseEtfTicker,
} from "@/apis/opendata/twse_etf.ts";
import type { TwseEtfInfo, TwseEtfShare } from "@/types/etf.ts";
import dayjs from "dayjs";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { shareUrl } from "@/helpers/share.ts";
import { DetailDialog } from "@/components/common/DetailDialog.tsx";

const filters = [
  { label: "全部", value: "ALL" },
  { label: "槓桿 - 正 (L)", value: "LEVERAGED_POS" },
  { label: "槓桿 - 反 (R)", value: "LEVERAGED_NEG" },
  { label: "債券型 (B)", value: "BOND" },
  { label: "外幣交易 (K)", value: "FOREIGN_CURR" },
  { label: "主動式 (A)", value: "ACTIVE" },
  { label: "主動式債券 (D)", value: "ACTIVE_BOND" },
  { label: "外幣計價債券 (C)", value: "FOREIGN_CURR_BOND" },
  { label: "外幣槓桿 ETF (M)", value: "FOREIGN_CURR_LEVERAGED_POS" },
  { label: "外幣反向 (S)", value: "FOREIGN_CURR_LEVERAGED_NEG" },
  { label: "期貨型 (U)", value: "FUTURE" },
  { label: "外幣期貨 (V)", value: "FOREIGN_CURR_FUTURE" },
  { label: "多資產/平衡 (T)", value: "MULTI_ASSET" },
];

const dateTabs = [
  { label: "今日", offsetDays: 0 },
  { label: "明日", offsetDays: 1 },
  { label: "後天", offsetDays: 2 },
  { label: "一星期後", offsetDays: 7 },
  { label: "兩星期後", offsetDays: 14 },
];

type EtfCategory =
  | "ALL"
  | "LEVERAGED_POS"
  | "LEVERAGED_NEG"
  | "BOND"
  | "ACTIVE"
  | "FOREIGN_CURR"
  | "ACTIVE_BOND"
  | "FOREIGN_CURR_BOND"
  | "FOREIGN_CURR_LEVERAGED_POS"
  | "FOREIGN_CURR_LEVERAGED_NEG"
  | "FUTURE"
  | "FOREIGN_CURR_FUTURE"
  | "MULTI_ASSET";

// 定義有哪些策略套餐
type StrategyType =
  | "all"
  | "high_win_rate"
  | "fast_fill"
  | "veteran" // 好策略
  | "loser_leak"
  | "eternal_wait"
  | "rookie_trap" // 這是糞策略
  | "low_rebound"
  | "trend_strength"
  | "overheat_warning"
  | "ma_balance";

// 允許排序的欄位型態
type OrderableField =
  | "code"
  | "ex_date"
  | "share"
  | "total_ex_count"
  | "success_fill_count"
  | "win_rate"
  | "avg_fill_days"
  | "latest_close"
  | "ma5"
  | "ma20"
  | "range_position"
  | "ma20_bias_rate";
type OrderableSort = "asc" | "desc";
type TableDensity = "compact" | "full";
type TickerViewMode = "chart" | "table";

const strategyOptions: {
  value: StrategyType;
  label: string;
  description: string;
  color?: "primary" | "success" | "error" | "warning" | "secondary";
  icon?: React.ReactElement;
}[] = [
  {
    value: "all",
    label: "全部 ETF",
    description: "不套用數據策略篩選。",
    color: "primary",
  },
  {
    value: "high_win_rate",
    label: "🔥 填息王 (勝率 > 85%)",
    description: "歷史填息勝率大於等於 85%。",
    color: "success",
    icon: <WorkspacePremiumIcon fontSize="small" />,
  },
  {
    value: "fast_fill",
    label: "⚡ 閃電填息 (平均 < 20天)",
    description: "平均填息天數大於 0 且小於等於 20 天。",
    color: "error",
  },
  {
    value: "veteran",
    label: "🏆 老牌穩健 (配息 > 15次)",
    description: "歷史除息次數大於等於 15 次。",
    color: "warning",
  },
  {
    value: "loser_leak",
    label: "🤡 貼息大師 (勝率 < 50%)",
    description: "有除息紀錄，且歷史填息勝率小於等於 50%。",
    color: "secondary",
  },
  {
    value: "eternal_wait",
    label: "⏳ 望穿秋水 (填息超慢 > 90天)",
    description: "平均填息天數大於等於 90 天。",
    color: "secondary",
  },
  {
    value: "rookie_trap",
    label: "👶 菜雞韭菜卡 (配息 < 2次)",
    description: "有除息紀錄，但歷史除息次數小於等於 2 次，樣本數偏少。",
  },
  {
    value: "low_rebound",
    label: "📉 低位反彈 (低檔且低於 MA20)",
    description: "月區間位置小於等於 25%，且 MA20 乖離率小於等於 -3%。",
    color: "success",
  },
  {
    value: "trend_strength",
    label: "📈 趨勢偏強 (MA5 > MA20 且位置偏高)",
    description: "MA5 高於 MA20，且月區間位置大於等於 60%。",
    color: "primary",
  },
  {
    value: "overheat_warning",
    label: "⚠️ 過熱警戒 (高檔且偏離 MA20)",
    description: "月區間位置大於等於 85%，且 MA20 乖離率大於等於 5%。",
    color: "warning",
  },
  {
    value: "ma_balance",
    label: "⚖️ 均線收斂 (接近 MA20)",
    description: "MA20 乖離率介於 -1.5% 到 1.5%，價格接近中期均線。",
    color: "secondary",
  },
];

const isEtfCategory = (value: string | null): value is EtfCategory =>
  !!value && filters.some((filter) => filter.value === value);

const isStrategyType = (value: string | null): value is StrategyType =>
  !!value && strategyOptions.some((strategy) => strategy.value === value);

const matchesStrategy = (strategy: StrategyType, etf: TwseEtfInfo) => {
  switch (strategy) {
    case "high_win_rate":
      return etf.win_rate >= 85.0;
    case "fast_fill":
      return etf.avg_fill_days > 0 && etf.avg_fill_days <= 20.0;
    case "veteran":
      return etf.total_ex_count >= 15;
    case "loser_leak":
      return etf.total_ex_count > 0 && etf.win_rate <= 50.0;
    case "eternal_wait":
      return etf.avg_fill_days >= 90.0;
    case "rookie_trap":
      return etf.total_ex_count > 0 && etf.total_ex_count <= 2;
    case "low_rebound":
      return etf.range_position > 0 && etf.range_position <= 25 && etf.ma20_bias_rate <= -3;
    case "trend_strength":
      return etf.ma5 > 0 && etf.ma20 > 0 && etf.ma5 > etf.ma20 && etf.range_position >= 60;
    case "overheat_warning":
      return etf.range_position >= 85 && etf.ma20_bias_rate >= 5;
    case "ma_balance":
      return etf.ma20 > 0 && Math.abs(etf.ma20_bias_rate) <= 1.5;
    default:
      return true;
  }
};

const matchesCategory = (category: EtfCategory, code: string) => {
  switch (category) {
    case "LEVERAGED_POS":
      return code.endsWith("L");
    case "LEVERAGED_NEG":
      return code.endsWith("R");
    case "BOND":
      return code.endsWith("B");
    case "FOREIGN_CURR":
      return code.endsWith("K");
    case "ACTIVE":
      return code.endsWith("A");
    case "ACTIVE_BOND":
      return code.endsWith("D");
    case "FOREIGN_CURR_BOND":
      return code.endsWith("C");
    case "FOREIGN_CURR_LEVERAGED_POS":
      return code.endsWith("M");
    case "FOREIGN_CURR_LEVERAGED_NEG":
      return code.endsWith("S");
    case "FUTURE":
      return code.endsWith("U");
    case "FOREIGN_CURR_FUTURE":
      return code.endsWith("V");
    case "MULTI_ASSET":
      return code.endsWith("T");
    default:
      return true;
  }
};

const matchesTerm = (etf: TwseEtfInfo, term: string) => {
  if (!term) return true;
  return (
    etf.code.toLowerCase().includes(term) ||
    etf.name.toLowerCase().includes(term) ||
    (etf.company?.toLowerCase().includes(term) ?? false) ||
    (etf.target?.toLowerCase().includes(term) ?? false)
  );
};

const formatDateOrDash = (value?: string) => {
  if (!value) return "--";
  const formatted = dayjs(value).format("YYYY-MM-DD");
  return formatted !== "0001-01-01" &&
    formatted !== "1900-01-01" &&
    formatted !== "Invalid Date"
    ? formatted
    : "--";
};

const getWinRateTone = (winRate: number) => {
  if (winRate >= 85) return "success.main";
  if (winRate > 0 && winRate <= 50) return "error.main";
  return "text.primary";
};

const getAvgFillStatus = (days: number) => {
  if (days > 0 && days <= 20) {
    return { label: "快", color: "success" as const };
  }
  if (days >= 90) {
    return { label: "慢", color: "warning" as const };
  }
  return null;
};

const getRecordStatus = (count: number) => {
  if (count > 0 && count <= 2) {
    return { label: "資料不足", color: "default" as const };
  }
  if (count >= 15) {
    return { label: "樣本多", color: "primary" as const };
  }
  return null;
};

const hasMA20BiasRisk = (biasRate: number) =>
  biasRate !== 0 && Math.abs(biasRate) >= 5;

const getSortValue = (etf: TwseEtfInfo, field: OrderableField) => {
  if (field === "code") {
    return etf.code;
  }

  if (field === "ex_date") {
    const value = formatDateOrDash(etf.ex_date);
    return value === "--" ? 0 : dayjs(value).valueOf();
  }

  return Number(etf[field]) || 0;
};

const formatSignedPercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toFixed(2)}%`;
};

const formatDecimal = (value?: number | null, digits = 2) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toFixed(digits);
};

const formatInteger = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return Math.round(value).toLocaleString("zh-TW");
};

const averageClose = <T extends { close: number }>(rows: T[]) => {
  if (rows.length === 0) return null;
  return rows.reduce((sum, row) => sum + row.close, 0) / rows.length;
};

const rangePositionByClose = <T extends { close: number }>(rows: T[]) => {
  if (rows.length === 0) return null;

  const latest = rows[rows.length - 1];
  const closes = rows.map((row) => row.close);
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const range = high - low;

  if (range <= 0) {
    return 0;
  }
  return ((latest.close - low) / range) * 100;
};

const StatPill = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) => (
  <Box
    sx={{
      minWidth: { xs: "calc(50% - 8px)", sm: 150 },
      flex: { xs: "1 1 calc(50% - 8px)", sm: "0 1 auto" },
      border: "1px solid",
      borderColor: "rgba(25, 118, 210, 0.18)",
      bgcolor: "rgba(255, 255, 255, 0.78)",
      borderRadius: 2,
      px: 2,
      py: 1.25,
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", fontWeight: 700 }}
    >
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
      {value}
    </Typography>
    {helper && (
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {helper}
      </Typography>
    )}
  </Box>
);

const DetailStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) => (
  <Box
    sx={{
      border: "1px solid",
      borderColor: "divider",
      borderRadius: 2,
      p: 1.5,
      bgcolor: "background.paper",
      minWidth: { xs: "calc(50% - 8px)", sm: 132 },
      flex: "1 1 132px",
    }}
  >
    <Typography
      variant="caption"
      sx={{ color: "text.secondary", fontWeight: 800 }}
    >
      {label}
    </Typography>
    <Typography
      variant="h6"
      sx={{ fontWeight: 900, lineHeight: 1.2, color: tone ?? "text.primary" }}
    >
      {value}
    </Typography>
  </Box>
);

const EtfDetailSummary = ({ etf }: { etf: TwseEtfInfo }) => (
  <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mb: 2 }}>
    <DetailStat label="總除息次數" value={etf.total_ex_count || "--"} />
    <DetailStat label="成功填息" value={etf.success_fill_count || "--"} />
    <DetailStat
      label="勝率"
      value={etf.win_rate > 0 ? `${etf.win_rate}%` : "--"}
      tone={getWinRateTone(etf.win_rate)}
    />
    <DetailStat label="平均填息日" value={etf.avg_fill_days || "--"} />
    <DetailStat label="最近除息日" value={formatDateOrDash(etf.ex_date)} />
  </Stack>
);

const FooterDisclaimer = () => {
  return (
    <Box
      component="footer"
      sx={{ mt: 8, pb: 4, bgcolor: "background.default" }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            color: "text.secondary",
          }}
        >
          <WarningAmberIcon
            fontSize="small"
            sx={{ mt: 0.3, color: "warning.main" }}
          />
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: "bold", mb: 1, color: "text.primary" }}
            >
              警語與免責聲明 / Disclaimer
            </Typography>

            <Typography
              variant="caption"
              display="block"
              sx={{ lineHeight: 1.6, mb: 1.5 }}
            >
              本站所有資料僅供參考，不構成任何投資建議、買賣邀約或要約之引緻。本站所載之填息天數、勝率等歷史統計數據，係基於歷史股價與配息紀錄計算之結果，
              <strong>歷史績效不保證未來獲利</strong>
              。投資人進行投資前，應自行評估風險、審慎考量並自負投資損益。本站盡力確保資料之正確性，惟對資料之即時性、完整性或錯誤不負任何法律責任。
            </Typography>

            <Typography
              variant="caption"
              display="block"
              sx={{ lineHeight: 1.6, fontStyle: "italic" }}
            >
              All information provided on this website is for informational
              purposes only and does not constitute investment advice, financial
              planning, or a solicitation to buy or sell any securities.
              Historical performance, including calculated win rates and fill
              days, is based on past data and
              <strong> is not indicative of future results</strong>. Investors
              should conduct their own research, assess risks carefully, and
              assume full responsibility for their investment decisions. While
              we strive to ensure data accuracy, we accept no liability for any
              errors, omissions, or delays in the data.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

const EtfDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { code } = useParams<{ code?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const querySuffix = queryString ? `?${queryString}` : "";

  // 狀態管理
  const [searchTerm, setSearchTerm] = useState(
    () => searchParams.get("q") ?? "",
  ); // 搜尋關鍵字
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [tabValue, setTabValue] = useState(0);
  const [dialogTabValue, setDialogTabValue] = useState(0);
  const [category, setCategory] = useState<EtfCategory>(() => {
    const value = searchParams.get("category");
    return isEtfCategory(value) ? value : "ALL";
  });
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>(() => {
    const value = searchParams.get("strategy");
    return isStrategyType(value) ? value : "all";
  });
  const [tableDensity, setTableDensity] = useState<TableDensity>("full");
  const [shareNotice, setShareNotice] = useState("");
  const routeCode = code?.trim().toUpperCase() ?? "";

  const query = useGetTwseEtfCodeList();
  const allEtfs = query.data?.data ?? [];

  const etfByCode = useMemo(
    () => new Map(allEtfs.map((etf) => [etf.code, etf])),
    [allEtfs],
  );
  const selectedEtf = routeCode ? (etfByCode.get(routeCode) ?? null) : null;
  const isInvalidRouteCode = !!routeCode && query.isSuccess && !selectedEtf;
  const queryShares = useGetTwseEtfInfo(selectedEtf?.code ?? "");
  useTitle(
    isInvalidRouteCode
      ? `找不到 ETF - ${routeCode}`
      : selectedEtf
        ? `ETF 投資導航 - ${selectedEtf.code} ${selectedEtf.name}`
        : "ETF 投資導航",
  );

  const dateTabValues = useMemo(
    () =>
      dateTabs.map((tab) => ({
        ...tab,
        date: dayjs().add(tab.offsetDays, "day"),
      })),
    [],
  );

  useEffect(() => {
    const nextSearchTerm = searchParams.get("q") ?? "";
    const nextCategory = searchParams.get("category");
    const nextStrategy = searchParams.get("strategy");

    setSearchTerm((current) =>
      current === nextSearchTerm ? current : nextSearchTerm,
    );
    setCategory((current) => {
      const value = isEtfCategory(nextCategory) ? nextCategory : "ALL";
      return current === value ? current : value;
    });
    setSelectedStrategy((current) => {
      const value = isStrategyType(nextStrategy) ? nextStrategy : "all";
      return current === value ? current : value;
    });
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const normalizedSearchTerm = searchTerm.trim();

    if (normalizedSearchTerm) {
      next.set("q", normalizedSearchTerm);
    } else {
      next.delete("q");
    }

    if (category !== "ALL") {
      next.set("category", category);
    } else {
      next.delete("category");
    }

    if (selectedStrategy !== "all") {
      next.set("strategy", selectedStrategy);
    } else {
      next.delete("strategy");
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [category, searchParams, searchTerm, selectedStrategy, setSearchParams]);

  // 核心篩選邏輯：使用 useMemo 確保只有在關鍵字或原始資料變動時才重新計算
  const filteredEtfs = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();

    return allEtfs.filter((etf) => {
      const code = etf.code.trim().toUpperCase();
      return (
        matchesCategory(category, code) &&
        matchesStrategy(selectedStrategy, etf) &&
        matchesTerm(etf, term)
      );
    });
  }, [deferredSearchTerm, allEtfs, category, selectedStrategy]);

  const handleOpenByCode = useCallback(
    (etfCode: string) => {
      setDialogTabValue(0);
      navigate(`/data/etf/twse/${etfCode}${querySuffix}`);
    },
    [navigate, querySuffix],
  );

  const handleClose = () => {
    navigate(`/data/etf/twse${querySuffix}`);
  };

  const handleShare = useCallback(async (url = window.location.href) => {
    const result = await shareUrl({ url });

    if (result === "copied") {
      setShareNotice("連結已複製");
    }

    if (result === "failed") {
      setShareNotice("無法分享連結");
    }
  }, []);

  const selectedDate = useMemo(() => {
    if (tabValue === 0) return dayjs();
    return dateTabValues[tabValue - 1].date;
  }, [dateTabValues, tabValue]);
  const isDividendTab = tabValue > 0;
  const queryExShare = useGetTwseEtfExInfo(
    selectedDate.format("YYYY-MM-DD"),
    isDividendTab,
  );
  const activeCategoryLabel =
    filters.find((filter) => filter.value === category)?.label ?? "全部";
  const activeStrategyLabel =
    strategyOptions.find((strategy) => strategy.value === selectedStrategy)
      ?.label ?? "全部 ETF";
  const hasActiveFilters =
    searchTerm.trim() !== "" ||
    category !== "ALL" ||
    selectedStrategy !== "all";
  const handleResetFilters = () => {
    setSearchTerm("");
    setCategory("ALL");
    setSelectedStrategy("all");
  };
  const handleDensityChange = (
    _: React.MouseEvent<HTMLElement>,
    nextDensity: TableDensity | null,
  ) => {
    if (nextDensity) {
      setTableDensity(nextDensity);
    }
  };

  if (isInvalidRouteCode) {
    return (
      <ErrorPage
        code={404}
        backUrl={`/data/etf/twse${querySuffix}`}
        message={`找不到代號 ${routeCode} 的 ETF。`}
      />
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", color: "text.primary" }}>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "rgba(25, 118, 210, 0.16)",
          borderRadius: 2,
          px: { xs: 2, md: 3 },
          py: { xs: 2.5, md: 3 },
          mb: 2.5,
          background:
            "linear-gradient(135deg, #f8fbff 0%, #eef8f4 58%, #fff8ed 100%)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-end" }}
        >
          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1 }}
            >
              <QueryStatsIcon sx={{ color: "#1565c0" }} />
              <Typography
                variant="overline"
                sx={{ color: "text.secondary", fontWeight: 800 }}
              >
                TWSE ETF Dashboard
              </Typography>
            </Stack>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                color: "#14315d",
                letterSpacing: 0,
                lineHeight: 1.15,
              }}
            >
              ETF 投資導航
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 1, color: "text.secondary", maxWidth: 680 }}
            >
              快速篩選台股 ETF
              類型、除息統計與填息表現，點選代號或名稱可查看歷史配息與股價。
            </Typography>
          </Box>

          <Stack
            direction="row"
            useFlexGap
            flexWrap="wrap"
            spacing={1}
            sx={{ minWidth: { md: 440 } }}
          >
            <StatPill label="全部 ETF" value={allEtfs.length} />
            <StatPill label="符合條件" value={filteredEtfs.length} />
            <StatPill label="ETF 類型" value={activeCategoryLabel} />
            <StatPill label="數據策略" value={activeStrategyLabel} />
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={tabValue}
          onChange={(_, val) => setTabValue(val)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab label="全部 ETF" />
          {dateTabValues.map((tab, index) => (
            <Tab
              key={index}
              label={`${tab.label}除權 (${tab.date.format("YYYY-MM-DD")})`}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ display: tabValue === 0 ? "block" : "none" }}>
        {query.isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {query.isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            ETF 資料載入失敗，請稍後再試。
          </Alert>
        )}

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.paper",
            p: { xs: 2, md: 2.5 },
            mb: 2.5,
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ mb: 2 }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="搜尋代碼、名稱、公司或關鍵字 (如：元大、科技...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                bgcolor: "white",
                "& .MuiOutlinedInput-root": { borderRadius: 2 },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchTerm ? (
                  <InputAdornment position="end">
                    <Tooltip title="清除搜尋">
                      <IconButton
                        size="small"
                        onClick={() => setSearchTerm("")}
                        edge="end"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ) : undefined,
              }}
            />

            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              sx={{
                minWidth: { xs: "100%", md: 132 },
                borderRadius: 2,
                fontWeight: 800,
              }}
            >
              清除篩選
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <FilterListIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              快速選擇 ETF 類型
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ mb: 2 }}
          >
            {filters.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                onClick={() => setCategory(f.value as EtfCategory)}
                color={category === f.value ? "primary" : "default"}
                variant={category === f.value ? "filled" : "outlined"}
                sx={{ fontWeight: 800, borderRadius: 1.5 }}
              />
            ))}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontWeight: 900, mr: 1 }}
            >
              數據策略：
            </Typography>

            {strategyOptions.map((strategy) => (
              <Tooltip key={strategy.value} title={strategy.description} arrow>
                <Chip
                  icon={strategy.icon}
                  label={strategy.label}
                  color={
                    selectedStrategy === strategy.value
                      ? strategy.color
                      : "default"
                  }
                  onClick={() => setSelectedStrategy(strategy.value)}
                  variant={
                    selectedStrategy === strategy.value ? "filled" : "outlined"
                  }
                  sx={{
                    borderRadius: 1.5,
                    fontWeight: 800,
                    borderStyle:
                      strategy.value === "rookie_trap" &&
                      selectedStrategy !== "rookie_trap"
                        ? "dashed"
                        : "solid",
                  }}
                />
              </Tooltip>
            ))}
          </Stack>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1}
          sx={{ mb: 1 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 900, color: "#14315d" }}>
            ETF 清單
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={tableDensity}
            onChange={handleDensityChange}
            aria-label="表格資訊密度"
            sx={{
              "& .MuiToggleButton-root": {
                px: 1.25,
                fontWeight: 800,
                borderRadius: 1.5,
              },
            }}
          >
            <ToggleButton value="compact" aria-label="精簡表格">
              <DensitySmallIcon fontSize="small" sx={{ mr: 0.75 }} />
              精簡
            </ToggleButton>
            <ToggleButton value="full" aria-label="完整表格">
              <TableRowsIcon fontSize="small" sx={{ mr: 0.75 }} />
              完整
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Box
          sx={{
            position: "sticky",
            top: 8,
            zIndex: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(10px)",
            px: 1.5,
            py: 1,
            mb: 1.5,
            boxShadow: "0 12px 32px rgba(15, 23, 42, 0.07)",
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontWeight: 900, mr: 0.5 }}
            >
              共 {filteredEtfs.length} 支
            </Typography>
            <Chip
              size="small"
              label={`類型：${activeCategoryLabel}`}
              color={category === "ALL" ? "default" : "primary"}
              variant={category === "ALL" ? "outlined" : "filled"}
              sx={{ borderRadius: 1.25, fontWeight: 800 }}
            />
            <Chip
              size="small"
              label={`策略：${activeStrategyLabel}`}
              color={selectedStrategy === "all" ? "default" : "secondary"}
              variant={selectedStrategy === "all" ? "outlined" : "filled"}
              sx={{ borderRadius: 1.25, fontWeight: 800 }}
            />
            {searchTerm.trim() && (
              <Chip
                size="small"
                label={`搜尋：${searchTerm.trim()}`}
                onDelete={() => setSearchTerm("")}
                sx={{ borderRadius: 1.25, fontWeight: 800 }}
              />
            )}
            <Button
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              sx={{ ml: { sm: "auto" }, fontWeight: 800 }}
            >
              清除
            </Button>
            <Button
              size="small"
              startIcon={<ShareIcon />}
              onClick={() =>
                handleShare(
                  `${window.location.origin}/data/etf/twse${querySuffix}`,
                )
              }
              sx={{ fontWeight: 800 }}
            >
              分享
            </Button>
          </Stack>
        </Box>
        <Grid container spacing={3}>
          {!query.isLoading && !query.isError && filteredEtfs.length > 0 ? (
            <EtfTableList
              data={filteredEtfs}
              density={tableDensity}
              onClick={handleOpenByCode}
            />
          ) : !query.isLoading && !query.isError ? (
            <Grid size={12}>
              <Box
                sx={{
                  textAlign: "center",
                  py: 8,
                  px: 2,
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  找不到符合{searchTerm && `「${searchTerm}」`}的 ETF
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  justifyContent="center"
                  sx={{ mt: 2 }}
                >
                  <Chip label={`類型：${activeCategoryLabel}`} size="small" />
                  <Chip label={`策略：${activeStrategyLabel}`} size="small" />
                  {searchTerm.trim() && (
                    <Chip label={`搜尋：${searchTerm.trim()}`} size="small" />
                  )}
                </Stack>
                {hasActiveFilters && (
                  <Button
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={handleResetFilters}
                    sx={{ mt: 2, borderRadius: 2, fontWeight: 800 }}
                  >
                    清除篩選
                  </Button>
                )}
              </Box>
            </Grid>
          ) : null}
        </Grid>

        {selectedEtf && (
          <DetailDialog
            open={!!routeCode}
            badge={selectedEtf.code}
            title={selectedEtf.name}
            onClose={handleClose}
            onShare={() =>
              handleShare(
                `${window.location.origin}/data/etf/twse/${selectedEtf.code}${querySuffix}`,
              )
            }
            shareLabel="分享 ETF 連結"
          >
            <EtfDetailSummary etf={selectedEtf} />
            <Tabs
              value={dialogTabValue}
              onChange={(_, newValue) => setDialogTabValue(newValue)}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{ mb: 1 }}
            >
              <Tab label={"配息紀錄"} />
              <Tab label={"歷史股價"} />
            </Tabs>
            <Divider />
            <Box sx={{ display: dialogTabValue === 0 ? "block" : "none" }}>
              <EtfHistoryShare data={queryShares.data?.data?.stats ?? []} />
            </Box>
            <Box sx={{ display: dialogTabValue === 1 ? "block" : "none" }}>
              {dialogTabValue === 1 && (
                <EtfCandleChart
                  etfCode={selectedEtf.code}
                  etfName={selectedEtf.name}
                />
              )}
            </Box>
          </DetailDialog>
        )}
      </Box>

      <DividendTable
        data={queryExShare?.data?.data ?? []}
        isLoading={queryExShare.isLoading}
        isError={queryExShare.isError}
        is_show={isDividendTab}
        selected_date={selectedDate.format("YYYY-MM-DD")}
        onClick={handleOpenByCode}
      />
      <FooterDisclaimer />
      <Snackbar
        open={!!shareNotice}
        autoHideDuration={2200}
        onClose={() => setShareNotice("")}
        message={shareNotice}
      />
    </Box>
  );
};

// 簡易表格元件
const DividendTable = ({
  data,
  isLoading,
  isError,
  is_show,
  selected_date,
  onClick,
}: {
  selected_date: string;
  isLoading: boolean;
  isError: boolean;
  is_show: boolean;
  data: TwseEtfInfo[];
  onClick?: (etfCode: string) => void;
}) => (
  <>
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
        p: { xs: 2, md: 2.5 },
        mb: 2,
        display: is_show ? "block" : "none",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarMonthIcon sx={{ color: "#1565c0" }} />
          <Typography variant="h6" sx={{ fontWeight: 900, color: "#14315d" }}>
            {selected_date} 除息
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          共 {data.length} 支 ETF
        </Typography>
      </Stack>
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">除息資料載入失敗，請稍後再試。</Alert>
      ) : (
        <EtfTableList data={data} onClick={onClick} />
      )}
    </Box>
  </>
);

const EtfTableList = ({
  data,
  density = "full",
  onClick,
  noDataText,
}: {
  data: TwseEtfInfo[];
  density?: TableDensity;
  onClick?: (etfCode: string) => void;
  noDataText?: string;
}) => {
  const [orderBy, setOrderBy] = useState<{
    field: OrderableField;
    order: OrderableSort;
  }>({ field: "code", order: "asc" });
  const handleRequestSort = (field: OrderableField) => {
    const isAsc = orderBy.field === field && orderBy.order === "asc";
    setOrderBy((o) => ({ ...o, field, order: isAsc ? "desc" : "asc" }));
  };

  const sortedResult = useMemo(() => {
    return [...data].sort((a, b) => {
      const valueA = getSortValue(a, orderBy.field);
      const valueB = getSortValue(b, orderBy.field);

      // 執行正序或倒序比對
      if (valueA < valueB) return orderBy.order === "asc" ? -1 : 1;
      if (valueA > valueB) return orderBy.order === "asc" ? 1 : -1;
      return 0;
    });
  }, [orderBy, data]);
  const isCompact = density === "compact";
  const columnCount = isCompact ? 5 : 13;

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        overflowX: "auto",
        boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Table stickyHeader size="small" sx={{ minWidth: isCompact ? 680 : 1420 }}>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                fontWeight: 900,
                bgcolor: "#f6f9fc",
                color: "text.secondary",
              }}
            >
              <TableSortLabel
                active={orderBy.field === "code"}
                direction={orderBy.field === "code" ? orderBy.order : "asc"}
                onClick={() => handleRequestSort("code")}
              >
                代號
              </TableSortLabel>
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 900,
                bgcolor: "#f6f9fc",
                color: "text.secondary",
              }}
            >
              名稱
            </TableCell>
            {!isCompact && (
              <TableCell
                sx={{
                  fontWeight: 900,
                  bgcolor: "#f6f9fc",
                  color: "text.secondary",
                }}
              >
                <TableSortLabel
                  active={orderBy.field === "ex_date"}
                  direction={
                    orderBy.field === "ex_date" ? orderBy.order : "asc"
                  }
                  onClick={() => handleRequestSort("ex_date")}
                >
                  除權息日期
                </TableSortLabel>
              </TableCell>
            )}
            <TableCell
              sx={{
                fontWeight: 900,
                bgcolor: "#f6f9fc",
                color: "text.secondary",
              }}
              align="right"
            >
              <TableSortLabel
                active={orderBy.field === "share"}
                direction={orderBy.field === "share" ? orderBy.order : "asc"}
                onClick={() => handleRequestSort("share")}
              >
                預計配息金額
              </TableSortLabel>
            </TableCell>
            {!isCompact && (
              <>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "latest_close"}
                    direction={
                      orderBy.field === "latest_close" ? orderBy.order : "asc"
                    }
                    onClick={() => handleRequestSort("latest_close")}
                  >
                    最新收盤
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "total_ex_count"}
                    direction={
                      orderBy.field === "total_ex_count" ? orderBy.order : "asc"
                    }
                    onClick={() => handleRequestSort("total_ex_count")}
                  >
                    除權息次數
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "success_fill_count"}
                    direction={
                      orderBy.field === "success_fill_count"
                        ? orderBy.order
                        : "asc"
                    }
                    onClick={() => handleRequestSort("success_fill_count")}
                  >
                    成功填息次數
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "ma5"}
                    direction={orderBy.field === "ma5" ? orderBy.order : "asc"}
                    onClick={() => handleRequestSort("ma5")}
                  >
                    MA5
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "ma20"}
                    direction={orderBy.field === "ma20" ? orderBy.order : "asc"}
                    onClick={() => handleRequestSort("ma20")}
                  >
                    MA20
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "range_position"}
                    direction={
                      orderBy.field === "range_position"
                        ? orderBy.order
                        : "asc"
                    }
                    onClick={() => handleRequestSort("range_position")}
                  >
                    月區間位置
                  </TableSortLabel>
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 900,
                    bgcolor: "#f6f9fc",
                    color: "text.secondary",
                  }}
                  align="right"
                >
                  <TableSortLabel
                    active={orderBy.field === "ma20_bias_rate"}
                    direction={
                      orderBy.field === "ma20_bias_rate"
                        ? orderBy.order
                        : "asc"
                    }
                    onClick={() => handleRequestSort("ma20_bias_rate")}
                  >
                    MA20 乖離
                  </TableSortLabel>
                </TableCell>
              </>
            )}
            <TableCell
              sx={{
                fontWeight: 900,
                bgcolor: "#f6f9fc",
                color: "text.secondary",
              }}
              align="right"
            >
              <TableSortLabel
                active={orderBy.field === "win_rate"}
                direction={orderBy.field === "win_rate" ? orderBy.order : "asc"}
                onClick={() => handleRequestSort("win_rate")}
              >
                勝率
              </TableSortLabel>
            </TableCell>
            <TableCell
              sx={{
                fontWeight: 900,
                bgcolor: "#f6f9fc",
                color: "text.secondary",
              }}
              align="right"
            >
              <TableSortLabel
                active={orderBy.field === "avg_fill_days"}
                direction={
                  orderBy.field === "avg_fill_days" ? orderBy.order : "asc"
                }
                onClick={() => handleRequestSort("avg_fill_days")}
              >
                平均填息日
              </TableSortLabel>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedResult.length > 0 ? (
            sortedResult.map((etf) => (
              <TableRow
                key={etf.code}
                hover
                sx={{
                  "&:nth-of-type(even)": {
                    bgcolor: "rgba(2, 132, 199, 0.025)",
                  },
                  "&:hover": { bgcolor: "rgba(25, 118, 210, 0.06)" },
                }}
              >
                <TableCell>
                  <Chip
                    color="primary"
                    variant="outlined"
                    label={etf.code}
                    size="small"
                    sx={{ fontWeight: 900, borderRadius: 1.25 }}
                    onClick={() => {
                      if (onClick) {
                        onClick(etf.code);
                      }
                    }}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 700, maxWidth: 260 }}>
                  {onClick ? (
                    <Button
                      onClick={() => onClick(etf.code)}
                      variant={"text"}
                      sx={{
                        justifyContent: "flex-start",
                        px: 0,
                        textAlign: "left",
                        fontWeight: 800,
                        textTransform: "none",
                      }}
                    >
                      {etf.name}
                    </Button>
                  ) : (
                    etf.name
                  )}
                </TableCell>
                {!isCompact && (
                  <TableCell sx={{ color: "text.secondary" }}>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <CalendarMonthIcon
                        sx={{ fontSize: 16, color: "text.disabled" }}
                      />
                      <span>{formatDateOrDash(etf.ex_date)}</span>
                    </Stack>
                  </TableCell>
                )}
                <TableCell
                  align="right"
                  sx={{ color: "success.main", fontWeight: "bold" }}
                >
                  {/* 假設 API 有提供這個欄位，若無則顯示預留字 */}
                  {etf.share && etf.share > 0
                    ? `$${etf.share.toFixed(4)}`
                    : "--"}
                </TableCell>
                {!isCompact && (
                  <>
                    <TableCell align="right" sx={{ fontWeight: 900 }}>
                      {formatDecimal(etf.latest_close)}
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.75}
                        justifyContent="flex-end"
                        alignItems="center"
                      >
                        <span>
                          {etf.total_ex_count > 0 ? etf.total_ex_count : "--"}
                        </span>
                        {getRecordStatus(etf.total_ex_count) && (
                          <Chip
                            size="small"
                            label={getRecordStatus(etf.total_ex_count)?.label}
                            color={getRecordStatus(etf.total_ex_count)?.color}
                            variant="outlined"
                            sx={{ height: 22, borderRadius: 1 }}
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      {etf.success_fill_count > 0
                        ? etf.success_fill_count
                        : "--"}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      {formatDecimal(etf.ma5)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      {formatDecimal(etf.ma20)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      {formatPercent(etf.range_position)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color:
                          etf.ma20_bias_rate > 0
                            ? "error.main"
                            : etf.ma20_bias_rate < 0
                              ? "success.main"
                              : "text.primary",
                        fontWeight: 800,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="flex-end"
                        alignItems="center"
                      >
                        {hasMA20BiasRisk(etf.ma20_bias_rate) && (
                          <Tooltip
                            title={`MA20 乖離率 ${formatSignedPercent(
                              etf.ma20_bias_rate,
                            )}，偏離中期均線過大`}
                          >
                            <WarningAmberIcon
                              fontSize="small"
                              sx={{ color: "warning.main" }}
                            />
                          </Tooltip>
                        )}
                        <span>{formatSignedPercent(etf.ma20_bias_rate)}</span>
                      </Stack>
                    </TableCell>
                  </>
                )}
                <TableCell align="right" sx={{ minWidth: 132 }}>
                  {etf.win_rate > 0 ? (
                    <Box sx={{ minWidth: 108 }}>
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{
                          color: getWinRateTone(etf.win_rate),
                          fontWeight: 900,
                        }}
                      >
                        {etf.win_rate}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(etf.win_rate, 100)}
                        sx={{
                          mt: 0.75,
                          height: 5,
                          borderRadius: 999,
                          bgcolor: "rgba(148, 163, 184, 0.22)",
                          "& .MuiLinearProgress-bar": {
                            bgcolor: getWinRateTone(etf.win_rate),
                          },
                        }}
                      />
                    </Box>
                  ) : (
                    "--"
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>
                  <Stack
                    direction="row"
                    spacing={0.75}
                    justifyContent="flex-end"
                    alignItems="center"
                  >
                    <span>
                      {etf.avg_fill_days > 0 ? etf.avg_fill_days : "--"}
                    </span>
                    {getAvgFillStatus(etf.avg_fill_days) && (
                      <Chip
                        size="small"
                        label={getAvgFillStatus(etf.avg_fill_days)?.label}
                        color={getAvgFillStatus(etf.avg_fill_days)?.color}
                        variant="outlined"
                        sx={{ height: 22, borderRadius: 1 }}
                      />
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columnCount} align="center" sx={{ py: 3 }}>
                {noDataText ?? "期間內無即將除權之 ETF"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const EtfHistoryShare = ({ data }: { data: TwseEtfShare[] }) => (
  <>
    <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 2 }}>
      歷史配息紀錄
    </Typography>
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2, overflowX: "auto" }}
    >
      <Table size="small" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            {[
              "除息日期",
              "入帳日期",
              "配息金額",
              "單次殖利率",
              "填息日",
              "填息所需日曆日",
            ].map((label) => (
              <TableCell
                key={label}
                align={label === "配息金額" ? "right" : "left"}
                sx={{
                  bgcolor: "#f6f9fc",
                  color: "text.secondary",
                  fontWeight: 900,
                }}
              >
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(data || []).map((record, index) => (
            <TableRow key={index}>
              <TableCell>{formatDateOrDash(record.ex_date)}</TableCell>
              <TableCell>{formatDateOrDash(record.payable_date)}</TableCell>
              <TableCell
                align="right"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                {record.share > 0 ? record.share.toFixed(4) : "--"}
              </TableCell>
              <TableCell>
                {record.yield_rate > 0 ? record.yield_rate + "%" : "--"}
              </TableCell>
              <TableCell>{formatDateOrDash(record.filled_date)}</TableCell>
              <TableCell>
                {record.filled_days > 0 ? record.filled_days : "--"}
              </TableCell>
            </TableRow>
          ))}
          {!data ||
            (data.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  尚無配息資料
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  </>
);

const EtfCandleChart = ({
  etfCode,
  etfName,
}: {
  etfCode: string;
  etfName: string;
}) => {
  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const [startDate, setStartDate] = useState(
    dayjs().subtract(3, "month").format("YYYY-MM-DD"),
  );
  const [endDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [selectedEndDate, setSelectedEndDate] = useState(endDate);
  const [viewMode, setViewMode] = useState<TickerViewMode>("chart");

  const maxEndDate = useMemo(() => {
    const oneYearLater = dayjs(startDate).add(1, "year");
    const todayValue = dayjs(today);
    return (
      oneYearLater.isBefore(todayValue) ? oneYearLater : todayValue
    ).format("YYYY-MM-DD");
  }, [startDate, today]);

  const dateRangeError = useMemo(() => {
    const start = dayjs(startDate);
    const end = dayjs(selectedEndDate);

    if (!start.isValid() || !end.isValid()) {
      return "請選擇有效的日期區間。";
    }

    if (end.isBefore(start, "day")) {
      return "結束日期不能早於開始日期。";
    }

    if (end.isAfter(start.add(1, "year"), "day")) {
      return "起訖期間最多一年。";
    }

    if (end.isAfter(dayjs(today), "day")) {
      return "結束日期不能晚於今日。";
    }

    return "";
  }, [selectedEndDate, startDate, today]);

  const canQueryTicker = !dateRangeError;

  const query = useGetTwseEtfTicker(
    etfCode,
    startDate,
    selectedEndDate,
    canQueryTicker,
  );
  const tickerRows = useMemo(
    () =>
      [...(query.data?.data ?? [])].sort(
        (a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
      ),
    [query.data?.data],
  );
  const calculatedTickerRows = useMemo(
    () =>
      tickerRows.map((row, index) => {
        const rowsToDate = tickerRows.slice(0, index + 1);
        const rows5 = rowsToDate.slice(-5);
        const rows20 = rowsToDate.slice(-20);
        const rows60 = rowsToDate.slice(-60);
        const rows120 = rowsToDate.slice(-120);
        const ma5 = rowsToDate.length >= 5 ? averageClose(rows5) : null;
        const ma20 = rowsToDate.length >= 20 ? averageClose(rows20) : null;

        return {
          ...row,
          calculated_ma5: ma5,
          calculated_ma20: ma20,
          calculated_ma60:
            rowsToDate.length >= 60 ? averageClose(rows60) : null,
          calculated_ma120:
            rowsToDate.length >= 120 ? averageClose(rows120) : null,
          calculated_ma20_bias_rate:
            ma20 !== null && ma20 > 0
              ? ((row.close - ma20) / ma20) * 100
              : null,
          calculated_range_position_20:
            rowsToDate.length >= 20 ? rangePositionByClose(rows20) : null,
          calculated_range_position_60:
            rowsToDate.length >= 60 ? rangePositionByClose(rows60) : null,
          calculated_range_position_120:
            rowsToDate.length >= 120 ? rangePositionByClose(rows120) : null,
        };
      }),
    [tickerRows],
  );
  const indicatorVisibility = useMemo(
    () => ({
      ma5: calculatedTickerRows.length >= 5,
      ma20: calculatedTickerRows.length >= 20,
      ma60: calculatedTickerRows.length >= 60,
      ma120: calculatedTickerRows.length >= 120,
      range20: calculatedTickerRows.length >= 20,
      range60: calculatedTickerRows.length >= 60,
      range120: calculatedTickerRows.length >= 120,
    }),
    [calculatedTickerRows.length],
  );
  const tickerTableRows = useMemo(
    () =>
      [...calculatedTickerRows].sort(
        (a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf(),
      ),
    [calculatedTickerRows],
  );
  const closeRange = useMemo(() => {
    return calculatedTickerRows.reduce<{
      high: (typeof calculatedTickerRows)[number] | null;
      low: (typeof calculatedTickerRows)[number] | null;
    }>(
      (result, row) => {
        if (!result.high || row.close > result.high.close) {
          result.high = row;
        }

        if (!result.low || row.close < result.low.close) {
          result.low = row;
        }

        return result;
      },
      { high: null, low: null },
    );
  }, [calculatedTickerRows]);
  const tickerStats = useMemo(() => {
    const first = calculatedTickerRows[0] ?? null;
    const latest = calculatedTickerRows[calculatedTickerRows.length - 1] ?? null;
    const high = closeRange.high;
    const low = closeRange.low;
    const range = high && low ? high.close - low.close : 0;
    const returnRate =
      first && latest && first.close > 0
        ? ((latest.close - first.close) / first.close) * 100
        : null;
    const position =
      latest && low && range > 0
        ? ((latest.close - low.close) / range) * 100
        : null;
    const amplitude =
      high && low && low.close > 0 ? (range / low.close) * 100 : null;

    return {
      amplitude,
      high,
      latest,
      low,
      position,
      returnRate,
    };
  }, [calculatedTickerRows, closeRange.high, closeRange.low]);
  const tickerTableColumnCount =
    8 +
    Number(indicatorVisibility.range20) +
    Number(indicatorVisibility.range60) +
    Number(indicatorVisibility.range120) +
    Number(indicatorVisibility.ma5) +
    Number(indicatorVisibility.ma20) +
    Number(indicatorVisibility.ma60) +
    Number(indicatorVisibility.ma120) +
    Number(indicatorVisibility.ma20);

  // 將資料轉換為 ApexCharts 格式
  const series = useMemo(
    () => [
      {
        data: tickerRows.map((item) => ({
          x: dayjs(item.date).format("YYYY-MM-DD"),
          y: [item.open, item.max, item.min, item.close],
        })),
      },
    ],
    [tickerRows],
  );

  const options: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: {
        type: "candlestick",
        height: 350,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
        },
        animations: { enabled: true },
        fontFamily: theme.typography.fontFamily,
        background: "transparent",
      },
      title: {
        text: `${etfName} (${etfCode}) 股價走勢 ${startDate} ~ ${selectedEndDate}`,
        align: "left",
        style: {
          fontSize: "18px",
          fontWeight: 600,
          color: theme.palette.text.primary,
        },
      },
      xaxis: {
        type: "datetime",
        labels: {
          datetimeFormatter: {
            year: "yyyy",
            month: "MMM 'yy",
            day: "dd MMM",
            hour: "HH:mm",
          },
          style: { colors: theme.palette.text.secondary },
        },
        tooltip: { enabled: false },
      },
      yaxis: {
        tooltip: { enabled: true },
        labels: {
          formatter: (val) => val.toFixed(2),
          style: { colors: theme.palette.text.secondary },
        },
        forceNiceScale: true,
      },
      tooltip: {
        enabled: true,
        theme: theme.palette.mode,
        shared: true,
        intersect: false,
        x: {
          format: "yyyy-MM-dd",
        },
        fixed: {
          enabled: false,
          position: "topRight",
        },
        custom: ({ seriesIndex, dataPointIndex, w }) => {
          const point = w.config.series?.[seriesIndex]?.data?.[dataPointIndex];
          const values = point?.y ?? [];
          const [open, high, low, close] = values;
          const date = point?.x ? dayjs(point.x).format("YYYY-MM-DD") : "--";
          const rows = [
            ["開盤", open],
            ["最高", high],
            ["最低", low],
            ["收盤", close],
          ];

          return `
            <div style="min-width: 152px; padding: 10px 12px; color: ${theme.palette.text.primary};">
              <div style="font-size: 12px; font-weight: 800; color: ${theme.palette.text.secondary}; margin-bottom: 8px;">
                ${date}
              </div>
              ${rows
                .map(
                  ([label, value]) => `
                    <div style="display: flex; justify-content: space-between; gap: 18px; font-size: 12px; line-height: 1.7;">
                      <span style="color: ${theme.palette.text.secondary};">${label}</span>
                      <strong>${Number(value).toFixed(2)}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>
          `;
        },
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: "#ef5350", // 台灣習慣：漲紅
            downward: "#26a69a", // 台灣習慣：跌綠
          },
          wick: {
            useFillColor: true,
          },
        },
      },
      grid: {
        borderColor: theme.palette.divider,
        strokeDashArray: 4,
      },
    }),
    [
      etfCode,
      etfName,
      selectedEndDate,
      startDate,
      theme.palette.divider,
      theme.palette.mode,
      theme.palette.text.primary,
      theme.palette.text.secondary,
      theme.typography.fontFamily,
    ],
  );

  useEffect(() => {
    if (
      !chartRef.current ||
      viewMode !== "chart" ||
      dateRangeError ||
      query.isLoading ||
      query.isError
    ) {
      return;
    }

    const chart = new ApexCharts(chartRef.current, {
      ...options,
      series,
    });

    chart.render();

    return () => {
      chart.destroy();
    };
  }, [
    dateRangeError,
    options,
    query.isError,
    query.isLoading,
    series,
    viewMode,
  ]);

  return (
    <Box
      sx={{
        width: "100%",
        mt: 2,
        bgcolor: "background.paper",
        borderRadius: 2,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        sx={{ mb: 2 }}
      >
        <TextField
          label="開始日期"
          type="date"
          size="small"
          value={startDate}
          onChange={(event) => {
            const nextStartDate = event.target.value;
            setStartDate(nextStartDate);
            const nextMaxEndDate = dayjs(nextStartDate)
              .add(1, "year")
              .format("YYYY-MM-DD");

            if (dayjs(selectedEndDate).isAfter(nextMaxEndDate, "day")) {
              setSelectedEndDate(
                dayjs(nextMaxEndDate).isAfter(today, "day")
                  ? today
                  : nextMaxEndDate,
              );
            }
          }}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              max: selectedEndDate,
            },
          }}
          sx={{ minWidth: { sm: 180 } }}
        />
        <TextField
          label="結束日期"
          type="date"
          size="small"
          value={selectedEndDate}
          onChange={(event) => {
            setSelectedEndDate(event.target.value);
          }}
          error={!!dateRangeError}
          helperText={dateRangeError || "最多查詢一年區間"}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: {
              min: startDate,
              max: maxEndDate,
            },
          }}
          sx={{ minWidth: { sm: 180 } }}
        />
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1.5 }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={viewMode}
          onChange={(_, nextMode: TickerViewMode | null) => {
            if (nextMode) {
              setViewMode(nextMode);
            }
          }}
          aria-label="歷史股價顯示模式"
          sx={{
            "& .MuiToggleButton-root": {
              px: 1.5,
              fontWeight: 800,
              borderRadius: 1.5,
            },
          }}
        >
          <ToggleButton value="chart">K 線圖</ToggleButton>
          <ToggleButton value="table">表格</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{ mb: 2 }}
      >
        <DetailStat
          label="最新收盤"
          value={
            tickerStats.latest ? (
              <Box>
                {tickerStats.latest.close.toFixed(2)}
                <Typography variant="caption" display="block">
                  {dayjs(tickerStats.latest.date).format("YYYY-MM-DD")}
                </Typography>
              </Box>
            ) : (
              "--"
            )
          }
          tone="primary.main"
        />
        <DetailStat
          label="區間最高收盤"
          value={
            tickerStats.high ? (
              <Box>
                {tickerStats.high.close.toFixed(2)}
                <Typography variant="caption" display="block">
                  {dayjs(tickerStats.high.date).format("YYYY-MM-DD")}
                </Typography>
              </Box>
            ) : (
              "--"
            )
          }
          tone="error.main"
        />
        <DetailStat
          label="區間最低收盤"
          value={
            tickerStats.low ? (
              <Box>
                {tickerStats.low.close.toFixed(2)}
                <Typography variant="caption" display="block">
                  {dayjs(tickerStats.low.date).format("YYYY-MM-DD")}
                </Typography>
              </Box>
            ) : (
              "--"
            )
          }
          tone="success.main"
        />
        <DetailStat
          label="區間報酬"
          value={formatSignedPercent(tickerStats.returnRate)}
          tone={
            tickerStats.returnRate && tickerStats.returnRate >= 0
              ? "error.main"
              : "success.main"
          }
        />
        <DetailStat
          label="區間位置"
          value={
            tickerStats.position === null
              ? "--"
              : `${tickerStats.position.toFixed(2)}%`
          }
        />
        <DetailStat
          label="區間振幅"
          value={
            tickerStats.amplitude === null
              ? "--"
              : `${tickerStats.amplitude.toFixed(2)}%`
          }
        />
        {indicatorVisibility.ma5 && (
          <DetailStat
            label="MA5"
            value={formatDecimal(tickerStats.latest?.calculated_ma5)}
          />
        )}
        {indicatorVisibility.ma20 && (
          <DetailStat
            label="MA20"
            value={formatDecimal(tickerStats.latest?.calculated_ma20)}
          />
        )}
        {indicatorVisibility.ma20 && (
          <DetailStat
            label="MA20 乖離"
            value={formatSignedPercent(
              tickerStats.latest?.calculated_ma20_bias_rate,
            )}
            tone={
              (tickerStats.latest?.calculated_ma20_bias_rate ?? 0) >= 0
                ? "error.main"
                : "success.main"
            }
          />
        )}
        {indicatorVisibility.ma60 && (
          <DetailStat
            label="MA60"
            value={formatDecimal(tickerStats.latest?.calculated_ma60)}
          />
        )}
        {indicatorVisibility.ma120 && (
          <DetailStat
            label="MA120"
            value={formatDecimal(tickerStats.latest?.calculated_ma120)}
          />
        )}
        {indicatorVisibility.range20 && (
          <DetailStat
            label="月區間位置"
            value={formatPercent(
              tickerStats.latest?.calculated_range_position_20,
            )}
          />
        )}
        {indicatorVisibility.range60 && (
          <DetailStat
            label="季區間位置"
            value={formatPercent(
              tickerStats.latest?.calculated_range_position_60,
            )}
          />
        )}
        {indicatorVisibility.range120 && (
          <DetailStat
            label="半年區間位置"
            value={formatPercent(
              tickerStats.latest?.calculated_range_position_120,
            )}
          />
        )}
      </Stack>

      {dateRangeError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {dateRangeError}
        </Alert>
      ) : query.isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : query.isError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          股價資料載入失敗，請稍後再試。
        </Alert>
      ) : null}
      {viewMode === "chart" ? (
        <Box ref={chartRef} sx={{ minHeight: 350 }} />
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 2, overflowX: "auto" }}
        >
          <Table size="small" sx={{ minWidth: tickerTableColumnCount * 96 }}>
            <TableHead>
              <TableRow>
                {[
                  "日期",
                  "開盤",
                  "最高",
                  "最低",
                  "收盤",
                  ...(indicatorVisibility.range20 ? ["月區間位置"] : []),
                  ...(indicatorVisibility.range60 ? ["季區間位置"] : []),
                  ...(indicatorVisibility.range120 ? ["半年區間位置"] : []),
                  ...(indicatorVisibility.ma5 ? ["MA5"] : []),
                  ...(indicatorVisibility.ma20 ? ["MA20"] : []),
                  ...(indicatorVisibility.ma20 ? ["MA20 乖離"] : []),
                  ...(indicatorVisibility.ma60 ? ["MA60"] : []),
                  ...(indicatorVisibility.ma120 ? ["MA120"] : []),
                  "成交量",
                  "成交金額",
                  "交易筆數",
                ].map((label) => (
                  <TableCell
                    key={label}
                    align={label === "日期" ? "left" : "right"}
                    sx={{
                      bgcolor: "#f6f9fc",
                      color: "text.secondary",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tickerTableRows.length > 0 ? (
                tickerTableRows.map((row) => {
                  const isHighClose =
                    closeRange.high?.date === row.date &&
                    closeRange.high?.close === row.close;
                  const isLowClose =
                    closeRange.low?.date === row.date &&
                    closeRange.low?.close === row.close;

                  return (
                    <TableRow
                      key={row.date}
                      hover
                      sx={{
                        bgcolor: isHighClose
                          ? "rgba(239, 83, 80, 0.08)"
                          : isLowClose
                            ? "rgba(38, 166, 154, 0.08)"
                            : undefined,
                      }}
                    >
                      <TableCell>
                        {dayjs(row.date).format("YYYY-MM-DD")}
                      </TableCell>
                      <TableCell align="right">{row.open.toFixed(2)}</TableCell>
                      <TableCell align="right">{row.max.toFixed(2)}</TableCell>
                      <TableCell align="right">{row.min.toFixed(2)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          <span>{row.close.toFixed(2)}</span>
                          {isHighClose && (
                            <Chip
                              size="small"
                              label="區間最高"
                              color="error"
                              variant="outlined"
                              sx={{ height: 22, borderRadius: 1 }}
                            />
                          )}
                          {isLowClose && (
                            <Chip
                              size="small"
                              label="區間最低"
                              color="success"
                              variant="outlined"
                              sx={{ height: 22, borderRadius: 1 }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      {indicatorVisibility.range20 && (
                        <TableCell align="right">
                          {formatPercent(row.calculated_range_position_20)}
                        </TableCell>
                      )}
                      {indicatorVisibility.range60 && (
                        <TableCell align="right">
                          {formatPercent(row.calculated_range_position_60)}
                        </TableCell>
                      )}
                      {indicatorVisibility.range120 && (
                        <TableCell align="right">
                          {formatPercent(row.calculated_range_position_120)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma5 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma5)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma20 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma20)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma20 && (
                        <TableCell align="right">
                          {formatSignedPercent(row.calculated_ma20_bias_rate)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma60 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma60)}
                        </TableCell>
                      )}
                      {indicatorVisibility.ma120 && (
                        <TableCell align="right">
                          {formatDecimal(row.calculated_ma120)}
                        </TableCell>
                      )}
                      <TableCell align="right">{formatInteger(row.volume)}</TableCell>
                      <TableCell align="right">
                        {formatInteger(row.trading_money)}
                      </TableCell>
                      <TableCell align="right">
                        {formatInteger(row.trading_turnover)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tickerTableColumnCount}
                    align="center"
                    sx={{ py: 3 }}
                  >
                    查無股價資料
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default EtfDashboard;
