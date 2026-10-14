import ScheduleIcon from "@mui/icons-material/Schedule";
import { TextField } from "@mui/material";
import { useState } from "react";
import { WorkspaceEditorSelectButton } from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import type { DocumentEditorLabels } from "@/pages/storyteller/documentEditor/documentEditorLabels.ts";
import {
  AUTO_SAVE_DEFAULT as DEFAULT,
  AUTO_SAVE_MAX as MAX,
  AUTO_SAVE_MIN as MIN,
  AUTO_SAVE_PRESETS as PRESETS,
  clampAutoSaveMinutes as clamp,
} from "@/pages/storyteller/documentEditor/autoSaveMinutes.ts";

// 屬性列上的「自動存檔」：不自動存檔／每 N 分鐘／自訂（2–60 分鐘，離開輸入框才生效）
export function EditorAutoSaveButton({
  minutes,
  onChange,
  labels,
}: {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
  labels: DocumentEditorLabels["autoSave"];
}) {
  const [custom, setCustom] = useState(
    minutes !== null && !PRESETS.includes(minutes),
  );
  const [input, setInput] = useState(String(minutes ?? DEFAULT));
  const value = minutes === null ? "off" : custom ? "custom" : String(minutes);
  const options = [
    { value: "off", label: labels.off },
    ...PRESETS.map((preset) => ({
      value: String(preset),
      label: labels.every(preset),
    })),
    { value: "custom", label: labels.custom },
  ].map((option) => ({ ...option, icon: <ScheduleIcon fontSize="small" /> }));

  const select = (next: string) => {
    setCustom(next === "custom");
    if (next === "off") return onChange(null);
    if (next === "custom") return onChange(minutes ?? DEFAULT);
    onChange(Number(next));
    setInput(next);
  };
  const commit = () => {
    const parsed = Number(input);
    const next =
      input.trim() === "" || !Number.isFinite(parsed) ? DEFAULT : clamp(parsed);
    setInput(String(next));
    onChange(next);
  };

  return (
    <WorkspaceEditorSelectButton
      icon={<ScheduleIcon fontSize="small" />}
      label={labels.label}
      value={value}
      options={options}
      onChange={select}
    >
      {value === "custom" && (
        <TextField
          type="number"
          size="small"
          label={labels.range(MIN, MAX)}
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
