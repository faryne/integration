import { Box, Card, CardActionArea, Chip, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { Project } from "@writer/lib/backend.ts";
import { dateTimeFormat } from "@writer/lib/format.ts";

// 專案卡片：版型比照網站工作台；沒有封面時用菱形織框當佔位圖。
export function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="outlined" sx={{ "&:hover": { borderColor: "primary.main" } }}>
      <CardActionArea onClick={onOpen} sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <Box
          sx={(theme) => ({
            height: 120,
            display: "grid",
            placeItems: "center",
            background: project.cover_url
              ? `center / cover no-repeat url("${project.cover_url}")`
              : `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.18)}, transparent 60%), ${theme.palette.background.default}`,
          })}
        >
          {!project.cover_url && (
            <Box sx={{ width: 56, height: 56, border: 1.5, borderColor: "primary.main", opacity: 0.7, transform: "rotate(45deg)" }} />
          )}
        </Box>
        <Box sx={{ p: 2, flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: 17, mb: 0.5 }}>
            {project.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {project.description}
          </Typography>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ color: "text.secondary", fontSize: 12 }}>
            <span>{t("projects.storyCount", { count: project.story_count })}</span>
            <span>{t("projects.wordCount", { words: project.word_count.toLocaleString() })}</span>
            <Chip size="small" variant="outlined" label={t(`projects.visibility.${project.visibility}`)} />
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {t("projects.updatedAt", { date: dateTimeFormat.format(new Date(project.updated_at)) })}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}
