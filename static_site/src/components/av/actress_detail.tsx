import type { ComponentProps } from "react";
import { Stack } from "@mui/material";

import type { JoyuActressSummary } from "@/apis/av/joyu.ts";
import { ActressCoStars } from "@/components/av/actress_co_stars.tsx";
import { ActressProfileHeader } from "@/components/av/actress_profile_header.tsx";
import { ActressSameNames } from "@/components/av/actress_same_names.tsx";
import { ActressWorks } from "@/components/av/actress_works.tsx";
import type { Actress } from "@/types/av.ts";

/**
 * 女優頁（P2）：同名提示 → 頂端基本資料 → 出演作品（篩選＋依年份分組）→ 共演女優。
 * 資料（女優、影片、facets、summary）都由頁面（pages/av/actress_detail.tsx）查好傳進來，這裡只負責排版
 */
export function ActressDetail({
  actress,
  pageName,
  sameNames,
  summary,
  works,
}: {
  actress?: Actress;
  // 網址上的名字：本名或其中一個別名，出演影片只列這個名義的作品
  pageName: string;
  // 名字完全相同的所有人（含這位），兩位以上時顯示「可能同名的女優」切換
  sameNames?: Actress[];
  summary?: JoyuActressSummary;
  works: Omit<ComponentProps<typeof ActressWorks>, "pageName" | "realName">;
}) {
  if (!actress) return null;
  return (
    <Stack spacing={3}>
      <ActressSameNames actresses={sameNames ?? []} current={actress} />
      <ActressProfileHeader
        actress={actress}
        pageName={pageName}
        summary={summary}
      />
      <ActressWorks {...works} pageName={pageName} realName={actress.name} />
      <ActressCoStars items={summary?.co_stars} />
    </Stack>
  );
}
