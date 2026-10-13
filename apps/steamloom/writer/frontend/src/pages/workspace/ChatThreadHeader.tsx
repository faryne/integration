import CheckIcon from "@mui/icons-material/Check";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { Box, CircularProgress, IconButton, TextField, Tooltip } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ChatThreadHeader({ threadID, title, onSave }: { threadID: string; title: string; onSave: (title: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const normalized = draft.trim();

  useEffect(() => {
    setDraft(title);
    setSaved(false);
  }, [threadID, title]);

  const save = async () => {
    if (!threadID || !normalized || normalized === title || saving) return;
    setSaving(true);
    const ok = await onSave(normalized);
    setSaving(false);
    if (!ok) return;
    setDraft(normalized);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  return (
    <Box sx={{ minHeight: 52, px: 2.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1, flex: "none" }}>
      <TextField
        fullWidth
        variant="standard"
        value={draft}
        disabled={!threadID || saving}
        placeholder={t("workspace.chat.threadTitle")}
        slotProps={{ htmlInput: { maxLength: 100, "aria-label": t("workspace.chat.threadTitle") } }}
        onChange={(event) => {
          setDraft(event.target.value);
          setSaved(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape") {
            setDraft(title);
          }
        }}
        sx={{ maxWidth: 780, mx: "auto", "& input": { fontSize: 15, fontWeight: 700 } }}
      />
      <Tooltip title={t("workspace.chat.saveThreadTitle")}>
        <span>
          <IconButton size="small" color={saved ? "success" : "primary"} disabled={!threadID || !normalized || normalized === title || saving} onClick={() => void save()}>
            {saving ? <CircularProgress size={17} /> : saved ? <CheckIcon fontSize="small" /> : <SaveOutlinedIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
