import React, { useState, useMemo, useEffect } from "react";
import {
  Grid,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  InputAdornment,
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import ReactApexChart from "react-apexcharts";
import { useTitle } from "@/helpers/title.tsx";
import {
  useGetTwseEtfCodeList,
  useGetTwseEtfExInfo,
  useGetTwseEtfInfo,
  useGetTwseEtfTicker,
} from "@/apis/opendata/twse_etf.ts";
import type { TwseEtfInfo, TwseEtfShare } from "@/types/etf.ts";
import dayjs from "dayjs";

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
  | "rookie_trap"; // 這是糞策略;

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
  // 狀態管理
  const [searchTerm, setSearchTerm] = useState(""); // 搜尋關鍵字
  const [selectedEtf, setSelectedEtf] = useState<TwseEtfInfo | null>(null);
  const [allEtfs, setAllEtfs] = useState<TwseEtfInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [dialogTabValue, setDialogTabValue] = useState(0);
  const [category, setCategory] = useState<EtfCategory>("ALL");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>("all");

  const query = useGetTwseEtfCodeList();
  const queryShares = useGetTwseEtfInfo(selectedEtf?.code ?? "");
  useTitle("ETF 投資導航");

  useEffect(() => {
    if (!query.isLoading && query.isSuccess && !query.isError) {
      setAllEtfs(query.data?.data);
    }
  }, [query.isLoading, query.isSuccess, query.isError]);

  // 核心篩選邏輯：使用 useMemo 確保只有在關鍵字或原始資料變動時才重新計算
  const filteredEtfs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result = allEtfs;

    const checkStrategy = (s: StrategyType, etf: TwseEtfInfo) => {
      switch (s) {
        case "high_win_rate":
          return etf.win_rate >= 85.0;
        case "fast_fill":
          // 排除掉平均天數為 0 的（代表從未成功填息過）
          return etf.avg_fill_days > 0 && etf.avg_fill_days <= 20.0;
        case "veteran":
          return etf.total_ex_count >= 15;
        case "loser_leak":
          // 總配息至少要大於 0 次，不然會把沒配過息的也抓進來
          return etf.total_ex_count > 0 && etf.win_rate <= 50.0;
        case "eternal_wait":
          // 成功填息過，但平均花費日曆天數超過 3 個月 (90天) 的烏龜股
          return etf.avg_fill_days >= 90.0;
        case "rookie_trap":
          // 剛上市沒多久、配息紀錄只有 1~2 次，勝率數據根本不具備歷史參考價值的「蜜月期新股」
          return etf.total_ex_count > 0 && etf.total_ex_count <= 2;
        default:
          return true;
      }
    };
    const checkTerm = (etf: TwseEtfInfo, t?: string) => {
      if (!t) return true;
      return (
        etf.code.toLowerCase().includes(term) ||
        etf.name.toLowerCase().includes(term) ||
        etf.target?.toLowerCase().includes(term)
      );
    };

    return result.filter((etf) => {
      const code = etf.code.trim().toUpperCase();

      switch (category) {
        case "LEVERAGED_POS":
          // 結尾為 L 且排除期貨型 U
          return (
            code.endsWith("L") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "LEVERAGED_NEG":
          // 結尾為 R
          return (
            code.endsWith("R") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "BOND":
          // 結尾為 B 或名稱含有債券相關字眼
          return (
            code.endsWith("B") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "FOREIGN_CURR":
          // 結尾為 K (外幣交易)
          return (
            code.endsWith("K") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "ACTIVE":
          // 檢查編碼 M 或名稱帶有主動式
          return (
            code.endsWith("A") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "ACTIVE_BOND":
          return (
            code.endsWith("D") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "FOREIGN_CURR_BOND":
          return (
            code.endsWith("C") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "FOREIGN_CURR_LEVERAGED_POS":
          return (
            code.endsWith("M") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "FOREIGN_CURR_LEVERAGED_NEG":
          return (
            code.endsWith("S") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "FUTURE":
          return (
            code.endsWith("U") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "FOREIGN_CURR_FUTURE":
          return (
            code.endsWith("V") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        case "MULTI_ASSET":
          return (
            code.endsWith("T") &&
            checkStrategy(selectedStrategy, etf) &&
            checkTerm(etf, term)
          );
        default:
          return checkStrategy(selectedStrategy, etf) && checkTerm(etf, term);
      }
    });
  }, [searchTerm, allEtfs, category, selectedStrategy]);

  const handleOpen = (etf: TwseEtfInfo) => {
    setSelectedEtf(etf);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedEtf(null);
  };

  const GetDateTabs = () => {
    // 取得基準點（今天）
    const today = dayjs();

    // 定義你要的時段
    return [
      { label: "今日", date: today },
      { label: "明日", date: today.add(1, "day") },
      { label: "後天", date: today.add(2, "day") },
      { label: "一星期後", date: today.add(7, "day") },
      { label: "兩星期後", date: today.add(14, "day") },
    ];
  };

  const selectedDate = useMemo(() => {
    if (tabValue === 0) return dayjs();
    return GetDateTabs()[tabValue - 1].date;
  }, [tabValue]);
  const queryExShare = useGetTwseEtfExInfo(selectedDate.format("YYYY-MM-DD"));

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: "0 auto" }}>
      <Typography
        variant="h4"
        sx={{ mb: 3, fontWeight: "bold", color: "#1a237e" }}
      >
        ETF 投資導航{" "}
        {allEtfs && <Typography>共 {allEtfs.length} 支</Typography>}
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)}>
          <Tab label="全部 ETF" />
          {GetDateTabs().map((tab, index) => (
            <Tab
              key={index}
              label={`${tab.label}除權 (${tab.date.format("YYYY-MM-DD")})`}
            />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ display: tabValue === 0 ? "block" : "none" }}>
        {/* 搜尋篩選列 */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="搜尋代碼、名稱、公司或關鍵字 (如：元大、科技...)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 4, bgcolor: "white" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />

        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
        >
          <Typography variant={"subtitle2"}>快速選擇 ETF 類型</Typography>
          {filters.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              onClick={() => setCategory(f.value as EtfCategory)}
              color={category === f.value ? "primary" : "default"}
              variant={category === f.value ? "filled" : "outlined"}
              sx={{ fontWeight: "bold" }}
            />
          ))}
        </Stack>

        <Box sx={{ mt: 2, mb: 2 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", fontWeight: "bold", mr: 1 }}
            >
              數據策略：
            </Typography>

            <Chip
              label="全部 ETF"
              color={selectedStrategy === "all" ? "primary" : "default"}
              onClick={() => setSelectedStrategy("all")}
            />
            <Chip
              icon={<WorkspacePremiumIcon fontSize="small" />}
              label="🔥 填息王 (勝率 > 85%)"
              color={
                selectedStrategy === "high_win_rate" ? "success" : "default"
              }
              onClick={() => setSelectedStrategy("high_win_rate")}
              variant={
                selectedStrategy === "high_win_rate" ? "filled" : "outlined"
              }
            />
            <Chip
              label="⚡ 閃電填息 (平均 < 20天)"
              color={selectedStrategy === "fast_fill" ? "error" : "default"}
              onClick={() => setSelectedStrategy("fast_fill")}
              variant={selectedStrategy === "fast_fill" ? "filled" : "outlined"}
            />
            <Chip
              label="🏆 老牌穩健 (配息 > 15次)"
              color={selectedStrategy === "veteran" ? "warning" : "default"}
              onClick={() => setSelectedStrategy("veteran")}
              variant={selectedStrategy === "veteran" ? "filled" : "outlined"}
            />
            <Chip
              label="🤡 貼息大師 (勝率 < 50%)"
              color={
                selectedStrategy === "loser_leak" ? "secondary" : "default"
              }
              variant={
                selectedStrategy === "loser_leak" ? "filled" : "outlined"
              }
              onClick={() => setSelectedStrategy("loser_leak")}
            />
            <Chip
              label="⏳ 望穿秋水 (填息超慢 > 90天)"
              color={
                selectedStrategy === "eternal_wait" ? "secondary" : "default"
              }
              variant={
                selectedStrategy === "eternal_wait" ? "filled" : "outlined"
              }
              onClick={() => setSelectedStrategy("eternal_wait")}
            />
            <Chip
              label="👶 菜雞韭菜卡 (配息 < 2次)"
              color={selectedStrategy === "rookie_trap" ? "default" : "default"}
              variant={
                selectedStrategy === "rookie_trap" ? "filled" : "outlined"
              }
              onClick={() => setSelectedStrategy("rookie_trap")}
              sx={{
                borderStyle:
                  selectedStrategy === "rookie_trap" ? "solid" : "dashed",
              }}
            />
          </Stack>
        </Box>

        {/* 卡片列表 */}
        <Typography
          variant="h6"
          sx={{ mb: 2, fontWeight: "bold", color: "#1a237e" }}
        >
          共 {filteredEtfs.length} 支符合條件
        </Typography>
        <Grid container spacing={3}>
          {filteredEtfs && filteredEtfs.length > 0 ? (
            <EtfTableList
              data={filteredEtfs}
              onClick={(etfCode: string) => {
                const e = filteredEtfs.filter((e) => e.code === etfCode)[0];
                handleOpen(e);
              }}
            />
          ) : (
            <Grid size={12}>
              <Box sx={{ textAlign: "center", py: 10 }}>
                <Typography variant="h6" color="text.secondary">
                  找不到符合{searchTerm && `「${searchTerm}」`}的 ETF
                </Typography>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* 彈出視窗 (維持原本邏輯) */}
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
          {selectedEtf && (
            <>
              <DialogTitle
                sx={{
                  m: 0,
                  p: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography>
                  {selectedEtf.name} ({selectedEtf.code})
                </Typography>
                <IconButton onClick={handleClose}>
                  <CloseIcon />
                </IconButton>
              </DialogTitle>
              <DialogContent dividers sx={{ overflowY: "visible" }}>
                <Tabs
                  value={dialogTabValue}
                  onChange={(_, newValue) => setDialogTabValue(newValue)}
                >
                  <Tab label={"配息紀錄"} />
                  <Tab label={"歷史股價"} />
                </Tabs>
                <Divider />
                <Box sx={{ display: dialogTabValue === 0 ? "block" : "none" }}>
                  <EtfHistoryShare data={queryShares.data?.data?.stats ?? []} />
                </Box>
                <Box sx={{ display: dialogTabValue === 1 ? "block" : "none" }}>
                  <EtfCandleChart
                    etfCode={selectedEtf.code}
                    etfName={selectedEtf.name}
                  />
                </Box>
              </DialogContent>
            </>
          )}
        </Dialog>
      </Box>

      <DividendTable
        data={queryExShare?.data?.data ?? []}
        is_show={Array.from(
          { length: GetDateTabs().length },
          (_, i) => i + 1,
        ).includes(tabValue)}
        selected_date={selectedDate.format("YYYY-MM-DD")}
        onClick={(etfCode: string) => {
          allEtfs
            .filter((etf) => etf.code === etfCode)
            .forEach((etf) => {
              handleOpen(etf);
            });
        }}
      />
      <FooterDisclaimer />
    </Box>
  );
};

// 簡易表格元件
const DividendTable = ({
  data,
  is_show,
  selected_date,
  onClick,
}: {
  selected_date: string;
  is_show: boolean;
  data: TwseEtfInfo[];
  onClick?: (etfCode: string) => void;
}) => (
  <>
    <Box
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        mb: 2,
        display: is_show ? "block" : "none",
      }}
    >
      <Typography
        variant="h6"
        sx={{ mb: 2, fontWeight: "bold", color: "#1a237e" }}
      >
        {selected_date}除息
      </Typography>
      <EtfTableList data={data} onClick={onClick} />
    </Box>
  </>
);

const EtfTableList = ({
  data,
  onClick,
  noDataText,
}: {
  data: TwseEtfInfo[];
  onClick?: (etfCode: string) => void;
  noDataText?: string;
}) => (
  <TableContainer component={Paper} sx={{ borderRadius: 3, mt: 2 }}>
    <Table>
      <TableHead sx={{ bgcolor: "action.hover" }}>
        <TableRow>
          <TableCell sx={{ fontWeight: "bold" }}>代號</TableCell>
          <TableCell sx={{ fontWeight: "bold" }}>名稱</TableCell>
          <TableCell sx={{ fontWeight: "bold" }}>除權息日期</TableCell>
          <TableCell sx={{ fontWeight: "bold" }} align="right">
            預計配息金額
          </TableCell>
          <TableCell sx={{ fontWeight: "bold" }} align="right">
            除權息次數
          </TableCell>
          <TableCell sx={{ fontWeight: "bold" }} align="right">
            成功填息次數
          </TableCell>
          <TableCell sx={{ fontWeight: "bold" }} align="right">
            勝率
          </TableCell>
          <TableCell sx={{ fontWeight: "bold" }} align="right">
            平均填息日
          </TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.length > 0 ? (
          data.map((etf) => (
            <TableRow key={etf.code} hover>
              <TableCell>
                <Chip
                  color="primary"
                  variant="outlined"
                  label={etf.code}
                  size="small"
                  onClick={() => {
                    if (onClick) {
                      onClick(etf.code);
                    }
                  }}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 500 }}>
                {onClick ? (
                  <Button onClick={() => onClick(etf.code)} variant={"text"}>
                    {etf.name}
                  </Button>
                ) : (
                  etf.name
                )}
              </TableCell>
              <TableCell>
                {dayjs(etf.ex_date).format("YYYY-MM-DD") !== "0001-01-01"
                  ? dayjs(etf.ex_date).format("YYYY-MM-DD")
                  : "--"}
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                {/* 假設 API 有提供這個欄位，若無則顯示預留字 */}
                {etf.share && etf.share > 0 ? `$${etf.share.toFixed(4)}` : "--"}
              </TableCell>
              <TableCell align="right">
                {etf.total_ex_count > 0 ? etf.total_ex_count : "--"}
              </TableCell>
              <TableCell align="right">
                {etf.success_fill_count > 0 ? etf.success_fill_count : "--"}
              </TableCell>
              <TableCell align="right">
                {etf.win_rate > 0 ? `${etf.win_rate}%` : "--"}
              </TableCell>
              <TableCell align="right">
                {etf.avg_fill_days > 0 ? etf.avg_fill_days : "--"}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
              {noDataText ?? "期間內無即將除權之 ETF"}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </TableContainer>
);

const EtfHistoryShare = ({ data }: { data: TwseEtfShare[] }) => (
  <>
    <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
      歷史配息紀錄
    </Typography>
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead sx={{ bgcolor: "#f5f5f5" }}>
          <TableRow>
            <TableCell>除息日期</TableCell>
            <TableCell>入帳日期</TableCell>
            <TableCell align="right">配息金額</TableCell>
            <TableCell>單次殖利率</TableCell>
            <TableCell>填息日</TableCell>
            <TableCell>填息所需日曆日</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(data || []).map((record, index) => (
            <TableRow key={index}>
              <TableCell>
                {dayjs(record.ex_date).format("YYYY-MM-DD")}
              </TableCell>
              <TableCell>
                {dayjs(record.payable_date).format("YYYY-MM-DD")}
              </TableCell>
              <TableCell
                align="right"
                sx={{ color: "success.main", fontWeight: "bold" }}
              >
                {record.share > 0 ? record.share.toFixed(4) : "--"}
              </TableCell>
              <TableCell>
                {record.yield_rate > 0 ? record.yield_rate + "%" : "--"}
              </TableCell>
              <TableCell>
                {record.filled_date
                  ? dayjs(record.filled_date).format("YYYY-MM-DD") !==
                    "1900-01-01"
                    ? dayjs(record.filled_date).format("YYYY-MM-DD")
                    : "--"
                  : "--"}
              </TableCell>
              <TableCell>
                {record.filled_days > 0 ? record.filled_days : "--"}
              </TableCell>
            </TableRow>
          ))}
          {!data ||
            (data.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
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
  const [startDate] = useState(
    dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"),
  );
  const [endDate] = useState(dayjs().format("YYYY-MM-DD"));

  const query = useGetTwseEtfTicker(etfCode, startDate, endDate);

  // 將資料轉換為 ApexCharts 格式
  const series = [
    {
      data: (query?.data?.data ?? []).map((item) => ({
        x: dayjs(item.date).format("YYYY-MM-DD"),
        y: [item.open, item.max, item.min, item.close],
      })),
    },
  ];

  const options: ApexCharts.ApexOptions = {
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
      text: `${etfName} (${etfCode}) 股價走勢`,
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
  };

  return (
    <Box
      sx={{
        width: "100%",
        mt: 2,
        bgcolor: "background.paper",
        p: 2,
        borderRadius: 2,
      }}
    >
      <ReactApexChart
        options={options}
        series={series}
        type="candlestick"
        height={350}
      />
    </Box>
  );
};

export default EtfDashboard;
