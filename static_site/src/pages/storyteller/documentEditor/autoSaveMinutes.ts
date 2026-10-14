// 自動存檔間隔的範圍與預設選項，跟後端（service/storyteller autoSaveIntervalMinutes*）一致
export const AUTO_SAVE_MIN = 2;
export const AUTO_SAVE_MAX = 60;
export const AUTO_SAVE_DEFAULT = 5;
export const AUTO_SAVE_PRESETS = [2, 5, 10];
export const clampAutoSaveMinutes = (value: number) =>
  Math.min(AUTO_SAVE_MAX, Math.max(AUTO_SAVE_MIN, Math.trunc(value)));

// 編輯頁打開時套用作者在設定頁的開關與間隔；這裡改的只影響這次編輯，不寫回設定。null＝關閉
export const initialAutoSaveMinutes = (
  profile?: {
    auto_save_enabled: boolean;
    auto_save_interval_minutes: number;
  } | null,
) =>
  profile && !profile.auto_save_enabled
    ? null
    : clampAutoSaveMinutes(
        profile?.auto_save_interval_minutes || AUTO_SAVE_DEFAULT,
      );
