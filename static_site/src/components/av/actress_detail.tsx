import { useRef, type ComponentProps } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Stack, Tab, Tabs } from "@mui/material";

import type { JoyuActressSummary } from "@/apis/av/joyu.ts";
import { useComments } from "@/apis/av/joyu_comments.ts";
import { ActressCoStars } from "@/components/av/actress_co_stars.tsx";
import { ActressProfileHeader } from "@/components/av/actress_profile_header.tsx";
import { ActressSameNames } from "@/components/av/actress_same_names.tsx";
import { ActressWorks } from "@/components/av/actress_works.tsx";
import { ActressUpcoming } from "@/components/av/actress_upcoming.tsx";
import { actressRefOf } from "@/helpers/avActressRef.ts";
import { CommentSection } from "@/components/joyu/comments/CommentSection.tsx";
import { JoyuAdSlot } from "@/components/joyu/promo/JoyuAdSlot.tsx";
import type { Actress } from "@/types/av.ts";

/**
 * 女優頁（P2）：同名提示 → 頂端基本資料 → 「作品／共演女優／討論」分頁。
 * 共演女優（?view=costars，有共演才出現）、討論（?view=comments）都是作品旁邊的分頁；頂端另有討論數 chip，點了切過來並捲到分頁列；
 * 討論版以 domain:aid 為 key，別名頁共用同一個。
 * 資料（女優、影片、facets、summary）都由頁面（pages/av/actress_detail.tsx）查好傳進來，這裡只負責排版
 */
type View = "works" | "costars" | "comments";

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
  const [params, setParams] = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);
  const target = actress ? `actress:${actress.domain}:${actress.aid}` : "";
  const commentCount = useComments(target).data?.count ?? 0;
  const coStars = summary?.co_stars ?? [];
  // 分頁：作品（預設）／共演女優（有共演才出現）／討論；存在網址 ?view=costars|comments
  const requestedView = params.get("view");
  const view: View =
    requestedView === "comments" ||
    (requestedView === "costars" && coStars.length > 0)
      ? requestedView
      : "works";
  const setView = (next: View) =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "works") p.delete("view");
      else p.set("view", next);
      return p;
    });
  if (!actress) return null;

  return (
    <Stack spacing={3}>
      <ActressSameNames actresses={sameNames ?? []} current={actress} />
      <ActressProfileHeader
        actress={actress}
        commentCount={commentCount}
        onOpenComments={() => {
          setView("comments");
          tabsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
        pageName={pageName}
        summary={summary}
      />
      {/* joyu 版位：頂端資料與分頁之間 */}
      <JoyuAdSlot placement="actress" />
      <Box>
        <Tabs
          onChange={(_, v: View) => setView(v)}
          ref={tabsRef}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            mb: 2,
            scrollMarginTop: 72,
          }}
          value={view}
        >
          <Tab label="作品" value="works" />
          {coStars.length > 0 && (
            <Tab label={`共演女優（${coStars.length}）`} value="costars" />
          )}
          <Tab
            label={commentCount ? `討論（${commentCount}）` : "討論"}
            value="comments"
          />
        </Tabs>
        {view === "comments" ? (
          <CommentSection target={target} />
        ) : view === "costars" ? (
          <ActressCoStars items={coStars} />
        ) : (
          <>
            {/* 這個名義未來 30 天的預約作品（沒有就不顯示） */}
            <ActressUpcoming
              params={{ actress: [pageName], ...actressRefOf(actress) }}
            />
            <ActressWorks
              {...works}
              pageName={pageName}
              realName={actress.name}
            />
          </>
        )}
      </Box>
    </Stack>
  );
}
