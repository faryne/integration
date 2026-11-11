import type { VideoSearchRequest } from "@/apis/av/video_search.ts";
import { Button, Collapse, MenuItem, Stack, TextField } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  AV_VIDEO_EXACT_FILTERS,
  AV_VIDEO_MATCH_HINT,
  AV_VIDEO_PRIMARY_FILTERS,
  AV_VIDEO_RELEASE_OPTIONS,
} from "@/data/avVideoFilters.ts";
import { VideoTermAutocomplete } from "@/components/av/video_term_autocomplete.tsx";

export interface IVideoSearch {
  onClick: (input: VideoSearchRequest) => void;
  conditions?: VideoSearchRequest;
}

const primary = AV_VIDEO_EXACT_FILTERS.filter((f) =>
  AV_VIDEO_PRIMARY_FILTERS.includes(f.param),
);
const secondary = AV_VIDEO_EXACT_FILTERS.filter(
  (f) => !AV_VIDEO_PRIMARY_FILTERS.includes(f.param),
);

// 「更多條件」裡用了幾個（每個值算一個、片長算一個）：有值時預設展開，收合時標題旁顯示
const secondaryCount = (req: VideoSearchRequest) =>
  (req.release ? 1 : 0) +
  secondary.reduce((n, { param }) => n + (req[param]?.length ?? 0), 0) +
  (req.duration_min || req.duration_max ? 1 : 0);

/**
 * 影片搜尋表單：關鍵字、出演、標籤、配信日期常駐，發售商／品牌／系列／監督與片長收在「更多條件」。
 * 精確條件用 autocomplete 挑選，不能自由輸入（完全比對，打錯就查不到）；排序在結果區，表單只負責帶著送出
 */
export function VideoSearch(props: IVideoSearch) {
  const [req, setReq] = useState<VideoSearchRequest>({ page: 1 });
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (props.conditions) {
      setReq({ ...props.conditions, page: props.conditions.page ?? 1 });
      if (secondaryCount(props.conditions) > 0) setMoreOpen(true);
    }
  }, [props.conditions]);

  const set = <K extends keyof VideoSearchRequest>(
    key: K,
    value: VideoSearchRequest[K] | undefined,
  ) =>
    setReq((o) => {
      const next = { ...o, [key]: value };
      // 空字串、空陣列、0 一律拿掉，網址才乾淨
      if (
        value === undefined ||
        value === "" ||
        value === 0 ||
        (Array.isArray(value) && value.length === 0)
      )
        delete next[key];
      return next;
    });

  const handleSubmit = () => {
    const next = { ...req, keyword: req.keyword?.trim() || undefined };
    // 片長最短大於最長時對調
    if (
      next.duration_min &&
      next.duration_max &&
      next.duration_min > next.duration_max
    ) {
      [next.duration_min, next.duration_max] = [
        next.duration_max,
        next.duration_min,
      ];
    }
    props.onClick(next);
  };

  const renderFilter = ({ param, label, field }: (typeof primary)[number]) => (
    <VideoTermAutocomplete
      field={field}
      freeSolo={false}
      items={req[param] ?? []}
      key={param}
      label={`${label}（${AV_VIDEO_MATCH_HINT[param]}）`}
      onChange={(items) => set(param, items)}
    />
  );

  const renderDuration = (
    key: "duration_min" | "duration_max",
    label: string,
  ) => (
    <TextField
      fullWidth
      label={label}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        set(key, Number.isNaN(n) || n <= 0 ? undefined : n);
      }}
      size="small"
      slotProps={{
        htmlInput: { min: 0, inputMode: "numeric" },
        input: { endAdornment: "分" },
      }}
      type="number"
      value={req[key] ?? ""}
    />
  );

  const renderDate = (key: "start_date" | "end_date", label: string) => (
    <DatePicker
      label={label}
      onChange={(v) =>
        set(key, v?.isValid() ? v.format("YYYY-MM-DD") : undefined)
      }
      slotProps={{ textField: { size: "small", fullWidth: true } }}
      value={req[key] ? dayjs(req[key]) : null}
    />
  );

  const usedSecondary = secondaryCount(req);
  return (
    // 包成 form：在輸入框按 Enter 就會送出（autocomplete 選單開著時 Enter 是選選項）
    <Stack
      component="form"
      direction="column"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      spacing={2}
      sx={{ marginTop: "10px" }}
    >
      <TextField
        label="關鍵字"
        onChange={(e) => set("keyword", e.target.value)}
        size="small"
        value={req.keyword ?? ""}
      />
      {primary.map(renderFilter)}
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Stack direction="row" spacing={1}>
          {renderDate("start_date", "開始日期")}
          {renderDate("end_date", "結束日期")}
        </Stack>
      </LocalizationProvider>

      <Button
        color="inherit"
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: moreOpen ? "rotate(180deg)" : "none",
              transition: "transform 160ms",
            }}
          />
        }
        onClick={() => setMoreOpen((v) => !v)}
        sx={{ fontWeight: 800, justifyContent: "space-between", px: 0.5 }}
      >
        {usedSecondary > 0 ? `更多條件（${usedSecondary}）` : "更多條件"}
      </Button>
      <Collapse in={moreOpen} sx={{ mt: "0 !important" }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {/* 配信狀態：預設只看已配信的，可改看即將發售（預約作品）或全部 */}
          <TextField
            label="配信狀態"
            onChange={(e) =>
              set(
                "release",
                (e.target.value || undefined) as VideoSearchRequest["release"],
              )
            }
            select
            size="small"
            value={req.release ?? ""}
          >
            {AV_VIDEO_RELEASE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          {secondary.map(renderFilter)}
          <Stack direction="row" spacing={1}>
            {renderDuration("duration_min", "片長最短")}
            {renderDuration("duration_max", "片長最長")}
          </Stack>
        </Stack>
      </Collapse>

      <Button type="submit" variant="contained">
        搜尋
      </Button>
    </Stack>
  );
}
