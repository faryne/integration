import { Skeleton, Typography } from "@mui/material";

import { useJoyuNewActresses } from "@/apis/av/joyu.ts";
import { ActressCard } from "@/components/av/actress_card.tsx";
import { joyuPath } from "@/helpers/joyu.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeRow } from "./HomeRow.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { joyuActressLink } from "@/helpers/joyuActressLink.ts";

const WEEKDAYS = "日一二三四五六";

// API 回傳 yyyy/MM/dd（日本日期），顯示成「11/08（日）」
const dayLabel = (date: string) => {
  const [y, m, d] = date.split("/").map(Number);
  if (!y || !m || !d) return "";
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}（${w}）`;
};

/**
 * 首頁「今天有新片的女優」：橫向捲動的女優卡；今天還沒新片時後端回最近一天，標題旁顯示實際日期。
 * compact：一屏版首頁用，卡片縮小
 */
export function NewActressesSection({ compact }: { compact?: boolean }) {
  const q = useJoyuNewActresses();
  const items = q.data?.actresses ?? [];
  if (q.isSuccess && items.length === 0) return null;

  return (
    <HomeSection
      dense={compact}
      title="今天有新片的女優"
      note={q.data ? `${dayLabel(q.data.date)}・${items.length} 位` : undefined}
      moreTo={joyuPath("video")}
      moreLabel="看全部新片"
    >
      {/* 一屏版卡片縮小；原版面維持原尺寸 */}
      <HomeRow item={compact ? { xs: 72, md: 96 } : { xs: 120, md: 148 }}>
        {q.isPending
          ? Array.from({ length: 8 }, (_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                sx={{ height: compact ? 160 : 250 }}
              />
            ))
          : items.map((item) => (
              <ActressCard
                dense={compact}
                key={item.name}
                name={item.name}
                photo={item.actress?.photo}
                to={joyuActressLink(item)}
              >
                <Typography
                  color="primary"
                  sx={{ fontSize: compact ? 11 : 12, fontWeight: 700 }}
                >
                  新片 {item.count} 部
                </Typography>
              </ActressCard>
            ))}
      </HomeRow>
      <ErrorSnack open={q.isError} message="新片女優讀取失敗，請稍後再試" />
    </HomeSection>
  );
}
