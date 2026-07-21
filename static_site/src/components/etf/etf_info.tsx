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
  Drawer,
} from "@mui/material";
import { useState, useMemo } from "react";
import type { EtfInfo } from "@/types/etf.ts";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { EtfProfitCalculator } from "@/components/etf/etf_profit_calculator.tsx";
import { useYieldMaxSavedTransactions } from "@/apis/local/yieldmax_transactions.ts";

interface EtfTableProps {
  data: EtfInfo;
}

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

  const savedTransactions = useYieldMaxSavedTransactions(data.code);

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
        slotProps={{
          paper: { sx: { width: { xs: "100%", sm: 500, md: 720 }, p: 2 } },
        }}
      >
        {/* Drawer paper 是 flex column，Card 預設 overflow:hidden 會被 flexbox
            擠壓成剛好塞滿可視高度而不是跟著內容變高，導致下面的明細被裁掉、
            無法捲動；用 flexShrink: 0 讓它保持原本內容高度，改由 paper 本身捲動 */}
        <Box sx={{ flexShrink: 0 }}>
          <EtfProfitCalculator
            key={data.code}
            data={data}
            defaultCurrency="USD"
            initialTransactions={savedTransactions.records}
            onSaveTransactions={savedTransactions.save}
            storageScope="local"
          />
        </Box>
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
