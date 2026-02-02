import { useFireDepartmentRealtimeEvents } from "@/apis/opendata/firedepartment.ts";
import { useEffect, useState } from "react";
import {
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Stack,
} from "@mui/material";
import { TWAreaMappings } from "@/types/twstats.ts";
import dayjs from "dayjs";

export function FireDepartmentRealtime() {
  const [q, setQ] = useState<string>(new Date().toString());
  const s = useFireDepartmentRealtimeEvents(q);

  useEffect(() => {
    const timer = setInterval(() => setQ(new Date().toString()), 300000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <Stack direction={"column"} spacing={2}>
        {s.data &&
          Object.entries(s?.data.data ?? {}).map(([k, v]) => (
            <>
              <Typography variant={"h4"}>
                {TWAreaMappings[k as keyof typeof TWAreaMappings]}
              </Typography>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>時間</TableCell>
                    <TableCell>地點(經緯度資訊)</TableCell>
                    <TableCell>事件</TableCell>
                    <TableCell>派車資訊</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {v.map((e) => (
                    <TableRow>
                      <TableCell>
                        {dayjs(e.timestamp * 1000).format(
                          "YYYY-MM-DD HH:mm:ss",
                        )}
                      </TableCell>
                      <TableCell>
                        {e.endpoint_info}{" "}
                        {(e.lng && e.lat && `(${e.lat}, ${e.lng})`) || ""}
                      </TableCell>
                      <TableCell>
                        {e.event_type} - {e.sub_type}
                      </TableCell>
                      <TableCell>{e.cars ? e.cars.join(", ") : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ))}
      </Stack>
    </>
  );
}
