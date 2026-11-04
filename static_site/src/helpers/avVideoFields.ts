import type { Video } from "@/types/av.ts";
import type {
  VideoFieldKey,
  VideoFields,
  VideoSubmissionDetail,
} from "@/types/avVideoSubmission.ts";
import {
  VIDEO_FIELD_KEYS,
  VIDEO_FIELD_LABELS,
  VIDEO_TERM_KEYS,
} from "@/data/avVideoFields.ts";
import type { SubmissionDiffSpec } from "@/helpers/submissionDiff.ts";
import { changedSubmissionFields } from "@/helpers/submissionDiff.ts";
import { linkLabel } from "@/helpers/referenceLink.ts";
import { videoActressPath } from "@/helpers/avActressName.ts";

// 舊資料的陣列欄位可能夾雜空字串或非字串（logstash 時代），預填前整理成跟後端 videoFieldsFromSource 一樣
const terms = (list?: unknown[] | null) => {
  const out: string[] = [];
  for (const v of list ?? []) {
    const s = typeof v === "string" ? v.trim() : "";
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
};

/** 搜尋結果的影片轉成修改欄位（表單預填用） */
export function videoToFields(video: Video): VideoFields {
  return {
    title: video.title?.trim() ?? "",
    maker_no: video.maker_no?.trim() ?? "",
    vod_date: video.vod_date?.trim() ?? "",
    publish_date:
      typeof video.publish_date === "string" ? video.publish_date.trim() : "",
    duration: Number(video.duration) || 0,
    actresses: terms(video.actresses),
    directors: terms(video.directors),
    series: terms(video.series),
    makers: terms(video.makers),
    labels: terms(video.labels),
    tags: terms(video.tags),
    links: video.links ?? [],
  };
}

const keysSpec = { keys: VIDEO_FIELD_KEYS };

/** 兩份資料不同的欄位 */
export const changedVideoFields = (a: VideoFields, b: VideoFields) =>
  changedSubmissionFields(keysSpec, a, b);

/** 單一欄位的顯示文字；0 與空字串都是「未填」，回傳空字串 */
export function formatVideoField(f: VideoFields, key: VideoFieldKey) {
  const v = f[key];
  if (key === "links")
    return f.links.map((l) => `${linkLabel(l)}｜${l.url}`).join("\n");
  if (Array.isArray(v)) return v.join("、");
  if (key === "duration") return f.duration ? `${f.duration} 分鐘` : "";
  return String(v);
}

/**
 * 審核頁比對表的影片欄位定義：陣列欄位逐項比對；出演連到女優頁方便確認對到哪一位，
 * 影片庫裡還沒有的值標「新值」、有同名問題的新出演標「同名女優」
 */
export function videoDiffSpec(
  d: Pick<VideoSubmissionDetail, "new_values" | "same_name_actresses">,
): SubmissionDiffSpec<VideoFields, VideoFieldKey> {
  return {
    keys: VIDEO_FIELD_KEYS,
    labels: VIDEO_FIELD_LABELS,
    format: formatVideoField,
    listKeys: [...VIDEO_TERM_KEYS, "links"],
    itemHref: (key, item) =>
      key === "actresses" ? videoActressPath(item) : undefined,
    itemNote: (key, item) => {
      if (key === "actresses" && d.same_name_actresses.includes(item))
        return "同名女優";
      return key !== "links" &&
        d.new_values[key as keyof typeof d.new_values]?.includes(item)
        ? "新值"
        : undefined;
    },
  };
}
