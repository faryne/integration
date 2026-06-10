import {
  Alert,
  Avatar,
  Backdrop,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  List,
  ListItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Grid,
  InputAdornment,
} from "@mui/material";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SearchIcon from "@mui/icons-material/Search";
import {
  type GetCurrencyRatesRequest,
  useGetCurrencies,
  useGetCurrencyRates,
} from "@/apis/opendata/rates.ts";
import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  BankMappings,
  BankVisualMappings,
  getCurrencyFlag,
} from "@/data/rates.ts";
import { useTitle } from "@/helpers/title.tsx";
import { type Rate } from "@/types/rates.ts";

interface RateDateGroup {
  recordDate: string;
  rates: Rate[];
}

type ExchangeDirection = "bank_buy" | "bank_sell";

const formatAmount = (value: number, maximumFractionDigits = 4) =>
  value.toLocaleString("zh-TW", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });

const getRateKey = (rate: Rate) =>
  `${rate.base}-${rate.record_date}-${rate.service_name}`;

const isDisplayableRate = (rate: Rate) =>
  rate.buy_rate > 0 || rate.sell_rate > 0;

const getExchangeRate = (rate: Rate, direction: ExchangeDirection) =>
  direction === "bank_buy" ? rate.buy_rate : rate.sell_rate;

const renderCurrencyLabel = (code: string, name: string) => (
  <Stack direction={"row"} spacing={1} alignItems={"center"}>
    <Typography component={"span"} aria-hidden>
      {getCurrencyFlag(code)}
    </Typography>
    <Typography component={"span"} fontWeight={700}>
      {code}
    </Typography>
    <Typography component={"span"} color={"text.secondary"}>
      {name}
    </Typography>
  </Stack>
);

const renderBankLabel = (bank: Rate["service_name"]) => {
  const visual = BankVisualMappings[bank];

  return (
    <Stack direction={"row"} spacing={1} alignItems={"center"}>
      <Avatar
        variant={"rounded"}
        sx={{
          width: 28,
          height: 28,
          bgcolor: visual?.color ?? "grey.500",
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {visual?.mark ?? bank.slice(0, 1)}
      </Avatar>
      <Typography component={"span"}>{BankMappings[bank] ?? bank}</Typography>
    </Stack>
  );
};

export function RatesIndex() {
  const currencies = useGetCurrencies();
  const [rateRequest, setRateRequest] = useState<GetCurrencyRatesRequest>({
    begin_date: dayjs().format("YYYY-MM-DD"),
    currencies: ["USD"],
  });
  const [chooseCurrency, setChooseCurrency] = useState("USD");
  const [currencyKeyword, setCurrencyKeyword] = useState("");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [exchangeDirection, setExchangeDirection] =
    useState<ExchangeDirection>("bank_sell");
  const ratesQuery = useGetCurrencyRates(rateRequest);

  useTitle("匯率");

  const currencyOptions = useMemo(
    () =>
      Object.entries(currencies.data?.data ?? {}).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    [currencies.data?.data],
  );
  const selectedCurrencies = rateRequest.currencies ?? [];
  const filteredCurrencyOptions = useMemo(() => {
    const keyword = currencyKeyword.trim().toLowerCase();

    if (!keyword) {
      return currencyOptions;
    }

    return currencyOptions.filter(
      ([code, name]) =>
        code.toLowerCase().includes(keyword) ||
        name.toLowerCase().includes(keyword),
    );
  }, [currencyOptions, currencyKeyword]);
  const ratesByCurrency = useMemo<Record<string, RateDateGroup[]>>(() => {
    const bankOrder = Object.keys(BankMappings);
    const grouped = new Map<string, Map<string, Rate[]>>();

    for (const rate of ratesQuery.data?.data ?? []) {
      if (!grouped.has(rate.base)) {
        grouped.set(rate.base, new Map());
      }

      const dateGroups = grouped.get(rate.base)!;
      const dateRates = dateGroups.get(rate.record_date) ?? [];
      dateRates.push(rate);
      dateGroups.set(rate.record_date, dateRates);
    }

    return Object.fromEntries(
      Array.from(grouped.entries()).map(([currency, dateGroups]) => [
        currency,
        Array.from(dateGroups.entries())
          .map(([recordDate, dateRates]) => ({
            recordDate,
            rates: dateRates.sort(
              (a, b) =>
                bankOrder.indexOf(a.service_name) -
                bankOrder.indexOf(b.service_name),
            ),
          }))
          .sort((a, b) => b.recordDate.localeCompare(a.recordDate)),
      ]),
    );
  }, [ratesQuery.data?.data]);
  const activeCurrencyName = chooseCurrency
    ? (currencies.data?.data?.[chooseCurrency] ?? chooseCurrency)
    : "";
  const activeCurrencyLabel = chooseCurrency
    ? `${getCurrencyFlag(chooseCurrency)} ${activeCurrencyName}`
    : "";
  const selectedCurrencyCount = selectedCurrencies.length;
  const currentCurrencyGroups = useMemo(
    () =>
      (ratesByCurrency[chooseCurrency] ?? [])
        .map((group) => ({
          ...group,
          rates: group.rates.filter(isDisplayableRate),
        }))
        .filter((group) => group.rates.length > 0),
    [chooseCurrency, ratesByCurrency],
  );
  const currentCurrencyRowCount = currentCurrencyGroups.reduce(
    (total, group) => total + group.rates.length,
    0,
  );
  const exchangeInputAmount = Number(exchangeAmount);
  const canCalculate =
    Number.isFinite(exchangeInputAmount) && exchangeInputAmount > 0;
  const exchangeResultByRate = useMemo(() => {
    const result = new Map<string, number>();

    for (const group of currentCurrencyGroups) {
      for (const rate of group.rates) {
        const exchangeRate = getExchangeRate(rate, exchangeDirection);

        if (exchangeRate > 0) {
          result.set(getRateKey(rate), exchangeInputAmount * exchangeRate);
        }
      }
    }

    return result;
  }, [currentCurrencyGroups, exchangeDirection, exchangeInputAmount]);
  const bestRateKeyByDate = useMemo(() => {
    if (!canCalculate) {
      return new Map<string, string>();
    }

    return new Map(
      currentCurrencyGroups.flatMap((group) => {
        const rankedRates = group.rates
          .filter((rate) => getExchangeRate(rate, exchangeDirection) > 0)
          .map((rate) => {
            const key = getRateKey(rate);
            return {
              key,
              amount: exchangeResultByRate.get(key) ?? 0,
            };
          })
          .sort((a, b) =>
            exchangeDirection === "bank_buy"
              ? b.amount - a.amount
              : a.amount - b.amount,
          );

        return rankedRates[0] ? [[group.recordDate, rankedRates[0].key]] : [];
      }),
    );
  }, [
    canCalculate,
    currentCurrencyGroups,
    exchangeDirection,
    exchangeResultByRate,
  ]);

  useEffect(() => {
    if (
      selectedCurrencies.length > 0 &&
      !selectedCurrencies.includes(chooseCurrency)
    ) {
      setChooseCurrency(selectedCurrencies[0]);
    }

    if (selectedCurrencies.length === 0 && chooseCurrency !== "") {
      setChooseCurrency("");
    }
  }, [chooseCurrency, selectedCurrencies]);

  const handleCurrencyToggle = useCallback(
    (code: string, checked: boolean) => {
      const nextCurrencies = checked
        ? Array.from(new Set([...selectedCurrencies, code]))
        : selectedCurrencies.filter((currency) => currency !== code);

      setRateRequest((current) => ({
        ...current,
        currencies: nextCurrencies,
      }));
      setChooseCurrency((current) =>
        nextCurrencies.includes(current) ? current : (nextCurrencies[0] ?? ""),
      );
    },
    [selectedCurrencies],
  );

  return (
    <>
      <Backdrop
        open={currencies.isLoading || ratesQuery.isFetching}
        sx={{
          color: "common.white",
          zIndex: (theme) => theme.zIndex.modal + 1,
        }}
      >
        <Stack direction={"row"} spacing={1.5} alignItems={"center"}>
          <CircularProgress color={"inherit"} size={22} />
          <Typography>Loading</Typography>
        </Stack>
      </Backdrop>
      <Stack spacing={3}>
        <Box>
          <Typography variant={"h4"} fontWeight={700}>
            匯率查詢
          </Typography>
          <Typography color={"text.secondary"}>
            選擇幣別與日期區間，輸入金額即可直接比較各銀行換算結果。
          </Typography>
        </Box>

        {(currencies.isError || ratesQuery.isError) && (
          <Alert severity={"error"}>
            匯率資料載入失敗，請稍後再試或調整查詢條件。
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper variant={"outlined"} sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant={"subtitle1"} fontWeight={700}>
                    幣別
                  </Typography>
                  <Typography variant={"body2"} color={"text.secondary"}>
                    已選 {selectedCurrencyCount} 個
                  </Typography>
                </Box>
                <TextField
                  size={"small"}
                  type={"search"}
                  placeholder={"搜尋代碼或名稱"}
                  value={currencyKeyword}
                  onChange={(e) => setCurrencyKeyword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position={"start"}>
                        <SearchIcon fontSize={"small"} />
                      </InputAdornment>
                    ),
                  }}
                />
                <Stack direction={"row"} spacing={1}>
                  <Button
                    size={"small"}
                    variant={"outlined"}
                    onClick={() => {
                      setRateRequest((current) => ({
                        ...current,
                        currencies: ["USD"],
                      }));
                      setChooseCurrency("USD");
                    }}
                    startIcon={<RestartAltIcon />}
                  >
                    重設
                  </Button>
                </Stack>
                <List
                  dense
                  sx={{
                    maxHeight: { xs: 260, md: 560 },
                    overflowY: "auto",
                    pr: 1,
                  }}
                >
                  {filteredCurrencyOptions.map(([code, name]) => (
                    <ListItem disableGutters key={`currency-${code}`}>
                      <FormControlLabel
                        sx={{ width: "100%", mr: 0 }}
                        control={
                          <Checkbox
                            checked={selectedCurrencies.includes(code)}
                            onChange={(event) =>
                              handleCurrencyToggle(code, event.target.checked)
                            }
                          />
                        }
                        label={
                          <Stack
                            direction={"row"}
                            spacing={1}
                            alignItems={"center"}
                            justifyContent={"space-between"}
                            sx={{ width: "100%" }}
                          >
                            <Stack
                              direction={"row"}
                              spacing={1}
                              alignItems={"center"}
                            >
                              <Typography component={"span"} aria-hidden>
                                {getCurrencyFlag(code)}
                              </Typography>
                              <Typography fontWeight={700}>{code}</Typography>
                            </Stack>
                            <Typography
                              color={"text.secondary"}
                              textAlign={"right"}
                            >
                              {name}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 9 }}>
            <Stack spacing={2.5}>
              <Paper variant={"outlined"} sx={{ p: 2 }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <TextField
                    fullWidth
                    type={"date"}
                    label={"開始日期"}
                    value={rateRequest.begin_date}
                    onChange={(e) => {
                      setRateRequest((oldData) => ({
                        ...oldData,
                        begin_date: e.target.value,
                      }));
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    fullWidth
                    type={"date"}
                    label={"結束日期"}
                    value={rateRequest.end_date ?? ""}
                    onChange={(e) => {
                      setRateRequest((oldData) => ({
                        ...oldData,
                        end_date: e.target.value || undefined,
                      }));
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Stack>
              </Paper>

              <Paper variant={"outlined"} sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant={"subtitle1"} fontWeight={700}>
                      換匯試算
                    </Typography>
                    <Typography variant={"body2"} color={"text.secondary"}>
                      以目前分頁的 {activeCurrencyLabel || "幣別"}{" "}
                      金額計算新台幣結果
                    </Typography>
                  </Box>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ xs: "stretch", md: "center" }}
                  >
                    <TextField
                      fullWidth
                      type={"number"}
                      label={`輸入${activeCurrencyLabel || "外幣"}金額`}
                      value={exchangeAmount}
                      onChange={(event) =>
                        setExchangeAmount(event.target.value)
                      }
                      inputProps={{ min: 0, step: "0.01" }}
                    />
                    <RadioGroup
                      row
                      value={exchangeDirection}
                      onChange={(event) =>
                        setExchangeDirection(
                          event.target.value as ExchangeDirection,
                        )
                      }
                      sx={{ minWidth: { md: 260 } }}
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
                    {exchangeDirection === "bank_buy"
                      ? `銀行買入：你把 ${activeCurrencyLabel || "外幣"} 賣給銀行，換成新台幣；表格會標示同日可換到最多新台幣的銀行。`
                      : `銀行賣出：你向銀行買 ${activeCurrencyLabel || "外幣"}，支付新台幣；表格會標示同日成本最低的銀行。`}
                  </Alert>
                </Stack>
              </Paper>

              {selectedCurrencyCount === 0 ? (
                <Alert severity={"info"}>請至少選擇一個幣別。</Alert>
              ) : (
                <>
                  <Box>
                    <Tabs
                      value={chooseCurrency}
                      variant={"scrollable"}
                      scrollButtons={"auto"}
                      onChange={(_, v) => {
                        setChooseCurrency(v);
                      }}
                      sx={{ borderBottom: 1, borderColor: "divider" }}
                    >
                      {selectedCurrencies.map((currency) => (
                        <Tab
                          value={currency}
                          key={`tab-${currency}`}
                          label={renderCurrencyLabel(
                            currency,
                            currencies.data?.data?.[currency] ?? "",
                          )}
                        />
                      ))}
                    </Tabs>
                  </Box>

                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent={"space-between"}
                  >
                    <Box>
                      <Typography variant={"h6"} fontWeight={700}>
                        {activeCurrencyLabel}
                      </Typography>
                      <Typography variant={"body2"} color={"text.secondary"}>
                        共 {currentCurrencyGroups.length} 個日期，
                        {currentCurrencyRowCount} 筆銀行匯率
                      </Typography>
                    </Box>
                    {rateRequest.end_date && (
                      <Chip
                        size={"small"}
                        label={`${rateRequest.begin_date} 至 ${rateRequest.end_date}`}
                      />
                    )}
                  </Stack>

                  <Divider />

                  <TableContainer component={Paper} variant={"outlined"}>
                    <Table size={"small"}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>日期</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>銀行</TableCell>
                          <TableCell align={"right"} sx={{ fontWeight: 700 }}>
                            賣出匯率
                          </TableCell>
                          <TableCell align={"right"} sx={{ fontWeight: 700 }}>
                            買入匯率
                          </TableCell>
                          <TableCell align={"right"} sx={{ fontWeight: 700 }}>
                            換算新台幣
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {currentCurrencyGroups.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align={"center"}>
                              <Typography color={"text.secondary"} py={4}>
                                目前沒有符合條件的匯率資料
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {currentCurrencyGroups.map((group) =>
                          group.rates.map((rate, index) => (
                            <TableRow
                              hover
                              key={`${rate.base}-${rate.record_date}-${rate.service_name}`}
                            >
                              {index === 0 && (
                                <TableCell rowSpan={group.rates.length}>
                                  {group.recordDate}
                                </TableCell>
                              )}
                              <TableCell>
                                {renderBankLabel(rate.service_name)}
                              </TableCell>
                              <TableCell align={"right"}>
                                {rate.sell_rate > 0
                                  ? formatAmount(rate.sell_rate, 6)
                                  : "--"}
                              </TableCell>
                              <TableCell align={"right"}>
                                {rate.buy_rate > 0
                                  ? formatAmount(rate.buy_rate, 6)
                                  : "--"}
                              </TableCell>
                              <TableCell align={"right"}>
                                <Stack
                                  direction={"row"}
                                  spacing={1}
                                  alignItems={"center"}
                                  justifyContent={"flex-end"}
                                >
                                  <Typography component={"span"}>
                                    {canCalculate &&
                                    getExchangeRate(rate, exchangeDirection) > 0
                                      ? `NT$ ${formatAmount(
                                          exchangeResultByRate.get(
                                            getRateKey(rate),
                                          ) ?? 0,
                                          2,
                                        )}`
                                      : "--"}
                                  </Typography>
                                  {bestRateKeyByDate.get(group.recordDate) ===
                                    getRateKey(rate) && (
                                    <Chip
                                      size={"small"}
                                      color={"success"}
                                      label={"最佳"}
                                    />
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          )),
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Stack>
    </>
  );
}
