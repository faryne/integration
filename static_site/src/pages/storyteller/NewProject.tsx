import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState, type FormEvent } from "react";
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

const maxTagCount = 12;
const maxTagLength = 24;

function normalizeTags(tags: string[]) {
  return Array.from(
    new Set(
      tags
        .flatMap((tag) => tag.split(/[,，]/))
        .map((tag) => tag.trim().slice(0, maxTagLength))
        .filter(Boolean),
    ),
  ).slice(0, maxTagCount);
}

function errorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    return data.message || fallback;
  }
  return fallback;
}

export default function StorytellerNewProject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const saveProject = useSaveStorytellerProject();
  const {
    data: projects = [],
    isLoading,
    isFetching,
  } = useStorytellerProjects();
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
  const [tagInputValue, setTagInputValue] = useState("");
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(
    null,
  );
  const [slugWarningOpen, setSlugWarningOpen] = useState(false);

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
    }
  }, [editingProject]);

  useTitle(isEditing ? "編輯 Storyteller 專案" : "建立 Storyteller 專案", {
    path:
      isEditing && id
        ? `/storyteller/my/project/${id}/edit`
        : "/storyteller/my/project/new",
    robots: "noindex, nofollow",
  });

  if (isEditing && !editingProject && (isLoading || isFetching)) {
    return (
      <StorytellerShell
        title="編輯專案"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
        ]}
      >
        <StorytellerLoading label="正在載入專案資料..." />
      </StorytellerShell>
    );
  }

  if (isEditing && !editingProject) {
    return <ErrorPage code={404} />;
  }

  function handleStartFirstStory() {
    if (createdProjectId) {
      navigate(`/storyteller/my/project/${createdProjectId}/story/new`);
    }
    setCreatedProjectId(null);
  }

  function handleGoToProjectHome() {
    if (createdProjectId) {
      navigate(`/storyteller/my/project/${createdProjectId}`);
    }
    setCreatedProjectId(null);
  }

  function performSave() {
    const pendingTag = tagInputValue.trim();
    const payload = {
      ...input,
      tags: normalizeTags(
        pendingTag ? [...input.tags, pendingTag] : input.tags,
      ),
      slug: isEditing ? input.slug : projectNameToSlug(input.name),
    };
    saveProject.mutate(
      { publicId: editingProject?.public_id, input: payload },
      {
        onSuccess: (project) => {
          if (!project?.public_id) {
            return;
          }
          if (isEditing) {
            navigate(`/storyteller/my/project/${project.public_id}`);
            return;
          }
          setCreatedProjectId(project.public_id);
        },
      },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const slugChanged =
      isEditing &&
      Boolean(editingProject) &&
      input.slug.trim() !== editingProject?.slug;
    const visibilityAffectsSlug =
      input.visibility === "public" || input.visibility === "unlisted";
    if (slugChanged && visibilityAffectsSlug) {
      setSlugWarningOpen(true);
      return;
    }
    performSave();
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  let urlPreview: string | null = null;
  if (isEditing && editingProject) {
    if (input.visibility === "public") {
      urlPreview = `${origin}/storyteller/story/${editingProject.public_id}-${input.slug.trim()}`;
    } else if (input.visibility === "unlisted") {
      urlPreview =
        editingProject.visibility === "unlisted" && editingProject.share_token
          ? `${origin}/storyteller/story/share/${editingProject.share_token}`
          : "儲存後系統會建立新的分享網址，可到專案頁面查看。";
    }
  } else if (!isEditing) {
    if (input.visibility === "public") {
      urlPreview = `建立後網址大致會是：${origin}/storyteller/story/（系統代碼）-${projectNameToSlug(input.name)}`;
    } else if (input.visibility === "unlisted") {
      urlPreview = "建立後系統會自動產生一組專屬的分享網址。";
    }
  }

  return (
    <StorytellerShell
      title={isEditing ? "編輯專案" : "建立專案"}
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
      <Dialog open={Boolean(createdProjectId)} maxWidth="xs" fullWidth>
        <DialogTitle>專案建立成功</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            《{input.name}》已建立完成。要現在建立第一篇故事，還是先回專案首頁？
          </Typography>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: "column",
            alignItems: "stretch",
            gap: 1,
            px: 3,
            pb: 2,
          }}
        >
          <Button variant="contained" onClick={handleStartFirstStory}>
            建立第一篇故事
          </Button>
          <Button onClick={handleGoToProjectHome}>回專案首頁</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={slugWarningOpen}
        onClose={() => setSlugWarningOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>變更專案網址</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            網址已變更，公開頁面顯示與分享的網址會立即更新為新網址（舊網址原則上仍可正常開啟，但可能不會馬上被外部平台或搜尋引擎更新）。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlugWarningOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={() => {
              setSlugWarningOpen(false);
              performSave();
            }}
          >
            確認變更
          </Button>
        </DialogActions>
      </Dialog>
      <Paper
        component="form"
        variant="outlined"
        sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}
        onSubmit={handleSubmit}
      >
        <Stack spacing={3}>
          {saveProject.isError && (
            <Alert severity="error" variant="outlined">
              {errorMessage(
                saveProject.error,
                `${isEditing ? "更新專案失敗" : "建立專案失敗"}，請確認登入狀態與欄位內容。`,
              )}
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
                disabled={!isEditing}
                required={isEditing}
                label="專案網址"
                helperText={
                  isEditing
                    ? "變更後，公開頁面顯示與分享用的網址會跟著改變。"
                    : "預設使用專案名稱產生，建立後可以修改。"
                }
                value={
                  isEditing ? input.slug : projectNameToSlug(input.name)
                }
                onChange={
                  isEditing
                    ? (event) =>
                        setInput((value) => ({
                          ...value,
                          slug: event.target.value,
                        }))
                    : undefined
                }
              />
              {urlPreview && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5, overflowWrap: "anywhere" }}
                >
                  {urlPreview}
                </Typography>
              )}
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={5}
                maxRows={12}
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
              <Autocomplete
                multiple
                freeSolo
                fullWidth
                options={[]}
                value={input.tags}
                inputValue={tagInputValue}
                onInputChange={(_, newInputValue, reason) => {
                  if (reason === "input" && /[,，]/.test(newInputValue)) {
                    const segments = newInputValue.split(/[,，]/);
                    const remainder = segments.pop() ?? "";
                    setInput((value) => ({
                      ...value,
                      tags: normalizeTags([...value.tags, ...segments]),
                    }));
                    setTagInputValue(remainder.trimStart());
                    return;
                  }
                  setTagInputValue(newInputValue);
                }}
                onChange={(_, newValue) => {
                  setInput((value) => ({
                    ...value,
                    tags: normalizeTags(newValue),
                  }));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      size="small"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="標籤"
                    helperText={`輸入後按 Enter，或用「,」「，」分隔新增多個，最多 ${maxTagCount} 個，每個最多 ${maxTagLength} 字。`}
                    placeholder={
                      input.tags.length === 0 ? "奇幻, 長篇, 群像" : ""
                    }
                  />
                )}
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
