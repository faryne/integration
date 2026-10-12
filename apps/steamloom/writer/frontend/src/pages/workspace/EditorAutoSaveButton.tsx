import { WorkspaceEditorSelectButton } from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@writer/lib/backend.ts";

// 自動存檔間隔的範圍與預設選項，跟網站 StoryEditor 與後端（service/storyteller autoSaveIntervalMinutes*）一致
const MIN = 2;
const MAX = 60;
const DEFAULT = 5;
const PRESETS = [2, 5, 10];
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, Math.trunc(value)));

// 編輯頁打開時套用作者在網站設定的開關與間隔；這裡改的只影響這次編輯（跟網站一樣不寫回設定）
export const initialAutoSaveMinutes = (profile: Profile | null) =>
  profile && !profile.auto_save_enabled ? null : clamp(profile?.auto_save_interval_minutes || DEFAULT);

// 屬性列上的「自動存檔」按鈕：不自動存檔／每 N 分鐘／自訂（2–60 分鐘，離開輸入框才生效）
export function EditorAutoSaveButton({ minutes, onChange }: { minutes: number | null; onChange: (minutes: number | null) => void }) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(minutes !== null && !PRESETS.includes(minutes));
  const [input, setInput] = useState(String(minutes ?? DEFAULT));
  const value = minutes === null ? "off" : custom ? "custom" : String(minutes);
  const options = [
    { value: "off", label: t("workspace.editor.autoSave.off"), icon: <ScheduleIcon fontSize="small" /> },
    ...PRESETS.map((preset) => ({ value: String(preset), label: t("workspace.editor.autoSave.every", { minutes: preset }), icon: <ScheduleIcon fontSize="small" /> })),
    { value: "custom", label: t("workspace.editor.autoSave.custom"), icon: <ScheduleIcon fontSize="small" /> },
  ];

  const select = (next: string) => {
    setCustom(next === "custom");
    if (next === "off") return onChange(null);
    if (next === "custom") return onChange(minutes ?? DEFAULT);
    onChange(Number(next));
    setInput(next);
  };
  const commit = () => {
    const parsed = Number(input);
    const next = input.trim() === "" || !Number.isFinite(parsed) ? DEFAULT : clamp(parsed);
    setInput(String(next));
    onChange(next);
  };

  return (
    <WorkspaceEditorSelectButton icon={<ScheduleIcon fontSize="small" />} label={t("workspace.editor.autoSave.label")} value={value} options={options} onChange={select}>
      {value === "custom" && (
        <TextField
          type="number"
          size="small"
          label={t("workspace.editor.autoSave.range", { min: MIN, max: MAX })}
          value={input}
          slotProps={{ htmlInput: { min: MIN, max: MAX, step: 1 } }}
          onChange={(event) => setInput(event.target.value)}
          onBlur={commit}
          sx={{ width: 140 }}
        />
      )}
    </WorkspaceEditorSelectButton>
  );
}
