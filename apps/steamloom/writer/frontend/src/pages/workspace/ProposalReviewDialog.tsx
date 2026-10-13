import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerVersionCompareDialog, type StorytellerVersionCompareEntry } from "@steamloom-web/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import { stripMarkerForDiffContent } from "@steamloom-web/pages/storyteller/wysiwygCore/parser.ts";
import { useSnack } from "@/components/SnackProvider.tsx";
import { backend, errorMessage, type AgentProposal, type AgentProposalItem, type Document } from "@/lib/backend.ts";

export function ProposalReviewDialog({
  agentID,
  projectID,
  threadID,
  proposal,
  item,
  deciding,
  onClose,
  onDecision,
}: {
  agentID: string;
  projectID: string;
  threadID: string;
  proposal: AgentProposal | null;
  item: AgentProposalItem | null;
  deciding: boolean;
  onClose: () => void;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [document, setDocument] = useState<Document | null>(null);
  const [imageURL, setImageURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const open = Boolean(proposal && item);

  useEffect(() => {
    let canceled = false;
    setDocument(null);
    setImageURL("");
    setLoadError("");
    if (!proposal || !item) return;
    const request = item.kind === "asset"
      ? backend.ProposalAssetPreview(agentID, projectID, threadID, proposal.id, item.id).then((url) => { if (!canceled) setImageURL(url); })
      : item.target_id
        ? backend.Document(projectID, item.kind, item.target_id).then((next) => { if (!canceled) setDocument(next); })
        : Promise.resolve();
    setLoading(true);
    request.catch((err) => {
      if (canceled) return;
      const message = errorMessage(err);
      setLoadError(message);
      showError(message);
    }).finally(() => {
      if (!canceled) setLoading(false);
    });
    return () => { canceled = true; };
  }, [agentID, item, projectID, proposal, showError, threadID]);

  const versions = useMemo(() => buildVersions(proposal, item, document, t), [document, item, proposal, t]);
  if (proposal && item && item.kind !== "asset" && item.target_id && document && versions) {
    const currentVersion = document.latest_version_id?.toString() ?? "";
    const stale = Boolean(item.base_version_id && currentVersion && item.base_version_id !== currentVersion);
    return (
      <StorytellerVersionCompareDialog
        open
        onClose={onClose}
        itemTitle={item.title || document.title}
        dialogTitle={t("workspace.chat.proposal.diffTitle", { title: item.title || document.title })}
        leftVersionLabel={t("workspace.chat.proposal.currentVersion")}
        rightVersionLabel={t("workspace.chat.proposal.proposedVersion")}
        leftVersion={versions.left}
        rightVersion={versions.right}
        notice={stale ? <Alert severity="warning">{t("workspace.chat.proposal.stale", { base: item.base_version_id, current: currentVersion })}</Alert> : <Alert severity="info">{t("workspace.chat.proposal.notWritten")}</Alert>}
        actions={<ProposalActions proposal={proposal} deciding={deciding} stale={stale} onClose={onClose} onDecision={onDecision} />}
      />
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" fontWeight={800} sx={{ flex: 1 }}>{item?.title || item?.file_name || t("workspace.chat.proposal.untitled")}</Typography>
          <IconButton onClick={onClose} aria-label={t("workspace.chat.proposal.close")}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {loading && <CircularProgress size={22} />}
        {loadError && <Alert severity="error">{loadError}</Alert>}
        {!loading && !loadError && item?.kind === "asset" && (
          <Stack spacing={2}>
            <Alert severity="info">{t("workspace.chat.proposal.assetNotUploaded")}</Alert>
            {imageURL && <Box component="img" src={imageURL} alt={item.alt_text || item.title || ""} sx={{ display: "block", maxWidth: "100%", maxHeight: "60vh", mx: "auto", objectFit: "contain", borderRadius: 2 }} />}
            <Metadata label={t("workspace.chat.proposal.fileName")} value={item.file_name || "—"} />
            <Metadata label={t("workspace.chat.proposal.mimeType")} value={item.mime_type || "—"} />
            <Metadata label={t("workspace.chat.proposal.fileSize")} value={formatBytes(item.file_size)} />
            <Metadata label={t("workspace.chat.proposal.altText")} value={item.alt_text || "—"} />
          </Stack>
        )}
        {!loading && !loadError && item && item.kind !== "asset" && !item.target_id && (
          <Stack spacing={2}>
            <Alert severity="info">{t("workspace.chat.proposal.newNotCreated")}</Alert>
            {item.summary && <Metadata label={t("workspace.chat.proposal.summary")} value={item.summary} />}
            <Paper component="pre" variant="outlined" sx={{ m: 0, p: 2, maxHeight: "60vh", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 14, lineHeight: 1.8 }}>
              {stripMarkerForDiffContent(item.content || "")}
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions><ProposalActions proposal={proposal} deciding={deciding} onClose={onClose} onDecision={onDecision} /></DialogActions>
    </Dialog>
  );
}

function ProposalActions({
  proposal,
  deciding,
  stale = false,
  onClose,
  onDecision,
}: {
  proposal: AgentProposal | null;
  deciding: boolean;
  stale?: boolean;
  onClose: () => void;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();
  if (proposal?.status !== "awaiting_confirmation") return <Button onClick={onClose}>{t("workspace.chat.proposal.close")}</Button>;
  return (
    <>
      <Button disabled={deciding} onClick={onClose}>{t("workspace.chat.proposal.later")}</Button>
      <Button color="error" disabled={deciding} onClick={() => onDecision("reject")}>{t("workspace.chat.proposal.reject")}</Button>
      <Button variant="contained" disabled={deciding || stale} onClick={() => onDecision("approve")}>
        {deciding ? <CircularProgress size={16} color="inherit" /> : t("workspace.chat.proposal.approve", { count: proposal.items.length })}
      </Button>
    </>
  );
}

function buildVersions(proposal: AgentProposal | null, item: AgentProposalItem | null, document: Document | null, t: (key: string, options?: Record<string, unknown>) => string): { left: StorytellerVersionCompareEntry; right: StorytellerVersionCompareEntry } | null {
  if (!proposal || !item || !document) return null;
  const story = item.kind === "story";
  return {
    left: {
      title: document.title,
      summary: story ? document.summary : undefined,
      content: document.latest_content,
      source: t("workspace.chat.proposal.dbSource", { version: document.latest_version_id ?? "—" }),
      createdAt: document.updated_at,
    },
    right: {
      title: item.title || "",
      summary: story ? item.summary || "" : undefined,
      content: item.content || "",
      source: t("workspace.chat.proposal.agentSource", { agent: proposal.agent_id }),
      createdAt: proposal.created_at,
    },
  };
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Typography color="text.secondary" sx={{ minWidth: 110, fontSize: 13 }}>{label}</Typography><Typography sx={{ fontSize: 13, overflowWrap: "anywhere" }}>{value}</Typography></Stack>;
}

function formatBytes(value?: number) {
  if (value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}
