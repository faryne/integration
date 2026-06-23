import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useSaveStorytellerProject,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerProjectRequest } from "@/types/storyteller.ts";

export default function StorytellerNewProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const saveProject = useSaveStorytellerProject();
  const { data: projects = [], isLoading } = useStorytellerProjects();
  const editingProject = id
    ? projects.find((project) => project.public_id === id)
    : undefined;
  const isEditing = Boolean(id);
  const [input, setInput] = useState<StorytellerProjectRequest>({
    name: "",
    slug: "",
    description: "",
    visibility: "private",
  });

  useEffect(() => {
    if (editingProject) {
      setInput({
        name: editingProject.name,
        slug: editingProject.slug,
        description: editingProject.description,
        visibility: editingProject.visibility,
      });
    }
  }, [editingProject]);

  useTitle(isEditing ? "編輯 Storyteller 專案" : "建立 Storyteller 專案", {
    path: isEditing && id ? `/storyteller/project/${id}/edit` : "/storyteller/project/new",
    robots: "noindex, nofollow",
  });

  if (isEditing && isLoading) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (isEditing && !editingProject) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title={isEditing ? "編輯專案" : "建立專案"}
      description={
        isEditing ? "調整故事企劃的基本資訊與閱讀狀態。" : "填寫故事企劃的基本資訊。"
      }
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "專案列表", to: "/storyteller/project" },
        ...(editingProject
          ? [
              {
                label: editingProject.name,
                to: `/storyteller/project/${editingProject.public_id}`,
              },
            ]
          : []),
        { label: isEditing ? "編輯專案" : "建立專案" },
      ]}
    >
      <Paper
        component="form"
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}
        onSubmit={(event) => {
          event.preventDefault();
          saveProject.mutate(
            { publicId: editingProject?.public_id, input },
            {
              onSuccess: (project) => {
                if (project?.public_id) {
                  navigate(`/storyteller/project/${project.public_id}`);
                }
              },
            },
          );
        }}
      >
        <Stack spacing={3}>
          {saveProject.isError && (
            <Alert severity="error" variant="outlined">
              {isEditing ? "更新專案失敗" : "建立專案失敗"}，請確認登入狀態與欄位內容。
            </Alert>
          )}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label="專案名稱"
                placeholder="例如：河燈之城"
                helperText="不可與既有專案重複。"
                value={input.name}
                onChange={(event) =>
                  setInput((value) => ({ ...value, name: event.target.value }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="專案特殊網址"
                placeholder="例如：river-lantern"
                helperText="可留空由系統產生；限中英數，不得使用符號。"
                value={input.slug}
                onChange={(event) =>
                  setInput((value) => ({ ...value, slug: event.target.value }))
                }
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={5}
                label="專案描述"
                placeholder="記錄故事類型、核心題材、世界觀與目前預計的寫作方向。"
                value={input.description}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    description: event.target.value,
                  }))
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="閱讀狀態"
                value={input.visibility}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    visibility: event.target
                      .value as StorytellerProjectRequest["visibility"],
                  }))
                }
              >
                <MenuItem value="private">完全不公開</MenuItem>
                <MenuItem value="unlisted">與親友分享</MenuItem>
                <MenuItem value="public">已公開</MenuItem>
              </TextField>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button href="/storyteller/project" variant="text">
              返回列表
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saveProject.isPending}
            >
              {saveProject.isPending
                ? isEditing
                  ? "更新中"
                  : "建立中"
                : isEditing
                  ? "更新專案"
                  : "建立專案"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </StorytellerShell>
  );
}
