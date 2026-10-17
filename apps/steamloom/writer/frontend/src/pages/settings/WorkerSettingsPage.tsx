import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@writer/components/AppBreadcrumbs.tsx";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type MediaWorker, type WorkerAdapter, type WorkerSaveInput } from "@writer/lib/backend.ts";
import { AddWorkerDialog } from "@writer/pages/settings/AddWorkerDialog.tsx";
import { WorkerDetail } from "@writer/pages/settings/WorkerDetail.tsx";
import { WorkerRegistryList } from "@writer/pages/settings/WorkerRegistryList.tsx";

// onBack 離開設定回到原本頁面；onSettingsHome 回到設定首頁的分類列表。
export function WorkerSettingsPage({ rootLabel, onBack, onSettingsHome }: { rootLabel: string; onBack: () => void; onSettingsHome: () => void }) {
  const { t } = useTranslation();
  const { showError, showSuccess, showWarning } = useSnack();
  const [adapters, setAdapters] = useState<WorkerAdapter[] | null>(null);
  const [workers, setWorkers] = useState<MediaWorker[] | null>(null);
  const [selectedID, setSelectedID] = useState("");
  const [creating, setCreating] = useState<WorkerAdapter | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState<MediaWorker | null>(null);
  const [busy, setBusy] = useState<"save" | "test" | "delete" | null>(null);

  const load = useCallback(() => Promise.all([backend.WorkerAdapters(), backend.Workers()])
    .then(([nextAdapters, nextWorkers]) => {
      setAdapters(nextAdapters);
      setWorkers(nextWorkers);
      setSelectedID((current) => current || nextWorkers[0]?.id || "");
    })
    .catch((error) => showError(errorMessage(error))), [showError]);
  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => workers?.find((worker) => worker.id === selectedID), [selectedID, workers]);
  const selectedAdapter = useMemo(() => creating ?? adapters?.find((adapter) => adapter.id === selected?.adapter_id), [adapters, creating, selected]);
  const replace = (worker: MediaWorker) => {
    setWorkers((current) => current ? [...current.filter((item) => item.id !== worker.id), worker].sort((a, b) => a.name.localeCompare(b.name)) : [worker]);
    setSelectedID(worker.id);
    setCreating(null);
  };

  const save = async (input: WorkerSaveInput, notify = true) => {
    const worker = await backend.SaveWorker(input);
    replace(worker);
    if (notify) showSuccess(t("settings.workers.saved"));
    return worker;
  };
  const handleSave = (input: WorkerSaveInput) => {
    setBusy("save");
    void save(input).catch((error) => showError(errorMessage(error))).finally(() => setBusy(null));
  };
  const handleTest = (input: WorkerSaveInput) => {
    setBusy("test");
    void save(input, false)
      .then((saved) => backend.TestWorker(saved.id))
      .then((tested) => {
        replace(tested);
        if (tested.status === "online") showSuccess(t("settings.workers.tested"));
        else showWarning(tested.status_message || t("settings.workers.status.error"));
      })
      .catch((error) => showError(errorMessage(error)))
      .finally(() => setBusy(null));
  };
  const handleDelete = () => {
    if (!deleting) return;
    setBusy("delete");
    void backend.DeleteWorker(deleting.id)
      .then(() => {
        const remaining = workers?.filter((worker) => worker.id !== deleting.id) ?? [];
        setWorkers(remaining);
        setSelectedID(remaining[0]?.id ?? "");
        setDeleting(null);
        showSuccess(t("settings.workers.deleted"));
      })
      .catch((error) => showError(errorMessage(error)))
      .finally(() => setBusy(null));
  };

  return (
    <>
      <AppBreadcrumbs items={[{ label: rootLabel, onClick: onBack }, { label: t("settings.title"), onClick: onSettingsHome }, { label: t("settings.workers.title") }]} />
      <Box sx={{ px: 3, pt: 1.5, pb: 2 }}>
        <Button size="small" startIcon={<ArrowBackIcon />} onClick={onSettingsHome} sx={{ ml: -1, mb: 0.5 }}>{t("settings.backToList")}</Button>
        <Typography variant="h5" sx={{ fontSize: 19 }}>{t("settings.workers.title")}</Typography>
        <Typography color="text.secondary" variant="body2">{t("settings.workers.subtitle")}</Typography>
      </Box>
      {adapters === null || workers === null ? (
        <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", borderTop: 1, borderColor: "divider" }}>
          <WorkerRegistryList workers={workers} selectedID={selectedID} onSelect={(id) => { setCreating(null); setSelectedID(id); }} onAdd={() => setAddOpen(true)} />
          {selectedAdapter ? (
            <WorkerDetail adapter={selectedAdapter} worker={creating ? undefined : selected} busy={busy} onSave={handleSave} onTest={handleTest} onDelete={selected ? () => setDeleting(selected) : undefined} />
          ) : (
            <Stack sx={{ flex: 1 }} alignItems="center" justifyContent="center" gap={1.5}>
              <Typography variant="h6">{t("settings.workers.empty")}</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>{t("settings.workers.add")}</Button>
            </Stack>
          )}
        </Box>
      )}
      <AddWorkerDialog open={addOpen} adapters={adapters ?? []} onClose={() => setAddOpen(false)} onSelect={(adapter) => { setCreating(adapter); setSelectedID(""); setAddOpen(false); }} />
      <Dialog open={deleting !== null} onClose={() => !busy && setDeleting(null)}>
        <DialogTitle>{t("settings.workers.deleteTitle")}</DialogTitle>
        <DialogContent>{t("settings.workers.deleteMessage", { name: deleting?.name })}</DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)} disabled={busy !== null}>{t("settings.workers.cancel")}</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={busy !== null}>{t("settings.workers.confirmDelete")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
