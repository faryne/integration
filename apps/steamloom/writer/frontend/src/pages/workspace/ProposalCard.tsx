import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentProposal, AgentProposalItem } from "@writer/lib/backend.ts";

export function ProposalCard({ proposal, confirming, onConfirmApplied, onReview }: { proposal: AgentProposal; confirming: boolean; onConfirmApplied: () => void; onReview: (item: AgentProposalItem, selectedIDs: string[]) => void }) {
  const { t } = useTranslation();
  const pending = proposal.status === "awaiting_confirmation";
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState(() => new Set(proposal.selected_item_ids?.length ? proposal.selected_item_ids : proposal.items.map((item) => item.id)));
  const selectedItems = proposal.items.filter((item) => selected.has(item.id));
  const decidedArtifacts = new Set(proposal.selected_artifact_ids ?? []);
  const selectedIDs = [
    ...selectedItems.map((item) => item.id),
    ...selectedItems.flatMap((item) => item.artifacts?.filter((artifact) => pending ? artifact.default_selected !== false : decidedArtifacts.size === 0 || decidedArtifacts.has(artifact.id)).map((artifact) => artifact.id) ?? []),
  ];
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const color = pending || proposal.status === "conflict" || proposal.status === "verification_required" ? "warning" : proposal.status === "applied" ? "success" : proposal.status === "apply_failed" || proposal.status === "rejected" ? "error" : "info";
  return <>
    <Paper variant="outlined" sx={{ width: "100%", p: 1.5, borderColor: pending ? "warning.main" : "divider", bgcolor: pending ? "warning.light" : "action.hover" }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <RateReviewOutlinedIcon color={pending ? "warning" : "disabled"} fontSize="small" />
        <Typography fontWeight={700} sx={{ fontSize: 13.5 }}>{t(`workspace.chat.proposal.status.${proposal.status}`)}</Typography>
        <Box sx={{ flex: 1 }} />
        {pending && proposal.items.length > 1 && (
          <FormControlLabel
            sx={{ mr: 0.5, "& .MuiFormControlLabel-label": { fontSize: 12.5 } }}
            control={<Checkbox size="small" checked={selected.size === proposal.items.length} indeterminate={selected.size > 0 && selected.size < proposal.items.length} onChange={() => setSelected(selected.size === proposal.items.length ? new Set() : new Set(proposal.items.map((item) => item.id)))} />}
            label={t("workspace.chat.proposal.selectAll")}
          />
        )}
        <Chip size="small" color={color} label={t(`workspace.chat.states.${proposal.status}`)} />
        {proposal.status === "verification_required" && <Button size="small" variant="outlined" color="warning" disabled={confirming} onClick={() => setConfirmOpen(true)}>{t("workspace.chat.proposal.confirmApplied")}</Button>}
      </Stack>
      <Stack spacing={0.75} sx={{ mt: 1.25 }}>
        {proposal.items.map((item) => (
          <Stack key={item.id} direction="row" alignItems="center" spacing={1} sx={{ p: 1, borderRadius: 1.5, bgcolor: "background.paper" }}>
            {pending && <Checkbox size="small" checked={selected.has(item.id)} onChange={() => toggle(item.id)} inputProps={{ "aria-label": t("workspace.chat.proposal.selectItem", { title: item.title || item.file_name || "" }) }} />}
            <Chip size="small" variant="outlined" label={t(`workspace.chat.proposal.types.${item.proposal_type || (item.kind === "asset" ? "asset.upload" : item.target_id ? "document.replace" : "document.create")}`)} />
            <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13 }}>{item.title || item.file_name || t("workspace.chat.proposal.untitled")}</Typography>
            <Button size="small" onClick={() => onReview(item, selectedIDs)}>{t(pending ? "workspace.chat.proposal.review" : "workspace.chat.proposal.view")}</Button>
          </Stack>
        ))}
      </Stack>
    </Paper>
    <Dialog open={confirmOpen} onClose={() => !confirming && setConfirmOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{t("workspace.chat.proposal.confirmAppliedTitle")}</DialogTitle>
      <DialogContent><DialogContentText>{t("workspace.chat.proposal.confirmAppliedDescription")}</DialogContentText></DialogContent>
      <DialogActions>
        <Button disabled={confirming} onClick={() => setConfirmOpen(false)}>{t("workspace.chat.proposal.cancel")}</Button>
        <Button variant="contained" color="warning" disabled={confirming} onClick={() => { onConfirmApplied(); setConfirmOpen(false); }}>{t("workspace.chat.proposal.confirmApplied")}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
