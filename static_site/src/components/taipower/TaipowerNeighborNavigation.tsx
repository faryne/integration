import MapIcon from "@mui/icons-material/Map";
import { Button, Stack } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

const basePath = "/data/taipower/neighbor";

// 將四個資料探索入口放在同一處，避免逐筆頁與統計頁連結分散。
export function TaipowerNeighborNavigation() {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      useFlexGap
      flexWrap="wrap"
    >
      <Button
        component={RouterLink}
        to={`${basePath}/map`}
        startIcon={<MapIcon />}
        variant="outlined"
      >
        從台灣地圖查詢
      </Button>
      <Button
        component={RouterLink}
        to={`${basePath}/cityarea`}
        variant="outlined"
      >
        行政區年度統計
      </Button>
      <Button component={RouterLink} to={`${basePath}/unit`} variant="outlined">
        受捐助單位年度統計
      </Button>
      <Button
        component={RouterLink}
        to={`${basePath}/purpose`}
        variant="contained"
      >
        用途透視鏡
      </Button>
    </Stack>
  );
}
