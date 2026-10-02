import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import KeyboardDoubleArrowLeftIcon from "@mui/icons-material/KeyboardDoubleArrowLeft";
import KeyboardDoubleArrowRightIcon from "@mui/icons-material/KeyboardDoubleArrowRight";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import type { Dayjs } from "dayjs";
import { type ReactNode, useMemo, useState } from "react";
import {
  dateDescription,
  dateKey,
  type HolidayCalendarData,
  type HolidayCalendarDay,
  indexHolidayCalendarData,
  isWeekend,
  monthGrid,
  today,
  WEEKDAY_LABELS,
  yearLabel,
} from "./holidayCalendar.ts";

export interface HolidayCalendarProps {
  // 依西元年分組的放假資料；沒傳或為空就是一般萬年曆
  data?: HolidayCalendarData;
  // day 為 undefined 代表這天沒有資料
  onClick?: (date: Dayjs, day?: HolidayCalendarDay) => void;
  // 停用的日期：只比對年月日，不觸發 onClick
  disabledDates?: Dayjs[];
  // true 時年份顯示為民國年
  isROCYear?: boolean;
  // 一開始顯示哪個月，預設今天所在月份
  initialMonth?: Dayjs;
}

// 每一格的樣式：放假紅底、週末要上班（補班）黃底；沒有資料的週末只把日期標紅（萬年曆慣例）
function dayCellSx(
  theme: Theme,
  state: { holiday: boolean; makeup: boolean; weekendNoData: boolean },
) {
  const accent = state.holiday
    ? theme.palette.error.main
    : state.makeup
      ? theme.palette.warning.main
      : null;
  return {
    bgcolor: accent ? alpha(accent, 0.1) : "background.paper",
    color: state.holiday || state.weekendNoData ? "error.main" : "text.primary",
  };
}

// 通用日曆：月檢視，標出放假／補班與節日名稱；日期一律用 dayjs。
export function HolidayCalendar({
  data,
  onClick,
  disabledDates,
  isROCYear = false,
  initialMonth,
}: HolidayCalendarProps) {
  const [month, setMonth] = useState(() =>
    (initialMonth ?? today()).startOf("month"),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const index = useMemo(() => indexHolidayCalendarData(data), [data]);
  const disabledKeys = useMemo(
    () => new Set((disabledDates ?? []).map(dateKey)),
    [disabledDates],
  );
  const todayKey = dateKey(today());
  const hasData = index.size > 0;

  function handleClick(date: Dayjs) {
    const key = dateKey(date);
    if (disabledKeys.has(key)) return;
    setSelected(key);
    // 點到前後月的日期，順便切過去
    if (!date.isSame(month, "month")) setMonth(date.startOf("month"));
    onClick?.(date, index.get(key));
  }

  const navButton = (
    label: string,
    amount: number,
    unit: "month" | "year",
    icon: ReactNode,
  ) => (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        sx={{ p: { xs: 0.25, sm: 0.5 } }}
        onClick={() => setMonth((current) => current.add(amount, unit))}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        // 窄螢幕放不下時「今天」換到下一行，不被裁掉
        flexWrap="wrap"
        useFlexGap
        sx={{
          px: { xs: 1, sm: 1.5 },
          py: 1,
          rowGap: 0.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.25}>
          {navButton("上一年", -1, "year", <KeyboardDoubleArrowLeftIcon />)}
          {navButton("上個月", -1, "month", <ChevronLeftIcon />)}
          <Typography
            component="h2"
            fontWeight={800}
            sx={{
              px: { xs: 0.5, sm: 1 },
              minWidth: { xs: 112, sm: 160 },
              fontSize: { xs: 15, sm: 16 },
              textAlign: "center",
            }}
          >
            {yearLabel(month.year(), isROCYear)} {month.month() + 1} 月
          </Typography>
          {navButton("下個月", 1, "month", <ChevronRightIcon />)}
          {navButton("下一年", 1, "year", <KeyboardDoubleArrowRightIcon />)}
        </Stack>
        {hasData && <HolidayCalendarLegend />}
        <Button
          size="small"
          variant="outlined"
          sx={{
            ml: "auto",
            minWidth: { xs: 0, sm: 64 },
            px: { xs: 1, sm: 1.25 },
          }}
          onClick={() => setMonth(today().startOf("month"))}
        >
          今天
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          bgcolor: "action.hover",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <Typography
            key={label}
            variant="caption"
            fontWeight={700}
            textAlign="center"
            sx={{
              py: 0.75,
              color: i === 0 || i === 6 ? "error.main" : "text.secondary",
            }}
          >
            {label}
          </Typography>
        ))}
      </Box>

      <Box
        role="grid"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        }}
      >
        {monthGrid(month).map((date) => {
          const key = dateKey(date);
          const info = index.get(key);
          const disabled = disabledKeys.has(key);
          const makeup = Boolean(info && !info.isHoliday && isWeekend(date));
          return (
            <Box
              key={key}
              component="button"
              type="button"
              role="gridcell"
              aria-label={dateDescription(date, isROCYear, info)}
              aria-disabled={disabled || undefined}
              aria-selected={key === selected}
              onClick={() => handleClick(date)}
              sx={(theme) => ({
                ...dayCellSx(theme, {
                  holiday: Boolean(info?.isHoliday),
                  makeup,
                  weekendNoData: !info && isWeekend(date),
                }),
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: { xs: "center", sm: "flex-start" },
                gap: 0.25,
                minHeight: { xs: 56, sm: 84 },
                p: { xs: 0.5, sm: 0.75 },
                border: 0,
                borderRight: 1,
                borderBottom: 1,
                borderColor: "divider",
                "&:nth-of-type(7n)": { borderRight: 0 },
                font: "inherit",
                textAlign: "left",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: !date.isSame(month, "month")
                  ? 0.38
                  : disabled
                    ? 0.45
                    : 1,
                // 停用：保留放假／補班底色，疊一層斜線讓人一眼看出不能點
                backgroundImage: disabled
                  ? `repeating-linear-gradient(135deg, transparent 0 6px, ${theme.palette.divider} 6px 7px)`
                  : "none",
                boxShadow:
                  key === selected
                    ? `inset 0 0 0 2px ${theme.palette.primary.main}`
                    : "none",
                "&:hover": disabled ? {} : { filter: "brightness(1.08)" },
                "&:focus-visible": {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: -2,
                },
              })}
            >
              <Box
                component="span"
                sx={(theme) => ({
                  width: 26,
                  height: 26,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  fontWeight: 800,
                  fontSize: 14,
                  textDecoration: disabled ? "line-through" : "none",
                  boxShadow:
                    key === todayKey
                      ? `inset 0 0 0 2px ${theme.palette.primary.main}`
                      : "none",
                })}
              >
                {date.date()}
              </Box>
              {makeup && (
                <Box
                  component="span"
                  sx={{
                    position: { sm: "absolute" },
                    top: 7,
                    right: 6,
                    px: 0.6,
                    border: 1,
                    borderRadius: 99,
                    color: "warning.main",
                    fontSize: { xs: 9, sm: 10 },
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  補班
                </Box>
              )}
              {info?.note && (
                <Box
                  component="span"
                  sx={{
                    fontSize: { xs: 9.5, sm: 11 },
                    lineHeight: 1.35,
                    color: info.isHoliday ? "error.main" : "text.secondary",
                    textAlign: { xs: "center", sm: "left" },
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: { xs: 1, sm: 2 },
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-all",
                  }}
                >
                  {info.note}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

function HolidayCalendarLegend() {
  const item = (label: string, color: (t: Theme) => string) => (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Box
        sx={(theme) => ({
          width: 10,
          height: 10,
          borderRadius: 0.5,
          border: `1px solid ${color(theme)}`,
          bgcolor: alpha(color(theme), 0.15),
        })}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ display: { xs: "none", md: "flex" } }}
    >
      {item("放假", (t) => t.palette.error.main)}
      {item("補班", (t) => t.palette.warning.main)}
      {item("上班", (t) => t.palette.divider)}
    </Stack>
  );
}
