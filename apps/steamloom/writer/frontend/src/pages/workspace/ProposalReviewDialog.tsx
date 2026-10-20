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
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StorytellerVersionCompareDialog, type StorytellerVersionCompareEntry } from "@steamloom-web/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import { stripMarkerForDiffContent } from "@steamloom-web/pages/storyteller/wysiwygCore/parser.ts";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type AgentProposal, type AgentProposalItem, type Document, type MediaWorkerOption, type WorkerJobSpec } from "@writer/lib/backend.ts";
import { formatBytes } from "@writer/lib/format.ts";
import { canRetryMedia, initialMediaJobInputs, MediaJobForm } from "@writer/pages/workspace/MediaJobForm.tsx";
import { ProposalArtifactGallery } from "@writer/pages/workspace/ProposalArtifactGallery.tsx";

export function ProposalReviewDialog({
  agentID,
  projectID,
  threadID,
  proposal,
  item,
  selectedCount,
  itemSelected,
  selectedArtifactIDs,
  deciding,
  onClose,
  onDecision,
  onMediaDecision,
  onArtifactSelectionChange,
}: {
  agentID: string;
  projectID: string;
  threadID: string;
  proposal: AgentProposal | null;
  item: AgentProposalItem | null;
  selectedCount: number;
  itemSelected: boolean;
  selectedArtifactIDs: string[];
  deciding: boolean;
  onClose: () => void;
  onDecision: (decision: "approve" | "reject") => void;
  onMediaDecision: (workerID: string, executionCount: number, inputs: Record<string, unknown>) => void;
  onArtifactSelectionChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [document, setDocument] = useState<Document | null>(null);
  const [imageURL, setImageURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [jobSpec, setJobSpec] = useState<WorkerJobSpec | null>(null);
  const [jobInputs, setJobInputs] = useState<Record<string, unknown>>({});
  const [workerOptions, setWorkerOptions] = useState<MediaWorkerOption[]>([]);
  const [selectedWorkerID, setSelectedWorkerID] = useState("");
  const [executionCount, setExecutionCount] = useState(1);
  const open = Boolean(proposal && item);

  useEffect(() => {
    let canceled = false;
    setDocument(null);
    setImageURL("");
    setLoadError("");
    setJobSpec(null);
    setJobInputs({});
    setWorkerOptions([]);
    setSelectedWorkerID("");
    setExecutionCount(1);
    if (!proposal || !item) return;
    const recommendedWorkerID = item.recommended_worker_id || item.worker_id;
    const request = proposalType(item) === "media.brief" && recommendedWorkerID
      ? backend.CompatibleMediaWorkers(recommendedWorkerID).then(async (options) => {
        if (!options.length) throw new Error(t("workspace.chat.proposal.noCompatibleWorker"));
        const workerID = options.some((option) => option.worker_id === item.worker_id) ? item.worker_id! : options[0].worker_id;
        const spec = await backend.WorkerJobSpec(workerID);
        if (!canceled) {
          setWorkerOptions(options);
          setSelectedWorkerID(workerID);
          setExecutionCount(Math.min(10, Math.max(1, item.execution_count || 1)));
          setJobSpec(spec);
          setJobInputs(initialMediaJobInputs(spec, item));
        }
      })
      : item.kind === "asset" && !item.artifacts?.length
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
  }, [agentID, item, projectID, proposal, showError, t, threadID]);

  const selectWorker = async (workerID: string) => {
    if (!item || workerID === selectedWorkerID) return;
    setSelectedWorkerID(workerID);
    setLoading(true);
    setLoadError("");
    try {
      const spec = await backend.WorkerJobSpec(workerID);
      setJobSpec(spec);
      setJobInputs(initialMediaJobInputs(spec, item, jobInputs));
    } catch (err) {
      const message = errorMessage(err);
      setLoadError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const versions = useMemo(() => buildVersions(proposal, item, document, t), [document, item, proposal, t]);
  const type = proposalType(item);
  const mediaBrief = type === "media.brief";
  const assetUpload = type === "asset.upload";
  const mediaRetry = Boolean(proposal && canRetryMedia(proposal));
  const mediaProposal = mediaBrief || assetUpload || type.startsWith("image_story.");
  if (proposal && item && !mediaProposal && item.target_id && document && versions) {
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
        actions={<ProposalActions proposal={proposal} selectedCount={selectedCount} deciding={deciding} stale={stale} onClose={onClose} onDecision={onDecision} />}
      />
    );
  }

  const currentVersion = document?.latest_version_id?.toString() ?? "";
  const stale = Boolean(item?.target_id && item.base_version_id && currentVersion && item.base_version_id !== currentVersion);
  const artifactsRequired = Boolean(item?.artifacts?.length);

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
        {!loading && !loadError && mediaBrief && item && jobSpec && (
          <Stack spacing={2}>
            <Alert severity="info">{t("workspace.chat.proposal.mediaBriefNotice", { worker: jobSpec.worker_name })}</Alert>
            {item.summary && <Metadata label={t("workspace.chat.proposal.summary")} value={item.summary} />}
            {item.brief?.notes && <Metadata label={t("workspace.chat.proposal.mediaNotes")} value={item.brief.notes} />}
            <TextField select label={t("workspace.chat.proposal.executionWorker")} value={selectedWorkerID} disabled={deciding} onChange={(event) => void selectWorker(event.target.value)}>
              {workerOptions.map((option) => <MenuItem key={option.worker_id} value={option.worker_id}>{option.name}{option.recommended ? ` ${t("workspace.chat.proposal.agentRecommended")}` : ""}</MenuItem>)}
            </TextField>
            <TextField
              type="number"
              label={t("workspace.chat.proposal.executionCount")}
              value={executionCount}
              disabled={deciding}
              helperText={t("workspace.chat.proposal.executionCountHint")}
              slotProps={{ htmlInput: { min: 1, max: 10, step: 1 } }}
              onChange={(event) => setExecutionCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
            />
            <MediaJobForm spec={jobSpec} values={jobInputs} disabled={proposal?.status !== "awaiting_confirmation" && !mediaRetry} onChange={setJobInputs} />
            <Alert severity="info">{t("workspace.chat.proposal.executionSummary", { jobs: executionCount, results: executionCount * Math.max(1, Number(jobInputs.candidate_count) || 1) })}</Alert>
          </Stack>
        )}
        {!loading && !loadError && item && artifactsRequired && proposal && (
          <Stack spacing={2}>
            <Alert severity={stale ? "warning" : "info"}>{stale ? t("workspace.chat.proposal.stale", { base: item.base_version_id, current: currentVersion }) : t(type.startsWith("image_story.") ? "workspace.chat.proposal.imageStoryNotWritten" : "workspace.chat.proposal.assetsNotUploaded")}</Alert>
            {item.summary && <Metadata label={t("workspace.chat.proposal.summary")} value={item.summary} />}
            <ProposalArtifactGallery
              agentID={agentID}
              projectID={projectID}
              threadID={threadID}
              proposal={proposal}
              item={item}
              selectedIDs={selectedArtifactIDs}
              editable={proposal.status === "awaiting_confirmation"}
              onSelectionChange={onArtifactSelectionChange}
            />
          </Stack>
        )}
        {!loading && !loadError && item?.kind === "asset" && !artifactsRequired && (
          <Stack spacing={2}>
            <Alert severity="info">{t("workspace.chat.proposal.assetNotUploaded")}</Alert>
            {imageURL && <Box component="img" src={imageURL} alt={item.alt_text || item.title || ""} sx={{ display: "block", maxWidth: "100%", maxHeight: "60vh", mx: "auto", objectFit: "contain", borderRadius: 2 }} />}
            <Metadata label={t("workspace.chat.proposal.fileName")} value={item.file_name || "—"} />
            <Metadata label={t("workspace.chat.proposal.mimeType")} value={item.mime_type || "—"} />
            <Metadata label={t("workspace.chat.proposal.fileSize")} value={formatBytes(item.file_size)} />
            <Metadata label={t("workspace.chat.proposal.altText")} value={item.alt_text || "—"} />
          </Stack>
        )}
        {!loading && !loadError && item && !mediaProposal && !item.target_id && (
          <Stack spacing={2}>
            <Alert severity="info">{t("workspace.chat.proposal.newNotCreated")}</Alert>
            {item.summary && <Metadata label={t("workspace.chat.proposal.summary")} value={item.summary} />}
            <Paper component="pre" variant="outlined" sx={{ m: 0, p: 2, maxHeight: "60vh", overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", fontSize: 14, lineHeight: 1.8 }}>
              {stripMarkerForDiffContent(item.content || "")}
            </Paper>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>{mediaRetry ? (
        <>
          <Button disabled={deciding} onClick={onClose}>{t("workspace.chat.proposal.close")}</Button>
          <Button variant="contained" disabled={deciding || !jobSpec || !selectedWorkerID} onClick={() => onMediaDecision(selectedWorkerID, executionCount, jobInputs)}>
            {deciding ? <CircularProgress size={16} color="inherit" /> : t("workspace.chat.proposal.regenerate")}
          </Button>
        </>
      ) : <ProposalActions proposal={proposal} selectedCount={selectedCount} deciding={deciding} stale={stale} selectionMissing={itemSelected && artifactsRequired && selectedArtifactIDs.length === 0} approveLabel={mediaBrief ? t("workspace.chat.proposal.generate") : assetUpload ? t("workspace.chat.proposal.approveAssetUpload", { count: selectedCount }) : undefined} onClose={onClose} onDecision={(decision) => decision === "approve" && mediaBrief ? onMediaDecision(selectedWorkerID, executionCount, jobInputs) : onDecision(decision)} />}</DialogActions>
    </Dialog>
  );
}

function ProposalActions({
  proposal,
  selectedCount,
  deciding,
  stale = false,
  selectionMissing = false,
  approveLabel,
  onClose,
  onDecision,
}: {
  proposal: AgentProposal | null;
  selectedCount: number;
  deciding: boolean;
  stale?: boolean;
  selectionMissing?: boolean;
  approveLabel?: string;
  onClose: () => void;
  onDecision: (decision: "approve" | "reject") => void;
}) {
  const { t } = useTranslation();
  if (proposal?.status !== "awaiting_confirmation") return <Button onClick={onClose}>{t("workspace.chat.proposal.close")}</Button>;
  return (
    <>
      <Button disabled={deciding} onClick={onClose}>{t("workspace.chat.proposal.later")}</Button>
      <Button color="error" disabled={deciding} onClick={() => onDecision("reject")}>{t("workspace.chat.proposal.reject")}</Button>
      <Button variant="contained" disabled={deciding || stale || selectionMissing || selectedCount === 0} onClick={() => onDecision("approve")}>
        {deciding ? <CircularProgress size={16} color="inherit" /> : approveLabel || t("workspace.chat.proposal.approve", { count: selectedCount })}
      </Button>
    </>
  );
}

function buildVersions(proposal: AgentProposal | null, item: AgentProposalItem | null, document: Document | null, t: (key: string, options?: Record<string, unknown>) => string): { left: StorytellerVersionCompareEntry; right: StorytellerVersionCompareEntry } | null {
  if (!proposal || !item || !document) return null;
  const story = item.kind === "story";
  const chapter = proposalType(item).startsWith("chapter.");
  return {
    left: {
      title: chapter ? t("workspace.chat.proposal.chapterBase") : document.title,
      summary: story && !chapter ? document.summary : undefined,
      content: chapter ? item.base?.content || "" : document.latest_content,
      source: t("workspace.chat.proposal.dbSource", { version: document.latest_version_id ?? "—" }),
      createdAt: document.updated_at,
    },
    right: {
      title: chapter ? t("workspace.chat.proposal.chapterProposal") : item.title || "",
      summary: story && !chapter ? item.summary || "" : undefined,
      content: item.content || "",
      source: t("workspace.chat.proposal.agentSource", { agent: proposal.agent_id }),
      createdAt: proposal.created_at,
    },
  };
}

function proposalType(item: AgentProposalItem | null) {
  if (!item) return "";
  return item.proposal_type || (item.kind === "asset" ? "asset.upload" : item.target_id ? "document.replace" : "document.create");
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Typography color="text.secondary" sx={{ minWidth: 110, fontSize: 13 }}>{label}</Typography><Typography sx={{ fontSize: 13, overflowWrap: "anywhere" }}>{value}</Typography></Stack>;
}
