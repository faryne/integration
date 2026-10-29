import { Chip, Link as MuiLink, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { pickHighlights } from "@/components/twstats/twStatsHighlightPicker.ts";
import {
  categoryLabel,
  formatStat,
  indicatorMapLink,
} from "@/components/twstats/twStatsFormat.ts";
import type { TwStatsAreaIndicator } from "@/types/twstats.ts";

type Props = { indicators: TwStatsAreaIndicator[] };

/** 縣市健檢上方兩張卡：數值最高、最低的 10 項 */
export function TwStatsAreaHighlights({ indicators }: Props) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <HighlightCard
        title={"數值最高的 10 項"}
        items={pickHighlights(indicators, "top")}
      />
      <HighlightCard
        title={"數值最低的 10 項"}
        items={pickHighlights(indicators, "bottom")}
      />
    </Stack>
  );
}

function HighlightCard({
  title,
  items,
}: {
  title: string;
  items: TwStatsAreaIndicator[];
}) {
  return (
    <Paper variant={"outlined"} sx={{ flex: 1, p: 2 }}>
      <Typography variant={"h6"} fontWeight={700} sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Stack spacing={1}>
        {items.map((item) => (
          <Stack
            key={item.key}
            direction={"row"}
            spacing={1.5}
            alignItems={"center"}
          >
            {/* 名次徽章：寬度固定，讓指標名稱對齊 */}
            <Stack
              alignItems={"center"}
              justifyContent={"center"}
              sx={{
                width: 52,
                flexShrink: 0,
                py: 0.5,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              <Typography fontWeight={800} lineHeight={1.2}>
                {item.rank}
              </Typography>
              <Typography variant={"caption"} color={"text.secondary"}>
                / {item.rank_total}
              </Typography>
            </Stack>
            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <MuiLink
                component={Link}
                to={indicatorMapLink(item.name, item.year, item.per_capita)}
                underline={"hover"}
                color={"text.primary"}
                fontWeight={600}
                noWrap
                title={item.name}
              >
                {item.name}
              </MuiLink>
              <Typography variant={"body2"} color={"text.secondary"} noWrap>
                {item.per_capita_value !== undefined
                  ? `每萬人 ${formatStat(item.per_capita_value)} ${item.unit}`
                  : `${formatStat(item.value)} ${item.unit}`}
                ・{item.year}
              </Typography>
            </Stack>
            <Chip
              size={"small"}
              variant={"outlined"}
              label={categoryLabel(item.category)}
              sx={{ display: { xs: "none", sm: "inline-flex" } }}
            />
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
