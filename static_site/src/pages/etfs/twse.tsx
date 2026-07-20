import React, {
  useState,
  useMemo,
  useEffect,
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
  Divider,
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
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useTitle } from "@/helpers/title.tsx";
import {
  useGetTwseEtfCodeList,
  useGetTwseEtfExInfo,
} from "@/apis/opendata/twse_etf.ts";
import type { TwseEtfInfo } from "@/types/etf.ts";
import dayjs from "dayjs";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { buildSnsShareUrl, shareUrl } from "@/helpers/share.ts";
import { InvestmentRiskDisclaimer } from "@/components/etf/InvestmentRiskDisclaimer.tsx";
import { useAuth } from "@/components/auth/AuthContext.ts";
import {
  useSaveTwseEtfFavorite,
  useTwseEtfFavorites,
} from "@/apis/opendata/etf_favorites.ts";
import { EtfDetailDialog } from "@/components/etf/etf_detail_dialog.tsx";
import {
  formatDateOrDash,
  formatDecimal,
  formatPercent,
  formatSignedPercent,
  getWinRateTone,
} from "@/pages/etfs/twse_format_helpers.ts";

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
      return (
        etf.range_position > 0 &&
        etf.range_position <= 25 &&
        etf.ma20_bias_rate <= -3
      );
    case "trend_strength":
      return (
        etf.ma5 > 0 &&
        etf.ma20 > 0 &&
        etf.ma5 > etf.ma20 &&
        etf.range_position >= 60
      );
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

  const { session } = useAuth();
  const favoritesQuery = useTwseEtfFavorites();
  const favoritedCodes = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((favorite) => favorite.code)),
    [favoritesQuery.data],
  );
  const saveFavoriteMutation = useSaveTwseEtfFavorite();
  const handleToggleFavorite = useCallback(
    (etfCode: string) => {
      saveFavoriteMutation.mutate({
        code: etfCode,
        favorited: !favoritedCodes.has(etfCode),
      });
    },
    [favoritedCodes, saveFavoriteMutation],
  );

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
      navigate(`/data/etf/twse/${etfCode}${querySuffix}`);
    },
    [navigate, querySuffix],
  );

  const handleClose = () => {
    navigate(`/data/etf/twse${querySuffix}`);
  };

  const handleShare = useCallback(
    async (
      frontendPath = window.location.pathname + window.location.search,
    ) => {
      const result = await shareUrl({
        url: buildSnsShareUrl(frontendPath),
      });

      if (result === "copied") {
        setShareNotice("連結已複製");
      }

      if (result === "failed") {
        setShareNotice("無法分享連結");
      }
    },
    [],
  );

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
          {session && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<StarIcon />}
              onClick={() => navigate(`/data/etf/twse/favorites`)}
              sx={{ mb: 2, fontWeight: 800, borderRadius: 2 }}
            >
              只看我的最愛（{favoritedCodes.size}）
            </Button>
          )}

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
              onClick={() => handleShare(`/data/etf/twse${querySuffix}`)}
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
              favoritedCodes={session ? favoritedCodes : undefined}
              onToggleFavorite={session ? handleToggleFavorite : undefined}
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
          <EtfDetailDialog
            key={selectedEtf.code}
            code={selectedEtf.code}
            open={!!routeCode}
            onClose={handleClose}
          />
        )}
      </Box>

      <DividendTable
        data={queryExShare?.data?.data ?? []}
        isLoading={queryExShare.isLoading}
        isError={queryExShare.isError}
        is_show={isDividendTab}
        selected_date={selectedDate.format("YYYY-MM-DD")}
        onClick={handleOpenByCode}
        favoritedCodes={session ? favoritedCodes : undefined}
        onToggleFavorite={session ? handleToggleFavorite : undefined}
      />
      <InvestmentRiskDisclaimer />
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
  favoritedCodes,
  onToggleFavorite,
}: {
  selected_date: string;
  isLoading: boolean;
  isError: boolean;
  is_show: boolean;
  data: TwseEtfInfo[];
  onClick?: (etfCode: string) => void;
  favoritedCodes?: Set<string>;
  onToggleFavorite?: (etfCode: string) => void;
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
        <EtfTableList
          data={data}
          onClick={onClick}
          favoritedCodes={favoritedCodes}
          onToggleFavorite={onToggleFavorite}
        />
      )}
    </Box>
  </>
);

const EtfTableList = ({
  data,
  density = "full",
  onClick,
  noDataText,
  favoritedCodes,
  onToggleFavorite,
}: {
  data: TwseEtfInfo[];
  density?: TableDensity;
  onClick?: (etfCode: string) => void;
  noDataText?: string;
  favoritedCodes?: Set<string>;
  onToggleFavorite?: (etfCode: string) => void;
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
  const columnCount = (isCompact ? 5 : 13) + (onToggleFavorite ? 1 : 0);

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
      <Table
        stickyHeader
        size="small"
        sx={{ minWidth: isCompact ? 680 : 1420 }}
      >
        <TableHead>
          <TableRow>
            {onToggleFavorite && (
              <TableCell padding="checkbox" sx={{ bgcolor: "#f6f9fc" }} />
            )}
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
                      orderBy.field === "range_position" ? orderBy.order : "asc"
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
                      orderBy.field === "ma20_bias_rate" ? orderBy.order : "asc"
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
                {onToggleFavorite && (
                  <TableCell padding="checkbox">
                    <Tooltip
                      title={
                        favoritedCodes?.has(etf.code)
                          ? `將『${etf.code} - ${etf.name}』移出最愛`
                          : `將『${etf.code} - ${etf.name}』加入最愛`
                      }
                    >
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => onToggleFavorite(etf.code)}
                      >
                        {favoritedCodes?.has(etf.code) ? (
                          <StarIcon fontSize="small" />
                        ) : (
                          <StarBorderIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
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

export default EtfDashboard;
