import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type {
  ActressTopicFile,
  ActressTopicIndex,
} from "@/types/avActressTopic.ts";

// 主題 JSON 每週才更新一次，CDN 也有 1 小時快取；前端在同一個瀏覽階段內不用重抓
const TOPIC_STALE_TIME = 30 * 60 * 1000;

/** 主題檔案在 CDN 上的位置（後端排程上傳到 S3 的 opendata/av/actress-topics/） */
const topicsBase = () =>
  `${String(import.meta.env.VITE_CDN_BASE ?? "").replace(/\/+$/, "")}/opendata/av/actress-topics`;

/** index.json：總覽頁、主題頁（slug 對檔名）、女優頁的主題 chip 共用同一份快取 */
export function useActressTopicIndex() {
  return useQuery({
    queryKey: ["av-actress-topic-index"],
    queryFn: async () =>
      (await axios.get<ActressTopicIndex>(`${topicsBase()}/index.json`)).data,
    staleTime: TOPIC_STALE_TIME,
  });
}

/** 單一主題的檔案；file 來自 index.json */
export function useActressTopicFile(file?: string) {
  return useQuery({
    queryKey: ["av-actress-topic-file", file],
    queryFn: async () =>
      (await axios.get<ActressTopicFile>(`${topicsBase()}/${file}`)).data,
    enabled: !!file,
    staleTime: TOPIC_STALE_TIME,
  });
}
