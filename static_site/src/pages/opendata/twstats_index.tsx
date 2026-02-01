import {
  Backdrop,
  Stack,
  TextField,
  Card,
  CardHeader,
  Grid,
  Typography,
} from "@mui/material";
import { useGetTwStatsIndex } from "@/apis/opendata/twstats.ts";
import { useState } from "react";

export function TwStatsIndex() {
  const s = useGetTwStatsIndex();
  const [keyword, setKeyword] = useState("");

  const filterFunc = (key: string, v: string) =>
    key === "" || v.includes(keyword);
  return (
    <>
      <Backdrop open={s.isLoading && s.isSuccess}>Loading</Backdrop>
      <Stack textAlign={"center"} spacing={3}>
        <TextField
          type={"text"}
          placeholder={"請輸入要查詢的指標關鍵字"}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Stack direction={"column"} spacing={2} textAlign={"left"}>
          <Typography variant={"subtitle2"}>
            目前共有{" "}
            {
              Object.values(s.data ?? {}).filter((v) => filterFunc(keyword, v))
                .length
            }{" "}
            個符合條件指標
          </Typography>
          <Grid container spacing={1} flex={1} justifyContent={"left"}>
            {Object.values(s.data ?? {})
              .filter((v) => filterFunc(keyword, v))
              .map((v) => (
                <Grid size={3}>
                  <Card title={v}>
                    <CardHeader
                      component={"a"}
                      href={`/data/tw-stats/${v}`}
                      title={v}
                    />
                  </Card>
                </Grid>
              ))}
          </Grid>
        </Stack>
      </Stack>
    </>
  );
}
