import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useDeleteStorytellerAgent } from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import {
  formatStorytellerDate,
} from "@/data/storyteller.ts";
import { storytellerMascotSrc } from "@/helpers/storytellerMascot.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useStorytellerAppearance } from "@/layouts/storytellerAppearanceMode.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerProjectMenuButton } from "@/pages/storyteller/StorytellerProjectMenuButton.tsx";
import { loadStorytellerProjectWorkspace } from "@/pages/storyteller/storytellerRoutePreload.ts";
import type {
  StorytellerAgent,
  StorytellerProject,
} from "@/types/storyteller.ts";

const agentPromptSummaryLength = 120;

function agentPromptPlainTextSummary(prompt: string, emptyLabel: string) {
  // Skill 卡片只顯示 Prompt 摘要，避免 Markdown 或 HTML-like 語法影響列表掃描。
  const plainText = prompt
    .replace(/<[^>]*>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_~>#|\-[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plainText) {
    return emptyLabel;
  }
  const characters = Array.from(plainText);
  return characters.length > agentPromptSummaryLength
    ? `${characters.slice(0, agentPromptSummaryLength).join("")}...`
    : plainText;
}

export function ProjectCards({ projects }: { projects: StorytellerProject[] }) {
  const { t } = useTranslation();
  const { appearance } = useStorytellerAppearance();
  const navigate = useNavigate();

  return (
    <>
      {projects.length === 0 ? (
        <CustomEmptyState
          icon={
            <Box
              component="img"
              alt={t("web.home.cards.mascotAlt")}
              src={storytellerMascotSrc("empty", appearance, "256")}
              sx={{ width: 96, height: 96, objectFit: "contain" }}
            />
          }
          title={t("web.home.cards.noProjects")}
          description={t("web.home.cards.noProjectsDescription")}
        />
      ) : (
        <Grid container spacing={2}>
          {projects.map((project) => (
            <Grid key={project.public_id} size={{ xs: 12, md: 4 }}>
              <StorytellerProjectCard
                project={project}
                onPrefetch={() => void loadStorytellerProjectWorkspace()}
                headerAction={
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={t(`web.visibility.${project.visibility}`)}
                    />
                    {/* 公開狀態／編輯／刪除選單與 SteamLoom Writer 共用 */}
                    <StorytellerProjectMenuButton project={project} />
                  </Stack>
                }
                onClick={() =>
                  navigate(steamloomPath(`my/workspace/${project.public_id}`))
                }
              />
            </Grid>
          ))}
        </Grid>
      )}
    </>
  );
}

export function AgentCards({ agents }: { agents: StorytellerAgent[] }) {
  const { t, i18n } = useTranslation();
  const deleteAgent = useDeleteStorytellerAgent();
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    apiBacked: boolean;
  } | null>(null);
  const rows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    promptSummary: agentPromptPlainTextSummary(agent.default_prompt, t("web.home.cards.noPrompt")),
    enabled: !agent.is_deleted,
    updatedAt: agent.updated_at,
    apiBacked: true,
  }));

  return (
    <>
      {rows.length === 0 ? (
        <CustomEmptyState
          icon={<SmartToyIcon fontSize="large" />}
          title={t("web.home.cards.noSkills")}
          description={t("web.home.cards.noSkillsDescription")}
        />
      ) : (
        <Grid container spacing={2}>
          {rows.map((agent) => (
            <Grid key={agent.id} size={{ xs: 12, md: 4 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 1,
                  height: 1,
                  boxSizing: "border-box",
                  overflow: "hidden",
                }}
              >
                <Stack spacing={1.5} sx={{ height: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <SmartToyIcon
                      color={agent.enabled ? "primary" : "disabled"}
                    />
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {agent.name}
                    </Typography>
                  </Stack>
                  <Typography
                    color="text.secondary"
                    sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {agent.promptSummary}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("web.home.cards.updated", { date: formatStorytellerDate(agent.updatedAt, i18n.resolvedLanguage) })}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      component={RouterLink}
                      to={steamloomPath(`my/agent/${agent.id}/edit`)}
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      disabled={!agent.apiBacked}
                    >
                      {t("web.common.edit")}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      variant="contained"
                      startIcon={<DeleteIcon />}
                      disabled={!agent.apiBacked}
                      onClick={() =>
                        setDeleteTarget({
                          id: Number(agent.id),
                          name: agent.name,
                          apiBacked: agent.apiBacked,
                        })
                      }
                    >
                      {t("web.common.delete")}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
      {deleteTarget && (
        <StorytellerConfirmNameDialog
          open
          title={t("web.home.cards.deleteSkill")}
          description={t("web.home.cards.deleteSkillDescription")}
          confirmName={deleteTarget.name}
          confirmLabel={t("web.home.cards.deleteSkill")}
          loading={deleteAgent.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget.apiBacked) {
              setDeleteTarget(null);
              return;
            }
            deleteAgent.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
              onError: () => setDeleteError(t("web.home.cards.deleteSkillFailed")),
            });
          }}
        />
      )}
      <CustomSnackbar
        open={Boolean(deleteError)}
        message={deleteError}
        severity="error"
        onClose={() => setDeleteError("")}
      />
    </>
  );
}
