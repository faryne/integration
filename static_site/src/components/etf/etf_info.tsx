import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  Tooltip,
  Stack,
  Button,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tabs,
  Tab,
  Grid,
  FormControlLabel,
  Checkbox,
  Drawer,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { useState, useMemo } from "react";
import type { EtfInfo, EtfDivideInfo } from "@/types/etf.ts";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

interface EtfTableProps {
  data: EtfInfo;
}

interface Transaction {
  id: string;
  buyDate: string;
  buyShares: number; // 原始購入股數
  buyPrice: number;
  isSold: boolean;
  sellDate: string;
  sellShares: number; // 賣出股數 (需小於等於購入股數)
  sellPrice: number;
}

// 定義風格類型
type TradingStyle = "US" | "TW";

export function ETFInfo({ data }: EtfTableProps) {
  // 定義篩選類型
  type RocFilterType = "ALL" | "PROFIT" | "PARTIAL" | "CAPITAL";
  const [rocFilter, setRocFilter] = useState<RocFilterType>("ALL");

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [dateType, setDateType] = useState<"ex_date" | "payable_date" | "">("");
  const [calOpen, setCalOpen] = useState<boolean>(false);
  const rocStats = useMemo(() => {
    const total = data.distributions.length;
    const profit = data.distributions.filter((row) => row.roc === 0).length;
    const partial = data.distributions.filter(
      (row) => row.roc > 0 && row.roc <= 80,
    ).length;
    const capital = data.distributions.filter((row) => row.roc > 80).length;
    const formatRate = (count: number) =>
      total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "0.0%";

    return {
      total,
      profit: { count: profit, rate: formatRate(profit) },
      partial: { count: partial, rate: formatRate(partial) },
      capital: { count: capital, rate: formatRate(capital) },
    };
  }, [data.distributions]);

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        {data.code} - {data.description}{" "}
        <Button
          onClick={() => setCalOpen(true)}
          variant="contained"
          color="primary"
          size="small"
          sx={{ ml: 2 }}
        >
          試算盈虧
        </Button>
      </Typography>
      <Drawer
        open={calOpen}
        anchor="right"
        onClose={() => setCalOpen(false)}
        sx={{ maxWidth: "30%" }}
      >
        <ProfitCalculator data={data} />
      </Drawer>
      <Stack direction={"column"} spacing={3}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" color="text.secondary">
            ROC 篩選：
          </Typography>
          <Chip
            label={`全部 (${rocStats.total})`}
            onClick={() => setRocFilter("ALL")}
            variant={rocFilter === "ALL" ? "filled" : "outlined"}
            size="small"
          />
          <Chip
            label={`獲利為主 (0%) ${rocStats.profit.count}/${rocStats.total} (${rocStats.profit.rate})`}
            color="success"
            onClick={() => setRocFilter("PROFIT")}
            variant={rocFilter === "PROFIT" ? "filled" : "outlined"}
            size="small"
          />
          <Chip
            label={`部分本金 (0-80%) ${rocStats.partial.count}/${rocStats.total} (${rocStats.partial.rate})`}
            color="warning"
            onClick={() => setRocFilter("PARTIAL")}
            variant={rocFilter === "PARTIAL" ? "filled" : "outlined"}
            size="small"
          />
          <Chip
            label={`本金返還 (>80%) ${rocStats.capital.count}/${rocStats.total} (${rocStats.capital.rate})`}
            color="error"
            onClick={() => setRocFilter("CAPITAL")}
            variant={rocFilter === "CAPITAL" ? "filled" : "outlined"}
            size="small"
          />
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <TextField
            select
            label="日期基準"
            size="small"
            value={dateType}
            onChange={(e) =>
              setDateType(e.target.value as "" | "ex_date" | "payable_date")
            }
            sx={{ width: 130 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="ex_date">除息日</MenuItem>
            <MenuItem value="payable_date">付息日</MenuItem>
          </TextField>

          <TextField
            label="開始日期"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }} // 讓標籤不會跟原生日期圖示重疊
          />

          <TextField
            label="結束日期"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Button
            size="small"
            variant="text"
            onClick={() => {
              setStartDate("");
              setEndDate("");
            }}
          >
            重設日期
          </Button>
        </Stack>
        <TableContainer component={Paper} variant="outlined">
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
              <TableRow>
                <TableCell>宣告日 (Declared)</TableCell>
                <TableCell>除息日 (Ex-Date)</TableCell>
                <TableCell>給付日 (Payable)</TableCell>
                <TableCell align="right">每股配息 ($)</TableCell>
                <TableCell align="right">實領金額（預扣 30%）</TableCell>
                <TableCell align="right">ROC (Return of Capital，%)</TableCell>
                <TableCell align="right">次年退稅金額</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.distributions
                .filter((r) => {
                  switch (rocFilter) {
                    case "ALL":
                      return true;
                    case "CAPITAL":
                      return r.roc !== -1 && r.roc >= 80;
                    case "PARTIAL":
                      return r.roc > 0 && r.roc <= 80;
                    case "PROFIT":
                      return r.roc === 0;
                  }
                })
                .filter((r1) => {
                  if (dateType === "") {
                    return true;
                  }
                  const targetDate = r1[dateType]; // 根據選擇的類型 (除息或付息) 抓取日期
                  const isAfterStart =
                    startDate === "" || targetDate >= startDate;
                  const isBeforeEnd = endDate === "" || targetDate <= endDate;
                  return isAfterStart && isBeforeEnd;
                })
                .map((row, index) => (
                  <TableRow key={`${data.code}-${index}`}>
                    <TableCell>{row.declared_date}</TableCell>
                    <TableCell>{row.ex_date}</TableCell>
                    <TableCell>{row.payable_date}</TableCell>
                    <TableCell align="right">
                      {row.per_share.toFixed(4)}
                    </TableCell>
                    <TableCell align="right">
                      {(row.per_share * 0.7).toFixed(4)}
                    </TableCell>
                    <TableCell align="right">
                      {(() => {
                        const rocValue = row.roc; // 假設資料是 0.9597 這種格式

                        let color: "success" | "warning" | "error" = "success";
                        let label = "獲利為主";
                        let icon = <CheckCircleOutlineIcon />;

                        if (rocValue > 80) {
                          color = "error";
                          label = "本金返還";
                          icon = <ErrorOutlineIcon />;
                        } else if (rocValue > 0) {
                          color = "warning";
                          label = "部分本金";
                          icon = <InfoOutlinedIcon />;
                        }

                        return (
                          <>
                            {rocValue != -1 ? (
                              <Tooltip
                                title={`ROC 比例: ${rocValue.toFixed(2)}%`}
                              >
                                <Chip
                                  icon={icon}
                                  label={`${label} - ${rocValue.toFixed(2)}%`}
                                  color={color}
                                  variant="outlined"
                                  size="small"
                                  sx={{ fontWeight: "bold" }}
                                />
                              </Tooltip>
                            ) : (
                              "---"
                            )}
                          </>
                        );
                      })()}
                    </TableCell>
                    <TableCell align="right">
                      {row.roc === -1
                        ? "---"
                        : (row.per_share * 0.3 * (row.roc / 100)).toFixed(4)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Box>
  );
}

// 假設這組件在 EtfTable 內，或是接收 distributions 資料
const ProfitCalculator = ({ data }: EtfTableProps) => {
  const [tab, setTab] = useState(0);
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  // 簡式狀態
  const [simpleShares, setSimpleShares] = useState<number>(0);
  const [simpleAvgCost, setSimpleAvgCost] = useState<number>(0);

  const [tradingStyle, setTradingStyle] = useState<TradingStyle>("TW"); // 預設台灣風格
  const [simpleStartDate, setSimpleStartDate] = useState<string>("");

  // 階段式狀態
  const [records, setRecords] = useState<Transaction[]>([
    {
      id: "1",
      buyDate: "",
      buyShares: 0,
      buyPrice: 0,
      isSold: false,
      sellDate: "",
      sellShares: 0,
      sellPrice: 0,
    },
  ]);

  // --- 通用 Helper ---
  const getCumulativeFactor = (
    startDate: string,
    history?: EtfDivideInfo[],
  ) => {
    if (!history || history.length === 0 || !startDate) return 1;

    // 過濾出所有在「持有日期」之後發生的分割事件，並將它們的比率相乘
    return history
      .filter((event) => event.date > startDate)
      .reduce((acc, event) => acc * event.ratio, 1);
  };
  const getTrendColor = (value: number) => {
    if (value === 0) return "text.primary";
    const isPositive = value > 0;

    if (tradingStyle === "TW") {
      return isPositive ? "#d32f2f" : "#2e7d32"; // 台股：正數紅、負數綠
    } else {
      return isPositive ? "#2e7d32" : "#d32f2f"; // 美股：正數綠、負數紅
    }
  };

  // --- 簡式算法邏輯 ---
  const simpleResult = useMemo(() => {
    const priceGain = (currentPrice - simpleAvgCost) * simpleShares; //
    let totalDiv = 0;
    let totalRefund = 0;

    data.distributions
      .filter((d) => !simpleStartDate || d.ex_date >= simpleStartDate)
      .forEach((d) => {
        // 考慮分割回推 (假設使用者輸入的是現在股數)
        const divToNowFactor = getCumulativeFactor(
          d.ex_date,
          data.divided_info ?? [],
        );
        const historicalShares = simpleShares / divToNowFactor;
        const currentAmount = d.per_share * historicalShares;

        totalDiv += currentAmount * 0.7;
        if (d.roc > 0) {
          totalRefund += currentAmount * 0.3 * (d.roc / 100);
        }
      });

    return {
      priceGain,
      totalDiv,
      totalRefund,
      total: priceGain + totalDiv,
      totalWithRefund: priceGain + totalDiv + totalRefund,
    };
  }, [currentPrice, simpleShares, simpleAvgCost, simpleStartDate, data]);

  // --- 階段式算法邏輯 ---
  const tieredResult = useMemo(() => {
    let totalDiv = 0;
    let totalPriceGain = 0;
    let totalRefund = 0; // 新增退稅累計

    records.forEach((rec) => {
      if (!rec.buyDate || !rec.buyShares) return;

      const factor = getCumulativeFactor(rec.buyDate, data.divided_info ?? []); //
      const buyShares = Number(rec.buyShares);
      const sellShares = rec.isSold ? Number(rec.sellShares) : 0;

      // 計算配息與退稅的 Helper
      const processDistributions = (
        shares: number,
        fromDate: string,
        toDate: string | null,
      ) => {
        data.distributions
          .filter(
            (d) =>
              d.ex_date >= fromDate && (toDate ? d.ex_date < toDate : true),
          )
          .forEach((d) => {
            const currentAmount = d.per_share * shares * factor;
            totalDiv += currentAmount * 0.7; // 稅後實領

            // 計算退稅：必須有 ROC 資料且大於 0
            if (d.roc > 0) {
              totalRefund += currentAmount * 0.3 * (d.roc / 100);
            }
          });
      };

      // 1. 已賣出部分的配息與退稅
      processDistributions(
        sellShares,
        rec.buyDate,
        rec.isSold ? rec.sellDate : null,
      );

      // 2. 剩餘持股的配息與退稅
      processDistributions(buyShares - sellShares, rec.buyDate, null);

      // 3. 價差損益計算 (維持先前修正後的邏輯)
      const adjCost = rec.buyPrice / factor;
      const realizedGain = rec.isSold
        ? (rec.sellPrice - adjCost) * (sellShares * factor)
        : 0;
      const unrealizedGain =
        (currentPrice - adjCost) * ((buyShares - sellShares) * factor);
      totalPriceGain += realizedGain + unrealizedGain;
    });

    return {
      totalDiv,
      totalPriceGain,
      totalRefund,
      total: totalDiv + totalPriceGain,
      totalWithRefund: totalDiv + totalPriceGain + totalRefund, // 含退稅總額
    };
  }, [records, data, currentPrice]);

  return (
    <Card
      sx={{
        mb: 4,
        border: "1px solid #e0e0e0",
        borderRadius: 2,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      }}
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", bgColor: "#f8f9fa" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab label="簡式算法 (Total)" />
          <Tab label="階段式算法 (Tiered)" />
        </Tabs>
      </Box>

      <CardContent sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2" color="text.secondary">
              顯示風格：
            </Typography>
            <ToggleButtonGroup
              size="small"
              value={tradingStyle}
              exclusive
              onChange={(_, v) => v && setTradingStyle(v)}
            >
              <ToggleButton value="TW" sx={{ px: 2 }}>
                紅漲綠跌 (台)
              </ToggleButton>
              <ToggleButton value="US" sx={{ px: 2 }}>
                綠漲紅跌 (美)
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <TextField
            label="當前股價 (USD)"
            type="number"
            size="small"
            fullWidth
            value={currentPrice || ""}
            onChange={(e) => setCurrentPrice(Number(e.target.value))}
            helperText={
              data.divided_info
                ? `* 可能包含 ${data.divided_info.map((o) => o.date).join("、")} 等日期的權值調整因素，請參照該公司 / ETF 發行公司資訊。`
                : ""
            }
          />

          {tab === 0 ? (
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  label="持有日期 (從何時開始計息)"
                  type="date"
                  fullWidth
                  size="small"
                  value={simpleStartDate}
                  onChange={(e) => setSimpleStartDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  helperText="系統將忽略此日期之前的配息紀錄"
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="總持股數"
                  type="number"
                  fullWidth
                  size="small"
                  value={simpleShares || ""}
                  onChange={(e) => setSimpleShares(Number(e.target.value))}
                />
              </Grid>
              <Grid size={6}>
                <TextField
                  label="平均成本"
                  type="number"
                  fullWidth
                  size="small"
                  value={simpleAvgCost || ""}
                  onChange={(e) => setSimpleAvgCost(Number(e.target.value))}
                />
              </Grid>
            </Grid>
          ) : (
            /* 階段式介面 */
            <Box>
              {records.map((rec, index) => (
                <Box
                  key={rec.id}
                  sx={{
                    p: 2,
                    mb: 2,
                    border: "1px solid #f0f0f0",
                    borderRadius: 2,
                    bgcolor: "#fafafa",
                  }}
                >
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <TextField
                        type="date"
                        label="購入日期"
                        size="small"
                        value={rec.buyDate}
                        onChange={(e) => {
                          const newRecs = [...records];
                          newRecs[index].buyDate = e.target.value;
                          setRecords(newRecs);
                        }}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 180 }}
                      />
                      <TextField
                        label="原始股數"
                        type="number"
                        size="small"
                        value={rec.buyShares || ""}
                        onChange={(e) => {
                          const newRecs = [...records];
                          newRecs[index].buyShares = Number(e.target.value);
                          setRecords(newRecs);
                        }}
                      />
                      <TextField
                        label="購入單價"
                        type="number"
                        size="small"
                        value={rec.buyPrice || ""}
                        onChange={(e) => {
                          const newRecs = [...records];
                          newRecs[index].buyPrice = Number(e.target.value);
                          setRecords(newRecs);
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={rec.isSold}
                            onChange={(e) => {
                              const newRecs = [...records];
                              newRecs[index].isSold = e.target.checked;
                              setRecords(newRecs);
                            }}
                          />
                        }
                        label="有賣出"
                      />
                      <IconButton
                        color="error"
                        onClick={() =>
                          setRecords(records.filter((r) => r.id !== rec.id))
                        }
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>

                    {rec.isSold && (
                      <Stack
                        direction="row"
                        spacing={2}
                        alignItems="center"
                        sx={{ pl: 4, py: 1, borderLeft: "3px solid #ffc107" }}
                      >
                        <Typography
                          variant="body2"
                          color="warning.main"
                          fontWeight="bold"
                        >
                          ↳ 賣出：
                        </Typography>
                        <TextField
                          type="date"
                          label="賣出日期"
                          size="small"
                          value={rec.sellDate}
                          onChange={(e) => {
                            const newRecs = [...records];
                            newRecs[index].sellDate = e.target.value;
                            setRecords(newRecs);
                          }}
                          InputLabelProps={{ shrink: true }}
                          sx={{ width: 180 }}
                        />
                        <TextField
                          label="賣出股數"
                          type="number"
                          size="small"
                          value={rec.sellShares || ""}
                          onChange={(e) => {
                            const newRecs = [...records];
                            newRecs[index].sellShares = Number(e.target.value);
                            setRecords(newRecs);
                          }}
                        />
                        <TextField
                          label="賣出價格"
                          type="number"
                          size="small"
                          value={rec.sellPrice || ""}
                          onChange={(e) => {
                            const newRecs = [...records];
                            newRecs[index].sellPrice = Number(e.target.value);
                            setRecords(newRecs);
                          }}
                        />
                      </Stack>
                    )}
                  </Stack>
                </Box>
              ))}
              <Button
                startIcon={<AddCircleOutlineIcon />}
                variant="outlined"
                fullWidth
                onClick={() =>
                  setRecords([
                    ...records,
                    {
                      id: Date.now().toString(),
                      buyDate: "",
                      buyShares: 0,
                      buyPrice: 0,
                      isSold: false,
                      sellDate: "",
                      sellShares: 0,
                      sellPrice: 0,
                    },
                  ])
                }
              >
                增加交易紀錄
              </Button>
            </Box>
          )}

          <Divider />

          {/* 總結區塊 */}
          <Box sx={{ py: 2 }}>
            {/* 第一列：核心損益 */}
            <Grid container spacing={2} textAlign="center" sx={{ mb: 2 }}>
              <Grid size={4}>
                <Typography variant="caption" color="text.secondary">
                  股價價差
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: getTrendColor(
                      tab === 0
                        ? simpleResult.priceGain
                        : tieredResult.totalPriceGain,
                    ),
                  }}
                >
                  $
                  {(tab === 0
                    ? simpleResult.priceGain
                    : tieredResult.totalPriceGain
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid size={4}>
                <Typography variant="caption" color="text.secondary">
                  累計領息 (稅後)
                </Typography>
                <Typography variant="h6" color="primary.main">
                  $
                  {(tab === 0
                    ? simpleResult.totalDiv
                    : tieredResult.totalDiv
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Typography>
              </Grid>
              <Grid size={4}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  含息總損益
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{
                    color: getTrendColor(
                      (tab === 0 ? simpleResult : tieredResult).total,
                    ),
                  }}
                >
                  $
                  {(tab === 0
                    ? simpleResult
                    : tieredResult
                  ).total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 1, borderStyle: "dashed" }} />

            {/* 第二列：退稅試算 (亮點功能) */}
            <Grid container spacing={2} textAlign="center">
              <Grid size={6}>
                <Typography variant="caption" color="text.secondary">
                  <Tooltip title="基於歷史 ROC 比例試算之次年退稅總額">
                    <Box
                      component="span"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "help",
                      }}
                    >
                      預計退稅{" "}
                      <InfoOutlinedIcon sx={{ fontSize: 12, ml: 0.5 }} />
                    </Box>
                  </Tooltip>
                </Typography>
                <Typography
                  variant="subtitle1"
                  color="success.main"
                  fontWeight="bold"
                >
                  +$
                  {(tab === 0
                    ? simpleResult
                    : tieredResult
                  ).totalRefund.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Typography>
              </Grid>
              <Grid size={6}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  含退稅總額 (最終盈虧)
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  sx={{
                    color: getTrendColor(
                      (tab === 0 ? simpleResult : tieredResult).totalWithRefund,
                    ),
                  }}
                >
                  $
                  {(tab === 0
                    ? simpleResult
                    : tieredResult
                  ).totalWithRefund.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </Typography>
              </Grid>
            </Grid>
          </Box>
          <Divider sx={{ my: 2 }} />

          <Box sx={{ px: 1, opacity: 0.7 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              align="center"
              sx={{ lineHeight: 1.5 }}
            >
              ⚠️
              免責聲明：本工具提供之試算結果（含配息、價差及權值調整）僅供參考，不保證數據之即時性與準確性。
              實際損益請以券商帳單為準。投資標的過去績效不代表未來表現，使用者應獨立評估風險並自負投資損益。
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};
