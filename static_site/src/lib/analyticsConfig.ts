// 正式站各自使用對應的 GA4 資料串流；本機開發仍可由 .env 指定測試用 ID。
const productionMeasurementIds = {
  main: "G-8XQ7J5LJNM",
  galgame: "G-YBHTNYWDR1",
  nekomaid: "G-YQ3E7J57GK",
  steamloom: "G-0VKW4TC8G2",
  joyu: "G-V67Q0MXVS8",
} as const;

const site = import.meta.env.VITE_SITE || "main";
export const measurementId: string | undefined = import.meta.env.DEV
  ? import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
  : productionMeasurementIds[site as keyof typeof productionMeasurementIds];
