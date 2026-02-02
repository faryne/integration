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
} from "@mui/material";
import { useParams } from "react-router-dom";
import { useGetTwStatsByName } from "@/apis/opendata/twstats.ts";
import { type TWArea, TWAreaMappings } from "@/types/twstats.ts";
import { useEffect, useState } from "react";

export function TwStatsByName() {
  const p = useParams();
  const s = useGetTwStatsByName(p?.name ?? "");

  const [chooseAreas, setChooseAreas] = useState<TWArea[]>(
    Object.keys(TWAreaMappings) as Array<keyof typeof TWAreaMappings>,
  );
  const [chooseYears, setChooseYears] = useState<string[]>(
    Object.keys(s.data ?? {}),
  );

  useEffect(() => {
    if (s.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChooseYears(Object.keys(s.data));
    }
  }, [s.data]);

  return (
    <>
      <Stack direction={"column"}>
        <Typography variant={"h2"}>{p?.name}</Typography>
        <Typography variant={"body1"}>{s.data?.["1998"]?.Explain}</Typography>
        <Typography variant={"body1"}>
          單位：{s.data?.["1998"]?.Unit}
        </Typography>
        <Divider sx={{ margin: "10px 0" }} />
        <Grid container>
          <Grid size={8}>
            <Stack
              direction={"column"}
              spacing={2}
              flexWrap={"wrap"}
              lineHeight={1.5}
            >
              <Grid container>
                <Grid size={1}>年份</Grid>
                <Grid size={11}>
                  <Stack
                    direction={"row"}
                    spacing={2}
                    flexWrap={"wrap"}
                    useFlexGap
                  >
                    {Object.keys(s?.data ?? {}).map((v) => (
                      <Chip
                        key={v}
                        label={v}
                        color={
                          chooseYears.indexOf(v) < 0 ? "default" : "primary"
                        }
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
                  <Stack
                    direction={"row"}
                    spacing={2}
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
                        color={
                          chooseAreas.indexOf(v) < 0 ? "default" : "primary"
                        }
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

              <Table width={"100%"}>
                <TableHead>
                  <TableRow>
                    <TableCell>年份</TableCell>
                    {(Object.keys(TWAreaMappings) as TWArea[]).map((v) => (
                      <TableCell
                        sx={{
                          display:
                            chooseAreas.indexOf(v) < 0 ? "none" : "table-cell",
                        }}
                        key={v}
                      >
                        {TWAreaMappings[v] ?? ""}
                      </TableCell>
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
            </Stack>
          </Grid>
          <Grid size={4}></Grid>
        </Grid>
      </Stack>
    </>
  );
}
