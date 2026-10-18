import AddIcon from "@mui/icons-material/Add";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { StorytellerProjectMenuButton, type StorytellerProjectMenuTarget } from "@/pages/storyteller/StorytellerProjectMenuButton.tsx";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@writer/components/AppBreadcrumbs.tsx";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type Project } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { openOnWeb, projectWebPath } from "@writer/lib/webLinks.ts";
import { ExportBackupDialog } from "@writer/pages/ExportBackupDialog.tsx";
import { ProjectCard } from "@writer/pages/ProjectCard.tsx";

// Go 回傳的 visibility／rating 是 string；選單沿用網站型別，這裡收窄
const menuTarget = (project: Project) => project as StorytellerProjectMenuTarget;

// 登入後的主頁：列出作者的專案；可建立專案，卡片右上選單可切換公開狀態、編輯、刪除（與網站共用）。
export function ProjectsPage({ onOpen, onCreate, onEdit }: { onOpen: (project: Project) => void; onCreate: () => void; onEdit: (project: Project) => void }) {
  const { t } = useTranslation();
  // 選單改了公開狀態或刪除專案後遞增，觸發重抓列表
  const [revision, setRevision] = useState(0);
  const projects = useBackendData(() => backend.Projects(), [revision]);
  const reload = () => setRevision((value) => value + 1);
  const { showError } = useSnack();
  const [exporting, setExporting] = useState<Project | null>(null);
  // 卡片 ⋯ 選單裡 Writer 專屬的項目（網站上本來就在網站，不需要這兩個）
  const extraItems = (project: Project) => [
    { key: "web", label: t("projects.openOnWeb"), icon: <OpenInNewIcon fontSize="small" />, onClick: () => openOnWeb(projectWebPath(project)).catch((err) => showError(errorMessage(err))) },
    { key: "backup", label: t("projects.backup.menu"), icon: <ArchiveOutlinedIcon fontSize="small" />, onClick: () => setExporting(project) },
  ];
  const createButton = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
      {t("projects.create")}
    </Button>
  );

  return (
    <>
      <AppBreadcrumbs items={[{ label: t("projects.title") }]} />
      <Box sx={{ flex: 1, overflow: "auto", px: 3.5, py: 2.75 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontSize: 18 }}>
            {t("projects.title")}
          </Typography>
          {Boolean(projects?.length) && createButton}
        </Stack>
        {projects === null ? (
          <CircularProgress size={24} />
        ) : !projects?.length ? (
          // 沒有專案時把建立入口放在空狀態中央，新帳號開 Writer 不會卡住
          <Stack alignItems="center" spacing={2} sx={{ mt: 8 }}>
            <Typography color="text.secondary">{t("projects.empty")}</Typography>
            {createButton}
          </Stack>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.25 }}>
            {projects.map((project) => (
              <ProjectCard
                key={project.public_id}
                project={project}
                onOpen={() => onOpen(project)}
                action={<StorytellerProjectMenuButton project={menuTarget(project)} onEdit={() => onEdit(project)} onChanged={reload} extraItems={extraItems(project)} />}
              />
            ))}
          </Box>
        )}
      </Box>
      {exporting && <ExportBackupDialog project={exporting} onClose={() => setExporting(null)} />}
    </>
  );
}
