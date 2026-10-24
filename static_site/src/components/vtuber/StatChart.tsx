import { Box, CircularProgress, useMediaQuery, useTheme } from "@mui/material";
import { Chart } from "react-google-charts";

// Google Charts 不支援 rgba 的透明度（會畫成不透明），文字與格線用實色；色值跟主站 layout 的色票一致
const CHART_COLORS = {
  light: { text: "#5b6b6c", grid: "#dde4e4" },
  dark: { text: "#93a7ab", grid: "#23313a" },
};

export interface StatPoint {
  date: Date;
  value: number;
}

interface StatChartProps {
  label: string;
  points: StatPoint[];
  // total：累計折線；daily：每日增減長條
  mode: "total" | "daily";
}

/** 統計分頁的單張圖（Google Charts）；Google Charts 不吃 MUI 主題，顏色依深淺色模式自己傳 */
export function StatChart({ label, points, mode }: StatChartProps) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down("sm"));
  const height = narrow ? 190 : 220;
  const suffix = mode === "daily" ? " 增減" : "";

  const data = [
    ["日期", label, { type: "string", role: "tooltip" }],
    ...points.map(({ date, value }) => [
      date,
      value,
      `${date.toLocaleDateString("zh-TW")}\n${label}${suffix}：${value.toLocaleString()}`,
    ]),
  ];
  const colors = CHART_COLORS[theme.palette.mode];
  const textStyle = { color: colors.text, fontSize: 11 };
  const options = {
    backgroundColor: "transparent",
    colors: [theme.palette.primary.main],
    legend: "none",
    chartArea: { left: 56, right: 12, top: 12, bottom: 32 },
    hAxis: {
      format: "M/d",
      textStyle,
      gridlines: { color: "transparent" },
      baselineColor: colors.grid,
    },
    vAxis: {
      format: "short",
      textStyle,
      gridlines: { color: colors.grid, count: 4 },
      minorGridlines: { count: 0 },
      baselineColor: colors.grid,
    },
    lineWidth: 2,
    bar: { groupWidth: "75%" },
    tooltip: { textStyle: { fontSize: 12 } },
  };

  return (
    <Chart
      // 換深淺色模式時重建，Google Charts 才會套新顏色
      key={theme.palette.mode}
      chartType={mode === "daily" ? "ColumnChart" : "LineChart"}
      chartLanguage={"zh-TW"}
      width={"100%"}
      height={height}
      data={data}
      options={options}
      loader={
        <Box sx={{ height, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      }
    />
  );
}
