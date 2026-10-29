import {
  CircularProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { useTwStatsMovers } from "@/apis/opendata/twstats.ts";
import { TwStatsCategoryChips } from "@/components/twstats/TwStatsCategoryChips.tsx";
import { TwStatsCountySelect } from "@/components/twstats/TwStatsCountySelect.tsx";
import { TwStatsErrorSnack } from "@/components/twstats/TwStatsErrorSnack.tsx";
import {
  TwStatsCountyMovers,
  TwStatsNationalMovers,
} from "@/components/twstats/TwStatsMoversTables.tsx";
import { isTwStatsCategory } from "@/components/twstats/twStatsCategories.ts";
import { useTitle } from "@/helpers/title.tsx";
import { useUpdateSearchParams } from "@/helpers/useUpdateSearchParams.ts";

// tw-stats 最早的年度資料約從 1998 年開始，前一年要有值才算得出變化，所以從 1999 起
const firstYear = 1999;

/** 年度變化榜：全國年增率榜＋縣市名次變化榜，篩選條件都放網址 */
export function TwStatsTrends() {
  const [searchParams, updateParams] = useUpdateSearchParams();
  const year = Number(searchParams.get("year")) || undefined;
  const area = searchParams.get("area") ?? "";
  const categoryParam = searchParams.get("cat");
  const category = isTwStatsCategory(categoryParam) ? categoryParam : null;
  // 指定縣市時只有縣市榜有意義，直接切過去
  const tab =
    area || searchParams.get("tab") === "counties" ? "counties" : "national";

  useTitle("台灣指標年度變化榜");

  const moversQuery = useTwStatsMovers({
    year,
    area: area || undefined,
    category: category ?? undefined,
  });
  const data = moversQuery.data;
  const yearOptions = useMemo(
    () =>
      data
        ? Array.from(
            { length: data.latest_year - firstYear + 1 },
            (_, i) => data.latest_year - i,
          )
        : [],
    [data],
  );

  return (
    <Stack spacing={3}>
      <Typography variant={"h3"} component={"h1"}>
        年度變化榜
      </Typography>

      <Stack
        direction={"row"}
        spacing={2}
        alignItems={"center"}
        flexWrap={"wrap"}
        useFlexGap
      >
        <TextField
          select
          size={"small"}
          label={"年度"}
          value={data?.year ?? ""}
          onChange={(e) =>
            updateParams({
              year:
                Number(e.target.value) === data?.latest_year
                  ? null
                  : e.target.value,
            })
          }
          sx={{ minWidth: 120 }}
        >
          {yearOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
        <TwStatsCountySelect
          value={area}
          emptyLabel={"全部縣市（不含金門、連江）"}
          onChange={(value) => updateParams({ area: value || null })}
        />
        {moversQuery.isFetching && <CircularProgress size={20} />}
      </Stack>

      <TwStatsCategoryChips
        value={category}
        onChange={(cat) => updateParams({ cat })}
      />

      <Tabs
        value={tab}
        onChange={(_, value) =>
          updateParams({ tab: value === "counties" ? value : null })
        }
      >
        <Tab value={"national"} label={"全國年增率"} disabled={!!area} />
        <Tab value={"counties"} label={"縣市名次變化"} />
      </Tabs>

      {data &&
        (tab === "national" ? (
          <TwStatsNationalMovers year={data.year} rows={data.national} />
        ) : (
          <TwStatsCountyMovers year={data.year} rows={data.counties} />
        ))}

      <TwStatsErrorSnack error={moversQuery.error} />
    </Stack>
  );
}
