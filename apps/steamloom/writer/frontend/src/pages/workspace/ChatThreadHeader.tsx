import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import { Box, CircularProgress, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function ChatThreadHeader({ threadID, title, onSave }: { threadID: string; title: string; onSave: (title: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(title);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const normalized = draft.trim();

  useEffect(() => {
    setDraft(title);
    setEditing(false);
  }, [threadID, title]);

  const save = async () => {
    if (!threadID || !normalized || normalized === title || saving) return;
    setSaving(true);
    const ok = await onSave(normalized);
    setSaving(false);
    if (!ok) return;
    setDraft(normalized);
    setEditing(false);
  };

  return (
    <Box sx={{ minHeight: 52, px: 2.5, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", gap: 1, flex: "none" }}>
      {editing ? (
        <TextField
          autoFocus
          fullWidth
          variant="standard"
          value={draft}
          disabled={saving}
          placeholder={t("workspace.chat.threadTitle")}
          slotProps={{ htmlInput: { maxLength: 100, "aria-label": t("workspace.chat.threadTitle") } }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            } else if (event.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          sx={{ maxWidth: 780, mx: "auto", "& input": { fontSize: 15, fontWeight: 700 } }}
        />
      ) : (
        <Typography noWrap fontWeight={700} sx={{ maxWidth: 780, mx: "auto", flex: 1, fontSize: 15 }}>{title}</Typography>
      )}
      <Tooltip title={t(editing ? "workspace.chat.saveThreadTitle" : "workspace.chat.editThreadTitle")}>
        <span>
          <IconButton
            size="small"
            color="primary"
            disabled={!threadID || saving || (editing && (!normalized || normalized === title))}
            onClick={() => editing ? void save() : setEditing(true)}
          >
            {saving ? <CircularProgress size={17} /> : editing ? <SaveOutlinedIcon fontSize="small" /> : <EditOutlinedIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
