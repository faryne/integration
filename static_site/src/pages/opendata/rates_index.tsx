import {
  Grid,
  List,
  ListItem,
  Checkbox,
  Divider,
  Stack,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Box,
  Backdrop,
  Tabs,
  Tab,
  TextField,
  Typography,
} from "@mui/material";
import {
  type GetCurrencyRatesRequest,
  useGetCurrencies,
  useGetCurrencyRates,
} from "@/apis/opendata/rates.ts";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { BankMappings } from "@/types/rates.ts";
import { useTitle } from "@/helpers/title.tsx";
import { RateCalculator } from "@/components/rates/rate_calculator.tsx";
import { CustomModal } from "@/components/common/CustomModal.tsx";
import { type Rate } from "@/types/rates.ts";

export function RatesIndex() {
  const currencies = useGetCurrencies();
  const [rateRequest, setRateRequest] = useState<GetCurrencyRatesRequest>({
    begin_date: dayjs().format("YYYY-MM-DD"),
    currencies: ["USD"],
  });
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);
  const [chooseCurrency, setChooseCurrency] = useState("USD");
  const ratesQuery = useGetCurrencyRates(rateRequest);

  useEffect(() => {
    ratesQuery.refetch();
  }, [rateRequest]);

  useTitle("匯率");

  return (
    <>
      <Backdrop open={ratesQuery.isLoading}>Loading</Backdrop>
      <Grid container>
        <Grid size={3}>
          <List>
            {Object.entries(currencies?.data?.data ?? {}).map((o) => (
              <ListItem
                disableGutters={true}
                key={`currency-${o[0]}`}
                secondaryAction={
                  <Checkbox
                    edge={"end"}
                    checked={rateRequest.currencies?.includes(o[0]) ?? false}
                    onChange={(checked) => {
                      setRateRequest((oldData) => {
                        const tmp = oldData;
                        if (!checked.target.checked) {
                          tmp.currencies = tmp.currencies?.filter(
                            (v) => v !== o[0],
                          );
                          setChooseCurrency(
                            (tmp.currencies ?? []).indexOf(chooseCurrency) >= 0
                              ? chooseCurrency
                              : (tmp.currencies?.[0] ?? ""),
                          );
                        } else {
                          tmp.currencies = [...(tmp.currencies ?? []), o[0]];
                        }
                        return { ...oldData, ...tmp };
                      });
                    }}
                  />
                }
              >
                {o[0] + "-" + o[1]}
              </ListItem>
            ))}
          </List>
        </Grid>
        <Grid size={1}></Grid>
        <Grid size={8}>
          <Box>
            <Stack direction={"row"} spacing={1}>
              <TextField
                type={"date"}
                label={"開始日期"}
                value={rateRequest.begin_date}
                onChange={(e) => {
                  setRateRequest((oldData) => ({
                    ...oldData,
                    begin_date: e.target.value,
                  }));
                }}
              />
              <TextField
                type={"date"}
                label={"結束日期"}
                value={rateRequest.end_date ?? ""}
                onChange={(e) => {
                  setRateRequest((oldData) => ({
                    ...oldData,
                    end_date: e.target.value,
                  }));
                }}
              />
            </Stack>
          </Box>
          <Tabs
            value={chooseCurrency}
            variant={"scrollable"}
            scrollButtons={true}
            onChange={(_, v) => {
              setChooseCurrency(v);
            }}
            sx={{ marginBottom: "10px" }}
          >
            {rateRequest.currencies?.map((c) => (
              <Tab
                value={c}
                key={`tab-${c}`}
                label={currencies.data?.data?.[c] ?? ""}
              />
            ))}
          </Tabs>
          <Divider sx={{ margin: "0 0 10px" }} />
          {rateRequest.currencies?.map((currency) => (
            <Box
              key={`filter-block-${currency}`}
              sx={{ display: chooseCurrency === currency ? "block" : "none" }}
            >
              <Box width={"100%"}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>日期</TableCell>
                      <TableCell>銀行</TableCell>
                      <TableCell>賣出匯率</TableCell>
                      <TableCell>買入匯率</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ratesQuery.data?.data
                      ?.filter((v) => v.base === currency)
                      .map((v2, k2) => (
                        <TableRow key={JSON.stringify(v2)}>
                          {k2 %
                            [
                              ...new Set(
                                ratesQuery.data?.data
                                  ?.filter((v) => v.base === currency)
                                  .map((v2) => v2.service_name),
                              ),
                            ].length ===
                            0 && (
                            <TableCell rowSpan={3}>
                              <Typography
                                component={"button"}
                                onClick={() => {
                                  setRates(
                                    ratesQuery.data?.data.filter(
                                      (v) =>
                                        v.base === currency &&
                                        v.record_date === v2.record_date,
                                    ),
                                  );
                                  setCalculatorOpen(true);
                                }}
                                variant={"body1"}
                              >
                                {v2.record_date}
                              </Typography>
                            </TableCell>
                          )}
                          <TableCell>
                            {BankMappings[v2.service_name] ?? ""}
                          </TableCell>
                          <TableCell>{v2.sell_rate}</TableCell>
                          <TableCell>{v2.buy_rate}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Box>
            </Box>
          ))}
        </Grid>
      </Grid>
      <CustomModal
        open={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      >
        <RateCalculator
          rates={rates ?? []}
          currencies={currencies.data?.data ?? {}}
        />
      </CustomModal>
    </>
  );
}
