import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import type { HousePromoItem } from "@/components/common/promo/types.ts";
import { isMissingActressPhoto } from "@/helpers/avActressDisplay.ts";
import { actressTopicPath } from "@/helpers/avActressTopic.ts";

/**
 * 站內推廣來源：女優主題（index.json，跟主題總覽頁共用快取）。
 * 只挑有頭像的主題；舊的 index.json 沒有 preview 欄位時等同沒有內容，版位會整格收起
 */
export function useActressTopicHouse(): HousePromoItem[] | undefined {
  const q = useActressTopicIndex();
  if (q.isError) return [];
  return q.data?.groups.flatMap((g) =>
    g.topics.flatMap((t) => {
      const faces = (t.preview ?? [])
        .filter((p) => !isMissingActressPhoto(p.photo))
        .map((p) => ({ src: p.photo, alt: p.name }));
      return faces.length
        ? [
            {
              key: t.slug,
              kicker: "女優主題",
              title: t.label,
              count: `${t.count.toLocaleString()} 位`,
              faces,
              to: actressTopicPath(t.slug),
              cta: "看主題 →",
            },
          ]
        : [];
    }),
  );
}
