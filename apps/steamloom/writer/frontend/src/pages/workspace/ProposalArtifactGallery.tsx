import CloseIcon from "@mui/icons-material/Close";
import { Box, Checkbox, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { agent } from "../../../wailsjs/go/models";
import { backend, errorMessage, type AgentProposal, type AgentProposalItem } from "@writer/lib/backend.ts";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { formatBytes } from "@writer/lib/format.ts";

export function ProposalArtifactGallery({
  agentID,
  projectID,
  threadID,
  proposal,
  item,
  selectedIDs,
  editable,
  onSelectionChange,
}: {
  agentID: string;
  projectID: string;
  threadID: string;
  proposal: AgentProposal;
  item: AgentProposalItem;
  selectedIDs: string[];
  editable: boolean;
  onSelectionChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const artifacts = item.artifacts ?? [];
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<{ url: string; index: number; alt: string } | null>(null);

  useEffect(() => {
    let canceled = false;
    setPreviews({});
    if (!artifacts.length) return;
    setLoading(true);
    Promise.all(artifacts.map(async (artifact) => {
      try {
        const url = artifact.local_path
          ? await backend.ProposalArtifactPreview(agentID, projectID, threadID, proposal.id, item.id, artifact.id)
          : artifact.asset_public_id
            ? (await backend.Asset(projectID, artifact.asset_public_id)).preview_url
            : "";
        return { id: artifact.id, url, error: undefined as unknown };
      } catch (error) {
        return { id: artifact.id, url: "", error };
      }
    })).then((values) => {
      if (canceled) return;
      setPreviews(Object.fromEntries(values.map(({ id, url }) => [id, url])));
      const failed = values.find((value) => value.error);
      if (failed?.error) showError(errorMessage(failed.error));
    }).finally(() => {
      if (!canceled) setLoading(false);
    });
    return () => { canceled = true; };
  }, [agentID, artifacts, item.id, projectID, proposal.id, showError, threadID]);

  const toggle = (artifact: agent.ProposalArtifact) => {
    const next = new Set(selectedIDs);
    if (next.has(artifact.id)) next.delete(artifact.id); else next.add(artifact.id);
    onSelectionChange(artifacts.filter((candidate) => next.has(candidate.id)).map((candidate) => candidate.id));
  };

  if (loading) return <CircularProgress size={22} />;
  return (
    <>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 1.5 }}>
        {artifacts.map((artifact, index) => (
          <Paper key={artifact.id} variant="outlined" sx={{ overflow: "hidden", borderColor: selectedIDs.includes(artifact.id) ? "primary.main" : "divider" }}>
            <Box sx={{ position: "relative", aspectRatio: "4 / 3", bgcolor: "action.hover", display: "grid", placeItems: "center" }}>
              {previews[artifact.id] ? <Box
                component="img"
                src={previews[artifact.id]}
                alt={artifact.alt_text || t("workspace.chat.proposal.candidateResult", { index: index + 1 })}
                role="button"
                tabIndex={0}
                onClick={() => setExpanded({ url: previews[artifact.id], index: index + 1, alt: artifact.alt_text || "" })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded({ url: previews[artifact.id], index: index + 1, alt: artifact.alt_text || "" });
                  }
                }}
                sx={{ width: "100%", height: "100%", objectFit: "contain", cursor: "zoom-in" }}
              /> : <Typography color="text.secondary">{t("workspace.chat.proposal.previewUnavailable")}</Typography>}
              {editable && <Checkbox checked={selectedIDs.includes(artifact.id)} onChange={() => toggle(artifact)} inputProps={{ "aria-label": t("workspace.chat.proposal.selectArtifact", { index: String(index + 1) }) }} sx={{ position: "absolute", top: 4, left: 4, bgcolor: "background.paper", borderRadius: 1, p: 0.5 }} />}
            </Box>
            <Stack spacing={0.25} sx={{ p: 1 }}>
              <Typography fontWeight={700} sx={{ fontSize: 12.5 }}>{t("workspace.chat.proposal.candidateResult", { index: index + 1 })}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>
                {artifact.mime_type || t("workspace.chat.proposal.existingAsset")} - {artifact.width && artifact.height ? `${artifact.width}×${artifact.height}` : "—"} {formatBytes(artifact.file_size)}
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Box>
      <Dialog open={Boolean(expanded)} onClose={() => setExpanded(null)} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {expanded && t("workspace.chat.proposal.candidateResult", { index: expanded.index })}
          <IconButton aria-label={t("workspace.chat.proposal.closePreview")} onClick={() => setExpanded(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1, height: "calc(100vh - 120px)", display: "grid", placeItems: "center", bgcolor: "background.default" }}>
          {expanded && <Box component="img" src={expanded.url} alt={expanded.alt || t("workspace.chat.proposal.candidateResult", { index: expanded.index })} sx={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
