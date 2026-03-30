import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import { Button, Stack, TextField } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import dayjs from "dayjs";

export interface IVideoSearch {
  onClick: (input: VideoSearchRequest) => void;
  conditions?: VideoSearchRequest;
}
export function VideoSearch(props: IVideoSearch) {
  const [req, setReq] = useState<VideoSearchRequest>({
    page: 1,
  });
  useEffect(() => {
    if (props.conditions) {
      setReq((o) => ({ ...o, ...props.conditions }));
    }
  }, [props.conditions]);

  return (
    <>
      <Stack direction={"column"} spacing={2} sx={{ marginTop: "10px" }}>
        <TextField
          label={"關鍵字"}
          variant={"outlined"}
          onChange={(e) => {
            setReq((o) => ({ ...o, ...{ keyword: e.target.value } }));
          }}
          value={req.keyword}
        />
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="開始日期"
            value={req.start_date ? dayjs(req.start_date) : null}
            onChange={(newValue) => {
              if (newValue?.isValid()) {
                setReq((prev) => ({
                  ...prev,
                  start_date: newValue?.format("YYYY-MM-DD") || "",
                }));
              } else {
                setReq((o) => {
                  const tmp = o;
                  if (tmp.start_date) {
                    delete tmp.start_date;
                  }
                  return { ...tmp };
                });
              }
            }}
          />
          <DatePicker
            label="結束日期"
            value={req.end_date ? dayjs(req.end_date) : null}
            onChange={(newValue) => {
              if (newValue?.isValid()) {
                setReq((prev) => ({
                  ...prev,
                  end_date: newValue?.format("YYYY-MM-DD") || "",
                }));
              } else {
                setReq((o) => {
                  const tmp = o;
                  if (tmp.end_date) {
                    delete tmp.end_date;
                  }
                  return { ...tmp };
                });
              }
            }}
          />
        </LocalizationProvider>

        <Button onClick={() => props.onClick(req)} variant={"contained"}>
          搜尋
        </Button>
      </Stack>
    </>
  );
}
