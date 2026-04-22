import {
  Typography,
  Stack,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  Chip,
  Divider,
  TableBody,
  Box,
  TableContainer,
  Paper,
  Button,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { useGetTwStatsByName } from "@/apis/opendata/twstats.ts";
import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";
import { useEffect, useState } from "react";
import { useTitle } from "@/helpers/title.tsx";
import { LineChart, type LineSeries } from "@mui/x-charts/LineChart";

function groupNumbers(start: number, end: number) {
  const numbers = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const groups = [];
  let currentGroup = [];

  for (const num of numbers) {
    currentGroup.push(num);
    if (num % 5 === 0) {
      groups.push(currentGroup);
      currentGroup = [];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

export function TwStatsByName() {
  const p = useParams();
  const s = useGetTwStatsByName(p?.name ?? "");
  const [lineChartSeries, setLineChartSeries] = useState<LineSeries[]>([]);
  const [yearGroup, setYearGroup] = useState<number[][]>([]);

  useTitle("台灣指標" + (p?.name ? " - " + p?.name : ""));

  const [chooseAreas, setChooseAreas] = useState<TWArea[]>(
    Object.keys(TWAreaMappings) as Array<keyof typeof TWAreaMappings>,
  );
  const [chooseYears, setChooseYears] = useState<string[]>(
    Object.keys(s.data ?? {}),
  );

  useEffect(() => {
    if (s.data) {
      const keys = Object.keys(s.data);
      const newKeys = keys.map((o) => parseInt(o, 10));
      let [min, max] = [0, 0];
      for (const i in newKeys) {
        if (min == 0) {
          [min, max] = [newKeys[i], newKeys[i]];
        }
        if (newKeys[i] > min) {
          max = newKeys[i];
        }
      }
      setYearGroup(groupNumbers(min, max));

      setChooseYears(keys);
    }
  }, [s.data]);

  useEffect(() => {
    setLineChartSeries(
      chooseAreas.map((area) => ({
        label: TWAreaMappings[area],
        data: Object.entries(s.data ?? {})
          .filter((tv) => chooseYears.indexOf(tv[0]) >= 0)
          .map((v) => (v[1][area] === "-" ? 0 : parseFloat(v[1][area]))),
      })),
    );
  }, [chooseAreas, chooseYears]);

  return (
    <>
      <Stack direction={"column"}>
        <Typography variant={"h2"}>{p?.name}</Typography>
        <Typography variant={"body1"}>{s.data?.["1998"]?.Explain}</Typography>
        <Typography variant={"body1"}>
          單位：{s.data?.["1998"]?.Unit}
        </Typography>
        <Typography variant={"body2"}>
          資料網址：
          <code>
            https://raw.githubusercontent.com/faryne/tw-stats/master/docs/
            {p?.name}/index.json
          </code>
        </Typography>
        <Divider sx={{ margin: "10px 0" }} />
        <Stack
          direction={"column"}
          spacing={2}
          flexWrap={"wrap"}
          lineHeight={1.5}
        >
          <Grid container>
            <Grid size={1}>年份</Grid>
            <Grid size={11}>
              <Stack direction={"row"} spacing={1}>
                {yearGroup.map((v) => (
                  <Button
                    variant={"outlined"}
                    key={`${v[0]}-${v[v.length - 1]}`}
                    onClick={() => setChooseYears(v.map(String))}
                  >
                    {v[0]}~{v[v.length - 1]}
                  </Button>
                ))}
              </Stack>
              <Divider sx={{ margin: "10px 0" }} />
              <Stack
                direction={"row"}
                spacing={0.5}
                flexWrap={"wrap"}
                useFlexGap
              >
                {Object.keys(s?.data ?? {}).map((v) => (
                  <Chip
                    key={v}
                    label={v}
                    color={chooseYears.indexOf(v) < 0 ? "default" : "primary"}
                    onClick={() => {
                      setChooseYears((o) => {
                        const tmp = o;
                        if (o.indexOf(v) >= 0) {
                          tmp.splice(o.indexOf(v), 1);
                          return [...tmp];
                        }
                        return [...tmp, ...[v]];
                      });
                    }}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
          <Grid container>
            <Grid size={1}>所屬區域</Grid>
            <Grid size={11}>
              <Stack direction={"row"} spacing={1}>
                <Button
                  key="Taiwan"
                  variant={"outlined"}
                  onClick={() =>
                    setChooseAreas(
                      (Object.keys(TWAreaMappings) as TWArea[]).filter(
                        (v) => v !== "Taiwan",
                      ),
                    )
                  }
                >
                  除台灣之外所有縣市
                </Button>
                <Button
                  key="Taiwan"
                  variant={"outlined"}
                  onClick={() => setChooseAreas(["Taiwan"])}
                >
                  僅台灣
                </Button>
                <Button
                  key="six_city"
                  variant={"outlined"}
                  onClick={() =>
                    setChooseAreas([
                      "Taipei",
                      "NewTaipei",
                      "Taoyuan",
                      "Taichung",
                      "Tainan",
                      "Kaohsiung",
                    ])
                  }
                >
                  僅六都
                </Button>
                <Button
                  key="ProvincialCity"
                  variant={"outlined"}
                  onClick={() =>
                    setChooseAreas(["Keelung", "HsinchuCity", "ChiaYiCity"])
                  }
                >
                  原臺灣省轄市
                </Button>
                <Button
                  key="County"
                  variant={"outlined"}
                  onClick={() =>
                    setChooseAreas(
                      Object.entries(TWAreaMappings)
                        .filter(
                          (v) =>
                            v[1].indexOf("縣") >= 0 &&
                            v[0] !== "Kinmen" &&
                            v[0] !== "Matsu",
                        )
                        .map((v) => v[0]) as TWArea[],
                    )
                  }
                >
                  台灣省下轄縣
                </Button>
                <Button
                  key="County"
                  variant={"outlined"}
                  onClick={() =>
                    setChooseAreas(
                      Object.entries(TWAreaMappings)
                        .filter((v) => v[0] === "Kinmen" || v[0] === "Matsu")
                        .map((v) => v[0]) as TWArea[],
                    )
                  }
                >
                  福建省下轄縣
                </Button>
                <Button
                  key="County"
                  variant={"outlined"}
                  onClick={() => setChooseAreas(["Penghu", "Kinmen", "Matsu"])}
                >
                  離島縣
                </Button>
              </Stack>
              <Divider sx={{ margin: "10px 0" }} />
              <Stack
                direction={"row"}
                spacing={0.5}
                flexWrap={"wrap"}
                useFlexGap
              >
                {(
                  Object.keys(TWAreaMappings) as Array<
                    keyof typeof TWAreaMappings
                  >
                ).map((v) => (
                  <Chip
                    key={v}
                    color={chooseAreas.indexOf(v) < 0 ? "default" : "primary"}
                    label={TWAreaMappings[v]}
                    onClick={() => {
                      setChooseAreas((o) => {
                        const tmp = o;
                        if (o.indexOf(v) >= 0) {
                          tmp.splice(o.indexOf(v), 1);
                          return [...tmp];
                        }
                        return [...tmp, ...[v]] as TWArea[];
                      });
                    }}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>

          <Divider sx={{ margin: "10px 0" }} />

          <LineChart
            height={400}
            series={lineChartSeries}
            xAxis={[
              {
                scaleType: "band",
                data: chooseYears.map((v) => v + "年"),
              },
            ]}
          />

          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <TableContainer component={Paper}>
              <Table width={"100%"}>
                <TableHead>
                  <TableRow>
                    <TableCell>年份</TableCell>
                    {chooseAreas.map((v) => (
                      <TableCell key={v}>{TWAreaMappings[v] ?? ""}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {s.data &&
                    Object.entries(s.data)
                      .filter((tv) => chooseYears.indexOf(tv[0]) >= 0)
                      .map((v) => (
                        <TableRow key={v[0] ?? ""}>
                          <TableCell key={v[0]}>{v[0] ?? ""}</TableCell>
                          {chooseAreas.map((v1) => (
                            <TableCell key={(v[0] ?? "") + v1}>
                              {v[1][v1] ?? ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </Stack>
    </>
  );
}
