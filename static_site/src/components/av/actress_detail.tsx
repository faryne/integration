import { useRef, type ComponentProps } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Stack, Tab, Tabs } from "@mui/material";

import type { JoyuActressSummary } from "@/apis/av/joyu.ts";
import { useComments } from "@/apis/av/joyu_comments.ts";
import { ActressCoStars } from "@/components/av/actress_co_stars.tsx";
import { ActressProfileHeader } from "@/components/av/actress_profile_header.tsx";
import { ActressSameNames } from "@/components/av/actress_same_names.tsx";
import { ActressWorks } from "@/components/av/actress_works.tsx";
import { CommentSection } from "@/components/joyu/comments/CommentSection.tsx";
import type { Actress } from "@/types/av.ts";

/**
 * 女優頁（P2）：同名提示 → 頂端基本資料 → 「作品／討論」分頁 → 共演女優。
 * 討論放在作品旁邊的分頁（網址 ?view=comments），頂端另有討論數 chip，點了切過來並捲到分頁列；
 * 討論版以 domain:aid 為 key，別名頁共用同一個。
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
  const [params, setParams] = useSearchParams();
  const tabsRef = useRef<HTMLDivElement>(null);
  const target = actress ? `actress:${actress.domain}:${actress.aid}` : "";
  const commentCount = useComments(target).data?.count ?? 0;
  const view = params.get("view") === "comments" ? "comments" : "works";
  const setView = (next: "works" | "comments") =>
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "comments") p.set("view", "comments");
      else p.delete("view");
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
      <Box>
        <Tabs
          onChange={(_, v: "works" | "comments") => setView(v)}
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
          <Tab
            label={commentCount ? `討論（${commentCount}）` : "討論"}
            value="comments"
          />
        </Tabs>
        {view === "comments" ? (
          <CommentSection target={target} />
        ) : (
          <ActressWorks
            {...works}
            pageName={pageName}
            realName={actress.name}
          />
        )}
      </Box>
      <ActressCoStars items={summary?.co_stars} />
    </Stack>
  );
}
