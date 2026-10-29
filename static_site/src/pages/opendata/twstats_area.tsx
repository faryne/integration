import {
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTwStatsAreaProfile } from "@/apis/opendata/twstats.ts";
import { TwStatsAreaHighlights } from "@/components/twstats/TwStatsAreaHighlights.tsx";
import { TwStatsAreaTable } from "@/components/twstats/TwStatsAreaTable.tsx";
import { TwStatsCategoryChips } from "@/components/twstats/TwStatsCategoryChips.tsx";
import { TwStatsCountySelect } from "@/components/twstats/TwStatsCountySelect.tsx";
import { TwStatsErrorSnack } from "@/components/twstats/TwStatsErrorSnack.tsx";
import { isTwStatsCategory } from "@/components/twstats/twStatsCategories.ts";
import { areaProfileLink } from "@/components/twstats/twStatsFormat.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useTitle } from "@/helpers/title.tsx";
import { useUpdateSearchParams } from "@/helpers/useUpdateSearchParams.ts";

/** 縣市健檢：單一縣市在全部指標的 22 縣市名次，數量類指標以每萬人比較 */
export function TwStatsArea() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const profileQuery = useTwStatsAreaProfile(code);
  const [searchParams, updateParams] = useUpdateSearchParams();
  const categoryParam = searchParams.get("cat");
  const category = isTwStatsCategory(categoryParam) ? categoryParam : null;
  const [keyword, setKeyword] = useState("");

  const areaName = profileQuery.data?.area.name;
  useTitle(`縣市健檢${areaName ? ` - ${areaName}` : ""}`);
  useBreadcrumbTail(areaName);

  const indicators = useMemo(
    () => profileQuery.data?.indicators ?? [],
    [profileQuery.data],
  );
  const keywordRows = useMemo(() => {
    const q = keyword.trim();
    return q ? indicators.filter((i) => i.name.includes(q)) : indicators;
  }, [indicators, keyword]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    keywordRows.forEach((i) =>
      counts.set(i.category, (counts.get(i.category) ?? 0) + 1),
    );
    return counts;
  }, [keywordRows]);
  const rows = useMemo(
    () =>
      category
        ? keywordRows.filter((i) => i.category === category)
        : keywordRows,
    [category, keywordRows],
  );

  return (
    <Stack spacing={3}>
      <Stack
        direction={"row"}
        spacing={2}
        alignItems={"center"}
        flexWrap={"wrap"}
        useFlexGap
      >
        <Typography variant={"h3"} component={"h1"}>
          {areaName ?? "縣市健檢"}
        </Typography>
        {/* 切換縣市保留目前的分類篩選 */}
        <TwStatsCountySelect
          value={profileQuery.data?.area.code ?? ""}
          onChange={(value) =>
            navigate(`${areaProfileLink(value)}${window.location.search}`)
          }
        />
      </Stack>

      {profileQuery.isLoading && (
        <Stack direction={"row"} spacing={1.5} alignItems={"center"}>
          <CircularProgress size={22} />
          <Typography color={"text.secondary"}>載入縣市資料中</Typography>
        </Stack>
      )}

      {profileQuery.data && (
        <>
          <TwStatsAreaHighlights indicators={indicators} />

          <Stack spacing={2}>
            <Typography variant={"h5"} component={"h2"} fontWeight={700}>
              全部指標
            </Typography>
            <TextField
              type={"search"}
              size={"small"}
              label={"搜尋指標"}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position={"start"}>
                      <SearchIcon fontSize={"small"} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TwStatsCategoryChips
              value={category}
              onChange={(cat) => updateParams({ cat })}
              total={keywordRows.length}
              counts={categoryCounts}
            />
            <TwStatsAreaTable indicators={rows} />
          </Stack>
        </>
      )}

      <TwStatsErrorSnack error={profileQuery.error} />
    </Stack>
  );
}
