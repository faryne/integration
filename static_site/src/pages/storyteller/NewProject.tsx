import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
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
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerProjectRequest } from "@/types/storyteller.ts";

function projectNameToSlug(name: string) {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}._~-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function tagTextToList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,，\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

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
    rating: "general",
    tags: [],
  });
  const [tagText, setTagText] = useState("");

  useEffect(() => {
    if (editingProject) {
      setInput({
        name: editingProject.name,
        slug: editingProject.slug,
        description: editingProject.description,
        visibility: editingProject.visibility,
        rating: editingProject.rating,
        tags: editingProject.tags ?? [],
      });
      setTagText((editingProject.tags ?? []).join(", "));
    }
  }, [editingProject]);

  useTitle(isEditing ? "編輯 Storyteller 專案" : "建立 Storyteller 專案", {
    path:
      isEditing && id
        ? `/storyteller/my/project/${id}/edit`
        : "/storyteller/my/project/new",
    robots: "noindex, nofollow",
  });

  if (isEditing && isLoading) {
    return <StorytellerLoading label="正在載入專案資料..." />;
  }

  if (isEditing && !editingProject) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title={isEditing ? "編輯專案" : "建立專案"}
      description={
        isEditing
          ? "調整故事企劃的基本資訊與閱讀狀態。"
          : "填寫故事企劃的基本資訊。"
      }
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "故事專案", to: "/storyteller/my/project" },
        ...(editingProject
          ? [
              {
                label: editingProject.name,
                to: `/storyteller/my/project/${editingProject.public_id}`,
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
          const payload = {
            ...input,
            tags: tagTextToList(tagText),
            slug: editingProject?.slug ?? projectNameToSlug(input.name),
          };
          saveProject.mutate(
            { publicId: editingProject?.public_id, input: payload },
            {
              onSuccess: (project) => {
                if (project?.public_id) {
                  navigate(`/storyteller/my/project/${project.public_id}`);
                }
              },
            },
          );
        }}
      >
        <Stack spacing={3}>
          {saveProject.isError && (
            <Alert severity="error" variant="outlined">
              {isEditing ? "更新專案失敗" : "建立專案失敗"}
              ，請確認登入狀態與欄位內容。
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
                disabled
                label="專案網址"
                helperText="專案網址建立時會使用專案名稱，建立後暫不開放修改。"
                value={editingProject?.slug ?? projectNameToSlug(input.name)}
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
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label="分級"
                value={input.rating}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    rating: event.target
                      .value as StorytellerProjectRequest["rating"],
                  }))
                }
                helperText="限制級公開頁會要求讀者進行年齡確認。"
              >
                <MenuItem value="general">普通級</MenuItem>
                <MenuItem value="guidance">輔導級</MenuItem>
                <MenuItem value="restricted">限制級</MenuItem>
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                label="標籤"
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                helperText="使用逗號分隔，最多 12 個，每個最多 24 字。"
                placeholder="奇幻, 長篇, 群像"
              />
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button href="/storyteller/my/project" variant="text">
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
