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
  useTheme, Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ReactApexChart from 'react-apexcharts';
import { useTitle } from "@/helpers/title.tsx";
import {
  useGetTwseEtfCodeList,
  useGetTwseEtfExInfo,
  useGetTwseEtfInfo, useGetTwseEtfTicker,
} from "@/apis/opendata/twse_etf.ts";
import type {TwseEtfInfo, TwseEtfUpcomingShare} from "@/types/etf.ts";
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

const EtfDashboard: React.FC = () => {
  // 狀態管理
  const [searchTerm, setSearchTerm] = useState(""); // 搜尋關鍵字
  const [selectedEtf, setSelectedEtf] = useState<TwseEtfInfo | null>(null);
  const [allEtfs, setAllEtfs] = useState<TwseEtfInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [dialogTabValue, setDialogTabValue] =  useState(0)
  const [category, setCategory] = useState<EtfCategory>("ALL");

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
    let result = allEtfs;

    // A. 嚴謹的代碼後綴類別篩選
    if (category !== "ALL") {
      result = result.filter((etf) => {
        const code = etf.code.trim().toUpperCase();

        switch (category) {
          case "LEVERAGED_POS":
            // 結尾為 L 且排除期貨型 U
            return code.endsWith("L");
          case "LEVERAGED_NEG":
            // 結尾為 R
            return code.endsWith("R");
          case "BOND":
            // 結尾為 B 或名稱含有債券相關字眼
            return code.endsWith("B");
          case "FOREIGN_CURR":
            // 結尾為 K (外幣交易)
            return code.endsWith("K");
          case "ACTIVE":
            // 檢查編碼 M 或名稱帶有主動式
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
      });
    }

    // B. 關鍵字篩選 (交集計算)
    if (term) {
      result = result.filter(
        (etf) =>
          etf.code.toLowerCase().includes(term) ||
          etf.name.toLowerCase().includes(term) ||
          etf.target?.toLowerCase().includes(term),
      );
    }

    return result;
  }, [searchTerm, allEtfs, category]);

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

        {/* 卡片列表 */}
        <Typography
          variant="h6"
          sx={{ mb: 2, fontWeight: "bold", color: "#1a237e" }}
        >
          共 {filteredEtfs.length} 支符合條件
        </Typography>
        <Grid container spacing={3}>
          {filteredEtfs && filteredEtfs.length > 0 ? (
            <TableContainer
              component={Paper}
              sx={{ borderRadius: 3, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: "bold" }}>代號</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>名稱</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>發行公司</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>上市日期</TableCell>
                    {/* 預留欄位 */}
                    <TableCell sx={{ fontWeight: "bold" }}>
                      除權息次數
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      成功填息次數
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>勝率</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      平均填息日
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEtfs.map((etf) => (
                    <TableRow
                      key={etf.code}
                      hover
                      onClick={() => handleOpen(etf)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Chip
                          label={etf.code}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        {etf.name}
                      </TableCell>
                      <TableCell color="text.secondary">
                        {etf.company}
                      </TableCell>
                      <TableCell>{dayjs(etf.date).format("YYYY-MM-DD")}</TableCell>
                      <TableCell>{etf.total_ex_count}</TableCell>
                      <TableCell>{etf.success_fill_count}</TableCell>
                      <TableCell>
                        {etf.win_rate > 0 ? etf.win_rate + "%" : "--"}
                      </TableCell>
                      <TableCell>
                        {etf.avg_fill_days > 0
                          ? etf.avg_fill_days + "天"
                          : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
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
              <DialogContent dividers sx={{ overflowY: 'visible' }}>
                <Tabs value={dialogTabValue} onChange={(_, newValue) => setDialogTabValue(newValue)}>
                  <Tab label={"配息紀錄"} />
                  <Tab label={"歷史股價"} />
                </Tabs>
                <Divider />
                <Box sx={{ display: dialogTabValue === 0 ? "block" : "none" }}>
                  <EtfHistoryShare data={(queryShares.data?.data?.stats) ?? []} />
                </Box>
                <Box sx={{ display: dialogTabValue === 1 ? "block" : "none" }}>
                  <EtfCandleChart etfCode={selectedEtf.code} etfName={selectedEtf.name} />
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
  data: TwseEtfUpcomingShare[];
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
              <TableCell sx={{ fontWeight: "bold" }}>勝率（填息次數/配息次數）</TableCell>
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
                      <Button
                        onClick={() => onClick(etf.code)}
                        variant={"text"}
                      >
                        {etf.name}
                      </Button>
                    ) : (
                      etf.name
                    )}
                  </TableCell>
                  <TableCell>{dayjs(etf.ex_date).format("YYYY-MM-DD")}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: "success.main", fontWeight: "bold" }}
                  >
                    {/* 假設 API 有提供這個欄位，若無則顯示預留字 */}
                    {etf.share > 0
                      ? `$${etf.share.toFixed(4)}`
                      : "--"}
                  </TableCell>
                  <TableCell>--</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  期間內無即將除權之 ETF
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  </>
);

const EtfHistoryShare = ({ data }: { data: TwseEtfUpcomingShare[] }) => (
  <>
    <Typography
        variant="subtitle1"
        sx={{ fontWeight: "bold", mb: 2 }}
    >
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
          {(data || []).map(
              (record, index) => (
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
                      {record.share > 0
                          ? record.share.toFixed(4)
                          : "--"}
                    </TableCell>
                    <TableCell>
                      {record.yield_rate > 0
                          ? record.yield_rate + "%"
                          : "--"}
                    </TableCell>
                    <TableCell>{record.filled_date ? (dayjs(record.filled_date).format("YYYY-MM-DD") !== "1900-01-01" ? dayjs(record.filled_date).format("YYYY-MM-DD") : "--") : "--"}</TableCell>
                    <TableCell>{record.filled_days > 0 ? record.filled_days : "--"}</TableCell>
                  </TableRow>
              ),
          )}
          {!data || data.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  尚無配息資料
                </TableCell>
              </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  </>
)

const EtfCandleChart = ({ etfCode, etfName }: {etfCode: string, etfName: string}) => {
  const theme = useTheme();
  const [startDate] = useState(dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD"));
  const [endDate] = useState(dayjs().format("YYYY-MM-DD"));

  const query = useGetTwseEtfTicker(etfCode, startDate, endDate)

  // 將資料轉換為 ApexCharts 格式
  const series = [{
    data: (query?.data?.data ?? []).map(item => ({
      x: dayjs(item.date).format("YYYY-MM-DD"),
      y: [item.open, item.max, item.min, item.close]
    }))
  }];

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'candlestick',
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
          reset: true
        }
      },
      animations: { enabled: true },
      fontFamily: theme.typography.fontFamily,
      background: 'transparent',
    },
    title: {
      text: `${etfName} (${etfCode}) 股價走勢`,
      align: 'left',
      style: {
        fontSize: '18px',
        fontWeight: 600,
        color: theme.palette.text.primary
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeFormatter: {
          year: 'yyyy',
          month: 'MMM \'yy',
          day: 'dd MMM',
          hour: 'HH:mm'
        },
        style: { colors: theme.palette.text.secondary }
      },
      tooltip: { enabled: false }
    },
    yaxis: {
      tooltip: { enabled: true },
      labels: {
        formatter: (val) => val.toFixed(2),
        style: { colors: theme.palette.text.secondary }
      },
      forceNiceScale: true
    },
    tooltip: {
      enabled: true,
      theme: theme.palette.mode,
      shared: true,
      intersect: false,
      x: {
        format: 'yyyy-MM-dd'
      },
      fixed: {
        enabled: false,
        position: 'topRight',
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#ef5350',   // 台灣習慣：漲紅
          downward: '#26a69a'  // 台灣習慣：跌綠
        },
        wick: {
          useFillColor: true
        }
      }
    },
    grid: {
      borderColor: theme.palette.divider,
      strokeDashArray: 4,
    }
  };

  return (
      <Box sx={{ width: '100%', mt: 2, bgcolor: 'background.paper', p: 2, borderRadius: 2 }}>
        <ReactApexChart options={options} series={series} type="candlestick" height={350}/>
      </Box>
  );
};

export default EtfDashboard;
