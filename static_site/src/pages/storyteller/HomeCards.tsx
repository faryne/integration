import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PeopleIcon from "@mui/icons-material/People";
import PublicIcon from "@mui/icons-material/Public";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  useDeleteStorytellerAgent,
  useDeleteStorytellerProject,
  useSaveStorytellerProject,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { storytellerMascotSrc } from "@/helpers/storytellerMascot.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useStorytellerAppearance } from "@/layouts/storytellerAppearanceMode.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { loadStorytellerProjectWorkspace } from "@/pages/storyteller/storytellerRoutePreload.ts";
import type {
  StorytellerAgent,
  StorytellerProject,
} from "@/types/storyteller.ts";

const agentPromptSummaryLength = 120;

function agentPromptPlainTextSummary(prompt: string) {
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
    return "未設定 Prompt 摘要。";
  }
  const characters = Array.from(plainText);
  return characters.length > agentPromptSummaryLength
    ? `${characters.slice(0, agentPromptSummaryLength).join("")}...`
    : plainText;
}

export function ProjectCards({ projects }: { projects: StorytellerProject[] }) {
  const { appearance } = useStorytellerAppearance();
  const navigate = useNavigate();
  const deleteProject = useDeleteStorytellerProject();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [projectMenu, setProjectMenu] = useState<{
    anchorEl: HTMLElement;
    project: StorytellerProject;
  } | null>(null);
  const saveProject = useSaveStorytellerProject();

  function handleVisibilityChange(
    project: StorytellerProject,
    visibility: StorytellerProject["visibility"] | null,
  ) {
    if (!visibility || visibility === project.visibility) {
      return;
    }
    saveProject.mutate({
      publicId: project.public_id,
      input: {
        name: project.name,
        slug: project.slug,
        description: project.description,
        visibility,
        rating: project.rating,
        content_type: project.content_type,
        tags: project.tags ?? [],
      },
    });
  }

  const visibilityLabel = {
    private: "私密",
    unlisted: "分享",
    public: "公開",
  } satisfies Record<StorytellerProject["visibility"], string>;

  return (
    <>
      {deleteProject.isError && (
        <Alert severity="error" variant="outlined" sx={{ mb: 2 }}>
          刪除專案失敗，請確認登入狀態後再試一次。
        </Alert>
      )}
      {projects.length === 0 ? (
        <CustomEmptyState
          icon={
            <Box
              component="img"
              alt="梭梭"
              src={storytellerMascotSrc("empty", appearance, "256")}
              sx={{ width: 96, height: 96, objectFit: "contain" }}
            />
          }
          title="目前還沒有創作專案"
          description="可以使用上方的「建立專案」開始建立第一個創作專案。"
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
                      label={visibilityLabel[project.visibility]}
                    />
                    <IconButton
                      aria-label={`${project.name}專案操作`}
                      onClick={(event) =>
                        setProjectMenu({
                          anchorEl: event.currentTarget,
                          project,
                        })
                      }
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
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
      <Menu
        anchorEl={projectMenu?.anchorEl ?? null}
        open={Boolean(projectMenu)}
        onClose={() => setProjectMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 210 } } }}
      >
        <MenuItem
          selected={projectMenu?.project.visibility === "private"}
          disabled={saveProject.isPending}
          onClick={() => {
            if (projectMenu)
              handleVisibilityChange(projectMenu.project, "private");
            setProjectMenu(null);
          }}
        >
          <ListItemIcon>
            <LockIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>設為私密</ListItemText>
        </MenuItem>
        <MenuItem
          selected={projectMenu?.project.visibility === "unlisted"}
          disabled={saveProject.isPending}
          onClick={() => {
            if (projectMenu)
              handleVisibilityChange(projectMenu.project, "unlisted");
            setProjectMenu(null);
          }}
        >
          <ListItemIcon>
            <PeopleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>設為分享</ListItemText>
        </MenuItem>
        <MenuItem
          selected={projectMenu?.project.visibility === "public"}
          disabled={saveProject.isPending}
          onClick={() => {
            if (projectMenu)
              handleVisibilityChange(projectMenu.project, "public");
            setProjectMenu(null);
          }}
        >
          <ListItemIcon>
            <PublicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>設為公開</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          component={RouterLink}
          to={
            projectMenu
              ? steamloomPath(
                  `my/workspace/${projectMenu.project.public_id}/edit`,
                )
              : "#"
          }
          onClick={() => setProjectMenu(null)}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>編輯專案</ListItemText>
        </MenuItem>
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            if (projectMenu) {
              setDeleteTarget({
                id: projectMenu.project.public_id,
                name: projectMenu.project.name,
              });
            }
            setProjectMenu(null);
          }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>刪除專案</ListItemText>
        </MenuItem>
      </Menu>
      {deleteTarget && (
        <StorytellerConfirmNameDialog
          open
          title="刪除專案"
          description="刪除後會移除專案與底下故事資料。請輸入專案名稱確認。"
          confirmName={deleteTarget.name}
          confirmLabel="刪除專案"
          loading={deleteProject.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            deleteProject.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      )}
    </>
  );
}

export function AgentCards({ agents }: { agents: StorytellerAgent[] }) {
  const deleteAgent = useDeleteStorytellerAgent();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    apiBacked: boolean;
  } | null>(null);
  const rows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    promptSummary: agentPromptPlainTextSummary(agent.default_prompt),
    enabled: !agent.is_deleted,
    updatedAt: agent.updated_at,
    apiBacked: true,
  }));

  return (
    <>
      {rows.length === 0 ? (
        <CustomEmptyState
          icon={<SmartToyIcon fontSize="large" />}
          title="目前還沒有 Skill"
          description="可以使用上方的「建立 Skill」新增可在故事編輯器中使用的 Skill。"
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
                    更新於 {formatStorytellerDate(agent.updatedAt)}
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
                      編輯
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
                      刪除
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
          title="刪除 Skill"
          description="刪除後此 Skill 將無法在故事編輯器中使用。請輸入 Skill 名稱確認。"
          confirmName={deleteTarget.name}
          confirmLabel="刪除 Skill"
          loading={deleteAgent.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (!deleteTarget.apiBacked) {
              setDeleteTarget(null);
              return;
            }
            deleteAgent.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }}
        />
      )}
    </>
  );
}
