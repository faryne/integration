import { StorytellerUnsavedChangesDialog, type StorytellerUnsavedChangesDialogLabels } from "@/components/storyteller/StorytellerUnsavedChangesDialog.tsx";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import SaveIcon from "@mui/icons-material/Save";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { Box, Button, CircularProgress, List, ListItemButton, ListItemIcon, ListItemText, Paper } from "@mui/material";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@writer/components/AppBreadcrumbs.tsx";
import { GeneralSettingsPage } from "@writer/pages/settings/GeneralSettingsPage.tsx";
import { SettingsFormContextProvider, type SettingsFormController } from "@writer/pages/settings/settingsForm.tsx";
import { WorkerSettingsPage } from "@writer/pages/settings/WorkerSettingsPage.tsx";

export type SettingsSection = "general" | "workers";

const sections: { id: SettingsSection; icon: ReactNode; title: string; render: () => ReactNode }[] = [
  { id: "general", icon: <SettingsOutlinedIcon fontSize="small" />, title: "settings.general.title", render: () => <GeneralSettingsPage /> },
  { id: "workers", icon: <ImageOutlinedIcon fontSize="small" />, title: "settings.workers.title", render: () => <WorkerSettingsPage /> },
];

export const defaultSettingsSection: SettingsSection = "general";

export function SettingsPage({ rootLabel, section, onSection, onBack }: { rootLabel: string; section: SettingsSection; onSection: (section: SettingsSection) => void; onBack: () => void }) {
  const { t } = useTranslation();
  const [controller, setController] = useState<SettingsFormController | null>(null);
  const controllerRef = useRef<SettingsFormController | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const current = sections.find((item) => item.id === section) ?? sections[0];
  const register = useCallback((next: SettingsFormController | null) => {
    controllerRef.current = next;
    setController(next);
  }, []);
  const requestNavigation = useCallback((action: () => void) => {
    if (controllerRef.current?.dirty) setPending(() => action);
    else action();
  }, []);
  const context = useMemo(() => ({ register, requestNavigation }), [register, requestNavigation]);
  const labels = useMemo<StorytellerUnsavedChangesDialogLabels>(() => ({
    toneLabel: t("settings.unsaved.tone"),
    eyebrow: t("settings.unsaved.eyebrow"),
    title: t("settings.unsaved.title"),
    saveDescription: t("settings.unsaved.saveDescription"),
    discardDescription: t("settings.unsaved.discardDescription"),
    continueEditing: t("settings.unsaved.continueEditing"),
    discardAndLeave: t("settings.unsaved.discardAndLeave"),
    saveAndContinue: t("settings.unsaved.saveAndContinue"),
  }), [t]);
  const finishNavigation = () => {
    const action = pending;
    setPending(null);
    action?.();
  };
  const saveAndContinue = async () => {
    if (!controller) return;
    try {
      await controller.save();
      finishNavigation();
    } catch {
      // 表單本身已顯示錯誤；保留確認視窗與目前頁面，讓作者修正或重試。
    }
  };
  const discardAndContinue = () => {
    controller?.discard();
    finishNavigation();
  };

  return (
    <SettingsFormContextProvider value={context}>
      <AppBreadcrumbs items={[{ label: rootLabel, onClick: () => requestNavigation(onBack) }, { label: t("settings.title") }, { label: t(current.title) }]} />
      <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Box component="nav" sx={{ width: 220, flex: "none", borderRight: 1, borderColor: "divider", overflow: "auto" }}>
          <List dense sx={{ py: 1 }}>
            {sections.map((item) => (
              <ListItemButton key={item.id} selected={item.id === current.id} onClick={() => item.id !== current.id && requestNavigation(() => onSection(item.id))} sx={{ mx: 1, borderRadius: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={t(item.title)} />
              </ListItemButton>
            ))}
          </List>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: "flex" }}>{current.render()}</Box>
      </Box>
      <Paper elevation={8} sx={{ position: "fixed", right: 24, bottom: 22, zIndex: 20, p: 1 }}>
        <Button variant="contained" startIcon={controller?.saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />} disabled={!controller?.dirty || !controller.canSave || controller.saving} onClick={() => void controller?.save()}>
          {controller?.saving ? t("settings.saving") : t("settings.save")}
        </Button>
      </Paper>
      <StorytellerUnsavedChangesDialog
        open={pending !== null}
        labels={labels}
        onContinueEditing={() => setPending(null)}
        onDiscardChanges={discardAndContinue}
        onSaveAndContinue={controller?.canSave ? saveAndContinue : undefined}
      />
    </SettingsFormContextProvider>
  );
}
