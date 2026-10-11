import { Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@/components/AppBreadcrumbs.tsx";
import { backend, type Project } from "@/lib/backend.ts";
import { useBackendData } from "@/lib/useBackendData.ts";
import { ProjectCard } from "@/pages/ProjectCard.tsx";

// 登入後的主頁：列出作者可以使用的專案，點卡片進入專案工作台。
export function ProjectsPage({ onOpen }: { onOpen: (project: Project) => void }) {
  const { t } = useTranslation();
  const projects = useBackendData(() => backend.Projects(), []);

  return (
    <>
      <AppBreadcrumbs items={[{ label: t("projects.title") }]} />
      <Box sx={{ flex: 1, overflow: "auto", px: 3.5, py: 2.75 }}>
        <Typography variant="h5" sx={{ fontSize: 18, mb: 2 }}>
          {t("projects.title")}
        </Typography>
        {projects === null ? (
          <CircularProgress size={24} />
        ) : !projects?.length ? (
          <Typography color="text.secondary">{t("projects.empty")}</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.25 }}>
            {projects.map((project) => (
              <ProjectCard key={project.public_id} project={project} onOpen={() => onOpen(project)} />
            ))}
          </Box>
        )}
      </Box>
    </>
  );
}
