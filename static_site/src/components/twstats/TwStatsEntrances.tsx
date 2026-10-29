import { Button, Chip, Paper, Stack, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { Link } from "react-router-dom";
import { areaProfileLink } from "@/components/twstats/twStatsFormat.ts";
import { allTwAreas } from "@/components/twstats/twStatsUrlState.ts";
import { TWAreaMappings } from "@/types/twstats.ts";

const counties = allTwAreas.filter((area) => area !== "Taiwan");

/** 列表頁上方的入口：年度變化榜、各縣市健檢 */
export function TwStatsEntrances() {
  return (
    <Paper variant={"outlined"} sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction={"row"}
          alignItems={"center"}
          justifyContent={"space-between"}
        >
          <Typography fontWeight={700}>縣市健檢</Typography>
          <Button
            component={Link}
            to={"/data/tw-stats/trends"}
            variant={"outlined"}
            size={"small"}
            startIcon={<TrendingUpIcon />}
          >
            年度變化榜
          </Button>
        </Stack>
        <Stack direction={"row"} spacing={0.75} flexWrap={"wrap"} useFlexGap>
          {counties.map((area) => (
            <Chip
              key={area}
              size={"small"}
              variant={"outlined"}
              label={TWAreaMappings[area]}
              component={Link}
              to={areaProfileLink(area)}
              clickable
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}
