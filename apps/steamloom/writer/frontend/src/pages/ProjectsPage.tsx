import { Box, Breadcrumbs, CircularProgress, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type Project } from "@/lib/backend.ts";
import { ProjectCard } from "@/pages/ProjectCard.tsx";

// 登入後的主頁：列出作者可以使用的專案。
export function ProjectsPage({ onSessionExpired }: { onSessionExpired: () => void }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    backend
      .Projects()
      .then(setProjects)
      .catch((err) => {
        if (isNotLoggedIn(err)) return onSessionExpired();
        showError(errorMessage(err));
        setProjects([]);
      });
  }, [onSessionExpired, showError]);

  return (
    <>
      <Box sx={{ height: 44, px: 2.25, display: "flex", alignItems: "center", borderBottom: 1, borderColor: "divider", flex: "none" }}>
        <Breadcrumbs>
          <Typography color="primary" fontWeight={500}>
            {t("projects.title")}
          </Typography>
        </Breadcrumbs>
      </Box>
      <Box sx={{ flex: 1, overflow: "auto", px: 3.5, py: 2.75 }}>
        <Typography variant="h5" sx={{ fontSize: 18, mb: 2 }}>
          {t("projects.title")}
        </Typography>
        {projects === null ? (
          <CircularProgress size={24} />
        ) : projects.length === 0 ? (
          <Typography color="text.secondary">{t("projects.empty")}</Typography>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.25 }}>
            {projects.map((project) => (
              <ProjectCard key={project.public_id} project={project} />
            ))}
          </Box>
        )}
      </Box>
    </>
  );
}
