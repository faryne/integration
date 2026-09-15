import type { StorytellerAppearance } from "@/data/storytellerTheme.ts";
import { storytellerMascotSrc } from "@/helpers/storytellerMascot.ts";

export const STORYTELLER_SPECIAL_ARTWORK = {
  bikini: "/storyteller/special/suosuo-special-bikini.png",
  birthday: "/storyteller/special/suosuo-special-birthday.png",
  bridal: "/storyteller/special/suosuo-special-bridal.png",
  "casual-dress": "/storyteller/special/suosuo-special-casual-dress.png",
  christmas: "/storyteller/special/suosuo-special-christmas.png",
  "dragon-boat": "/storyteller/special/suosuo-special-dragon-boat.png",
  loungewear: "/storyteller/special/suosuo-special-loungewear.png",
  maid: "/storyteller/special/suosuo-special-maid.png",
  "mid-autumn": "/storyteller/special/suosuo-special-mid-autumn.png",
  "new-year": "/storyteller/special/suosuo-special-new-year.png",
  nightdress: "/storyteller/special/suosuo-special-nightdress.png",
  "western-academy": "/storyteller/special/suosuo-special-western-academy.png",
} as const;

export type StorytellerSpecialArtwork =
  keyof typeof STORYTELLER_SPECIAL_ARTWORK;

export const STORYTELLER_POSE_ARTWORK = {
  crouch: "/storyteller/poses/suosuo-pose-crouch-nocturne-master.png",
  "lie-back": "/storyteller/poses/suosuo-pose-lie-back-nocturne-master.png",
  "lie-side": "/storyteller/poses/suosuo-pose-lie-side-nocturne-master.png",
  prone: "/storyteller/poses/suosuo-pose-prone-nocturne-master.png",
  "sit-crossleg":
    "/storyteller/poses/suosuo-pose-sit-crossleg-nocturne-master.png",
  sit: "/storyteller/poses/suosuo-pose-sit-nocturne-master.png",
} as const;

export type StorytellerPoseArtwork = keyof typeof STORYTELLER_POSE_ARTWORK;

export interface StorytellerMonthDay {
  month: number;
  day: number;
}

export interface StorytellerHomeArtworkOptions {
  appearance: StorytellerAppearance;
  now?: Date;
  birthday?: StorytellerMonthDay;
  /** 提供端午、中秋或活動檔期等由外部決定的最高優先級圖片。 */
  occasion?: StorytellerSpecialArtwork;
}

const FIXED_DATE_ARTWORK: Partial<
  Record<`${number}-${number}`, StorytellerSpecialArtwork>
> = {
  "1-1": "new-year",
  "12-25": "christmas",
};

// 週末另有家居服；普通工作日則用固定映射，避免重新 render 時隨機跳圖。
const WEEKDAY_POSE_ARTWORK: Partial<Record<number, StorytellerPoseArtwork>> = {
  1: "sit",
  2: "sit-crossleg",
  3: "prone",
  4: "crouch",
  5: "lie-back",
};

function isSameMonthDay(date: Date, target?: StorytellerMonthDay) {
  return (
    target !== undefined &&
    date.getMonth() + 1 === target.month &&
    date.getDate() === target.day
  );
}

/**
 * 首頁立繪優先級：指定活動 > 使用者生日 > 固定節日 > 週末 > 時段／日替姿勢 > 預設圖。
 * `now` 可注入，方便預覽未來日期，不讓日期判斷散落在 React 元件裡。
 */
export function storytellerHomeArtworkSrc({
  appearance,
  now = new Date(),
  birthday,
  occasion,
}: StorytellerHomeArtworkOptions) {
  const special =
    occasion ??
    (isSameMonthDay(now, birthday) ? "birthday" : undefined) ??
    FIXED_DATE_ARTWORK[`${now.getMonth() + 1}-${now.getDate()}`] ??
    ([0, 6].includes(now.getDay()) ? "loungewear" : undefined);

  if (special) return STORYTELLER_SPECIAL_ARTWORK[special];

  const pose =
    now.getHours() < 6 ? "lie-side" : WEEKDAY_POSE_ARTWORK[now.getDay()];
  return pose
    ? STORYTELLER_POSE_ARTWORK[pose]
    : storytellerMascotSrc("idle", appearance, "master");
}
