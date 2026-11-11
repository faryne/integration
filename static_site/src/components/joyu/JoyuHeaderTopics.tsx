import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Chip, Stack, useMediaQuery, useTheme } from "@mui/material";

import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import { actressTopicPath } from "@/helpers/avActressTopic.ts";
import type { ActressTopicSummary } from "@/types/avActressTopic.ts";

import { HOME_TOPIC_GROUPS } from "./home/homeTopicGroups.ts";
import { joyuInk } from "./joyuTheme.ts";

// 頁首主題捷徑的字數預算（全部 label 加總）與最多幾個：主題名稱 2～5 字，大約 3～4 個 chip，
// 1200px 寬時 logo＋導覽＋搜尋框＋帳號區排得下、不會擠到換行
const HEADER_TOPIC_MAX_CHARS = 10;
const HEADER_TOPIC_MAX_COUNT = 4;

// slug 混進種子算出的排序值（FNV-1a），同一個種子每次排出來都一樣
const rank = (slug: string, seed: number) => {
  let h = 2166136261 ^ seed;
  for (const c of slug) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

// 依種子打散後照順序塞，超過字數預算的跳過、換下一個比較短的試
function pickTopics(topics: ActressTopicSummary[], seed: number) {
  const picked: ActressTopicSummary[] = [];
  let chars = 0;
  for (const t of [...topics].sort(
    (a, b) => rank(a.slug, seed) - rank(b.slug, seed),
  )) {
    if (picked.length === HEADER_TOPIC_MAX_COUNT) break;
    if (chars + t.label.length > HEADER_TOPIC_MAX_CHARS) continue;
    picked.push(t);
    chars += t.label.length;
  }
  return picked;
}

/**
 * 頁首搜尋框旁的女優主題捷徑（取代一屏版首頁的 Hero Card）：首頁那幾組主題亂數挑，塞到字數預算為止。
 * 只在 lg 以上顯示；比較窄時導覽和搜尋框已經佔滿，不顯示也不去抓主題 JSON。
 * 頁首在換頁時不會重新掛載，同一次瀏覽看到的是同一組，重新整理才換
 */
export function JoyuHeaderTopics() {
  const wide = useMediaQuery(useTheme().breakpoints.up("lg"));
  const index = useActressTopicIndex(wide);
  // 亂數種子在第一次掛載時決定（render 中不能直接呼叫 Math.random），排序本身是依種子算出來的
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32));
  const topics = useMemo(
    () =>
      pickTopics(
        (index.data?.groups ?? [])
          .filter((g) => HOME_TOPIC_GROUPS.includes(g.key))
          .flatMap((g) => g.topics),
        seed,
      ),
    [index.data, seed],
  );

  if (!wide || topics.length === 0) return null;
  return (
    <Stack direction="row" gap={0.75} sx={{ flexShrink: 0 }}>
      {topics.map((t) => (
        <Chip
          clickable
          component={RouterLink}
          key={t.slug}
          label={t.label}
          size="small"
          sx={{
            bgcolor: "rgba(255,255,255,.08)",
            border: `1px solid ${joyuInk.line}`,
            color: joyuInk.text,
            fontSize: 12,
            "&:hover": { color: joyuInk.accent },
          }}
          to={actressTopicPath(t.slug)}
        />
      ))}
    </Stack>
  );
}
