import { BankMappings } from "@/data/rates.ts";
import type { Rate } from "@/types/rates.ts";
import {
  Stack,
  TextField,
  Radio,
  Typography,
  RadioGroup,
  FormControlLabel,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { useMemo, useState } from "react";

export interface IRateCalculator {
  rates: Rate[];
  currencies: { [p in string]: string };
}

type ExchangeDirection = "bank_buy" | "bank_sell";

const formatAmount = (value: number, maximumFractionDigits = 4) =>
  value.toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

export function RateCalculator(props: IRateCalculator) {
  const [direction, setDirection] = useState<ExchangeDirection>("bank_sell");
  const [input, setInput] = useState("");
  const baseCurrency = props.rates[0]?.base ?? "";
  const baseCurrencyName = props.currencies[baseCurrency] ?? baseCurrency;
  const recordDate = props.rates[0]?.record_date ?? "";
  const inputAmount = Number(input);
  const canCalculate = Number.isFinite(inputAmount) && inputAmount > 0;
  const resultRows = useMemo(
    () =>
      props.rates.map((rate) => {
        const exchangeRate =
          direction === "bank_buy" ? rate.buy_rate : rate.sell_rate;

        return {
          ...rate,
          exchangeRate,
          amount: inputAmount * exchangeRate,
        };
      }),
    [direction, inputAmount, props.rates],
  );

  if (props.rates.length === 0) {
    return (
      <Typography color={"text.secondary"}>目前沒有可試算的匯率資料</Typography>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Typography variant={"h6"} fontWeight={700}>
          {recordDate} 匯率試算
        </Typography>
        <Typography variant={"body2"} color={"text.secondary"}>
          {baseCurrencyName}，共 {props.rates.length} 家銀行資料
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          fullWidth
          type={"number"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={"輸入金額"}
          label={`請輸入${baseCurrencyName}金額`}
          inputProps={{ min: 0, step: "0.01" }}
        />
        <RadioGroup
          row
          value={direction}
          onChange={(event) =>
            setDirection(event.target.value as ExchangeDirection)
          }
          sx={{ minWidth: { sm: 240 } }}
        >
          <FormControlLabel
            control={<Radio />}
            label={"銀行買入"}
            value={"bank_buy"}
          />
          <FormControlLabel
            control={<Radio />}
            label={"銀行賣出"}
            value={"bank_sell"}
          />
        </RadioGroup>
      </Stack>

      <Alert severity={"info"} variant={"outlined"}>
        {direction === "bank_buy"
          ? `銀行買入：你把 ${baseCurrencyName} 賣給銀行，換成新台幣。`
          : `銀行賣出：你向銀行買 ${baseCurrencyName}，需要支付新台幣。`}
      </Alert>

      <TableContainer component={Paper} variant={"outlined"}>
        <Table size={"small"}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>銀行</TableCell>
              <TableCell align={"right"} sx={{ fontWeight: 700 }}>
                匯率
              </TableCell>
              <TableCell align={"right"} sx={{ fontWeight: 700 }}>
                換算金額
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resultRows.map((rate) => (
              <TableRow
                hover
                key={`${rate.base}-${rate.record_date}-${rate.service_name}`}
              >
                <TableCell>
                  {BankMappings[rate.service_name] ?? rate.service_name}
                </TableCell>
                <TableCell align={"right"}>
                  {formatAmount(rate.exchangeRate, 6)}
                </TableCell>
                <TableCell align={"right"}>
                  {canCalculate ? `NT$ ${formatAmount(rate.amount, 2)}` : "--"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
