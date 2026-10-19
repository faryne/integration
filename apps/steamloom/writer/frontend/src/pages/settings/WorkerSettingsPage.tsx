import AddIcon from "@mui/icons-material/Add";
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type MediaWorker, type WorkerAdapter, type WorkerSaveInput } from "@writer/lib/backend.ts";
import { AddWorkerDialog } from "@writer/pages/settings/AddWorkerDialog.tsx";
import { WorkerDetail } from "@writer/pages/settings/WorkerDetail.tsx";
import { WorkerRegistryList } from "@writer/pages/settings/WorkerRegistryList.tsx";
import { useSettingsNavigation } from "@writer/pages/settings/settingsForm.tsx";

// WorkerSettingsPage 是設定外框右側的「媒體 Worker」內容：Worker 列表＋編輯區。
// 不自動選第一個 Worker；沒選時提示點選，一個都沒有時引導建立。
export function WorkerSettingsPage() {
  const { t } = useTranslation();
  const { showError, showSuccess, showWarning } = useSnack();
  const requestNavigation = useSettingsNavigation();
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
  const handleSave = async (input: WorkerSaveInput) => {
    setBusy("save");
    try {
      await save(input);
    } catch (error) {
      showError(errorMessage(error));
      throw error;
    } finally {
      setBusy(null);
    }
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
        setSelectedID("");
        setDeleting(null);
        showSuccess(t("settings.workers.deleted"));
      })
      .catch((error) => showError(errorMessage(error)))
      .finally(() => setBusy(null));
  };

  return (
    <>
      {adapters === null || workers === null ? (
        <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
          <WorkerRegistryList workers={workers} selectedID={selectedID} onSelect={(id) => requestNavigation(() => { setCreating(null); setSelectedID(id); })} onAdd={() => requestNavigation(() => setAddOpen(true))} />
          {selectedAdapter ? (
            <WorkerDetail adapter={selectedAdapter} worker={creating ? undefined : selected} busy={busy} onSave={handleSave} onTest={handleTest} onDelete={selected ? () => setDeleting(selected) : undefined} />
          ) : workers.length ? (
            <Stack sx={{ flex: 1 }} alignItems="center" justifyContent="center">
              <Typography color="text.secondary">{t("settings.workers.selectHint")}</Typography>
            </Stack>
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
