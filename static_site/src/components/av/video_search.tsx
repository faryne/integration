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
      setReq({ ...props.conditions, page: props.conditions.page ?? 1 });
    }
  }, [props.conditions]);

  const handleSubmit = () => {
    const next = { ...req };
    next.keyword = next.keyword?.trim();

    if (!next.keyword) {
      delete next.keyword;
    }
    if (!next.start_date) {
      delete next.start_date;
    }
    if (!next.end_date) {
      delete next.end_date;
    }

    props.onClick(next);
  };

  return (
    <>
      <Stack direction={"column"} spacing={2} sx={{ marginTop: "10px" }}>
        <TextField
          label={"關鍵字"}
          variant={"outlined"}
          onChange={(e) => {
            setReq((o) => ({ ...o, keyword: e.target.value }));
          }}
          value={req.keyword ?? ""}
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
                  const next = { ...o };
                  delete next.start_date;
                  return next;
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
                  const next = { ...o };
                  delete next.end_date;
                  return next;
                });
              }
            }}
          />
        </LocalizationProvider>

        <Button onClick={handleSubmit} variant={"contained"}>
          搜尋
        </Button>
      </Stack>
    </>
  );
}
