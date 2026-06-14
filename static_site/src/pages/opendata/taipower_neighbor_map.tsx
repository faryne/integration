import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";

import { TaiwanAdministrativeMap } from "@/components/common/TaiwanAdministrativeMap.tsx";
import { TaipowerNeighborBreadcrumb } from "@/components/taipower/TaipowerNeighborBreadcrumb.tsx";
import { useTitle } from "@/helpers/title.tsx";

const basePath = "/data/taipower/neighbor";

export default function TaipowerNeighborMapPage() {
  const navigate = useNavigate();
  useTitle("台電敦親睦鄰捐助地圖");

  return (
    <Box sx={{ py: 2 }}>
      <Stack spacing={3}>
        <TaipowerNeighborBreadcrumb current="台灣行政區地圖" />
        <Paper
          variant="outlined"
          sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4 }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(basePath)}
          >
            回資料列表
          </Button>
          <Typography variant="h3" component="h1" fontWeight={900} mt={1}>
            台灣行政區查詢
          </Typography>
          <Typography color="text.secondary">
            先選擇縣市，再點選行政區查看該地區的台電敦親睦鄰捐助紀錄。
          </Typography>
        </Paper>

        <TaiwanAdministrativeMap
          onDistrictSelect={(cityArea) =>
            navigate(`${basePath}/cityarea/${encodeURIComponent(cityArea)}`)
          }
        />
      </Stack>
    </Box>
  );
}
