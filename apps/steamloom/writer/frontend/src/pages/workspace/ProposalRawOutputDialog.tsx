import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage } from "@writer/lib/backend.ts";

// 提案無法使用時，Writer 保存了 Agent 的完整原始回答；這裡只讀顯示，讓作者自行複製草稿。
export function ProposalRawOutputDialog({ agentID, projectID, threadID, eventID, onClose }: { agentID: string; projectID: string; threadID: string; eventID: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [raw, setRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!eventID) return;
    let canceled = false;
    setRaw(null);
    backend.ProposalInvalidOutput(agentID, projectID, threadID, eventID)
      .then((text) => { if (!canceled) setRaw(text); })
      .catch((err) => {
        if (canceled) return;
        showError(errorMessage(err));
        onClose();
      });
    return () => { canceled = true; };
  }, [agentID, eventID, onClose, projectID, showError, threadID]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(raw ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  return (
    <Dialog open={eventID !== ""} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t("workspace.chat.activity.rawOutputTitle")}</DialogTitle>
      <DialogContent dividers>
        {raw === null ? <CircularProgress size={18} /> : (
          <Box component="pre" sx={{ m: 0, fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", userSelect: "text" }}>{raw}</Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button startIcon={<ContentCopyIcon />} disabled={raw === null} onClick={() => void copy()}>
          {copied ? t("workspace.chat.activity.rawOutputCopied") : t("workspace.chat.activity.rawOutputCopy")}
        </Button>
        <Button onClick={onClose}>{t("workspace.chat.activity.rawOutputClose")}</Button>
      </DialogActions>
    </Dialog>
  );
}
