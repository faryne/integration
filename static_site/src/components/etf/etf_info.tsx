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
} from "@mui/material";
import { useState } from "react";
import { type EtfInfo } from "@/types/etf.ts";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

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

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        {data.code} - {data.description}
      </Typography>
      <Stack direction={"column"} spacing={3}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            ROC 篩選：
          </Typography>
          <Chip
            label="全部"
            onClick={() => setRocFilter("ALL")}
            variant={rocFilter === "ALL" ? "filled" : "outlined"}
            size="small"
          />
          <Chip
            label="獲利為主 (0%)"
            color="success"
            onClick={() => setRocFilter("PROFIT")}
            variant={rocFilter === "PROFIT" ? "filled" : "outlined"}
            size="small"
          />
          <Chip
            label="部分本金"
            color="warning"
            onClick={() => setRocFilter("PARTIAL")}
            variant={rocFilter === "PARTIAL" ? "filled" : "outlined"}
            size="small"
          />
          <Chip
            label="本金返還 (>80%)"
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
                          <Tooltip title={`ROC 比例: ${rocValue.toFixed(2)}%`}>
                            <Chip
                              icon={icon}
                              label={`${label} - ${rocValue.toFixed(2)}%`}
                              color={color}
                              variant="outlined"
                              size="small"
                              sx={{ fontWeight: "bold" }}
                            />
                          </Tooltip>
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
