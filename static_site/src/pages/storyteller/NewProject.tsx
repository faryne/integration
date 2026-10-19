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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useSaveStorytellerProject,
  useStorytellerAccountLimits,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  STORYTELLER_APP_NAME,
  storytellerReaderPath,
} from "@/data/storyteller.ts";
import {
  STEAMLOOM_PATH_PREFIX,
  steamloomPath,
  steamloomUrlForOrigin,
} from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerProjectCoverEditor } from "@/pages/storyteller/StorytellerProjectCoverEditor.tsx";
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

export interface StorytellerNewProjectProps {
  embedded?: boolean;
  // 以下給不走網站路由的宿主（SteamLoom Writer）用；都沒傳時維持網站原本的網址導向。
  // projectId 取代網址參數 id（有值＝編輯模式）。
  projectId?: string;
  // 公開網址預覽用的網站 origin；Writer 不在 steamloom.works 底下，window.location.origin 不對。
  publicOrigin?: string;
  // 建立成功對話框的兩個按鈕：next 為 "story"（建立第一篇故事）或 "home"（回專案首頁）。
  onCreated?: (projectId: string, next: "story" | "home") => void;
  // 編輯儲存成功、提示訊息關閉後呼叫。
  onSaved?: (projectId: string) => void;
  // 「返回列表」按鈕；沒傳時連回網站的我的專案。
  onCancel?: () => void;
}

export default function StorytellerNewProject({
  embedded = false,
  projectId,
  publicOrigin,
  onCreated,
  onSaved,
  onCancel,
}: StorytellerNewProjectProps = {}) {
  const { t } = useTranslation();
  const { id: routeId } = useParams();
  const id = projectId ?? routeId;
  const navigate = useNavigate();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const saveProject = useSaveStorytellerProject();
  const {
    data: projects = [],
    isLoading,
    isFetching,
  } = useStorytellerProjects();
  const { data: accountLimits } = useStorytellerAccountLimits();
  const editingProject = id
    ? projects.find((project) => project.public_id === id)
    : undefined;
  const isEditing = Boolean(id);
  // 只有「建立」會被專案數量上限擋，編輯既有專案不受影響。
  const atProjectLimit = Boolean(
    !isEditing &&
    accountLimits &&
    accountLimits.current_projects >= accountLimits.max_projects,
  );
  const [input, setInput] = useState<StorytellerProjectRequest>({
    name: "",
    slug: "",
    description: "",
    visibility: "private",
    rating: "general",
    tags: [],
    // 建立當下還沒有封面可預覽，不帶 cover_layout／cover_focal_point；編輯既有專案時
    // 由下面的 useEffect 帶入目前設定。
  });
  const [tagInputValue, setTagInputValue] = useState("");
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [slugWarningOpen, setSlugWarningOpen] = useState(false);
  const [editSuccessTarget, setEditSuccessTarget] = useState<string | null>(
    null,
  );
  const [coverAssetPublicId, setCoverAssetPublicId] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverSnack, setCoverSnack] = useState<{
    message: string;
    severity: "success" | "error";
  }>({ message: "", severity: "success" });
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (editingProject) {
      setInput({
        name: editingProject.name,
        slug: editingProject.slug,
        description: editingProject.description,
        visibility: editingProject.visibility,
        rating: editingProject.rating,
        tags: editingProject.tags ?? [],
        cover_layout: editingProject.cover_layout,
        cover_focal_point: editingProject.cover_focal_point,
      });
      setCoverAssetPublicId(editingProject.cover_asset_public_id ?? "");
      setCoverPreviewUrl(editingProject.cover_url ?? "");
    }
  }, [editingProject]);

  useTitle(
    isEditing
      ? `${t("writer.projectForm.edit")} ${STORYTELLER_APP_NAME}`
      : `${t("writer.projectForm.create")} ${STORYTELLER_APP_NAME}`,
    {
      path:
        isEditing && id
          ? steamloomPath(`my/workspace/${id}/edit`)
          : steamloomPath("my/projects/new"),
      robots: "noindex, nofollow",
    },
  );

  const newProjectShellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: t("writer.projectForm.workspace"), to: steamloomPath("my") },
    { label: t("writer.projectForm.projects"), to: steamloomPath("my/projects") },
  ];

  // embedded（帳號工作台）模式下不重複套用一層 StorytellerShell 的頂欄跟麵包屑——
  // Home.tsx 外面已經有 WorkspaceChrome＋側邊欄提供同樣的定位資訊，這裡只需要
  // plain 顯示內容本身。
  function renderFrame(
    title: string,
    breadcrumbs: typeof newProjectShellBreadcrumbs,
    children: ReactNode,
  ) {
    return (
      <StorytellerShell
        title={title}
        breadcrumbs={embedded ? [] : breadcrumbs}
        plain={embedded}
        hideHeading={embedded}
      >
        {children}
      </StorytellerShell>
    );
  }

  if (authLoading) {
    return renderFrame(
      t(isEditing ? "writer.projectForm.edit" : "writer.projectForm.create"),
      newProjectShellBreadcrumbs,
      <Stack alignItems="center" sx={{ py: 8 }}>
        <Typography color="text.secondary">{t("writer.projectForm.checkingAuth")}</Typography>
      </Stack>,
    );
  }

  if (!session) {
    return renderFrame(
      t(isEditing ? "writer.projectForm.edit" : "writer.projectForm.create"),
      newProjectShellBreadcrumbs,
      <CustomLoginRequiredState
        description={
          t(isEditing ? "writer.projectForm.loginEdit" : "writer.projectForm.loginCreate")
        }
        onLogin={() => void login()}
        submitting={submitting}
      />,
    );
  }

  if (isEditing && !editingProject && (isLoading || isFetching)) {
    return renderFrame(
      t("writer.projectForm.edit"),
      newProjectShellBreadcrumbs,
      <StorytellerLoading label={t("writer.projectForm.loading")} />,
    );
  }

  if (isEditing && !editingProject) {
    return (
      <ErrorPage
        code={404}
        compact={embedded}
        backUrl={embedded ? steamloomPath("my/projects") : undefined}
      />
    );
  }

  function handleStartFirstStory() {
    if (createdProjectId && onCreated) {
      onCreated(createdProjectId, "story");
    } else if (createdProjectId) {
      navigate(
        steamloomPath(
          embedded
            ? `my/workspace/${createdProjectId}/story/new`
            : `my/project/${createdProjectId}/story/new`,
        ),
      );
    }
    setCreatedProjectId(null);
  }

  function handleGoToProjectHome() {
    if (createdProjectId && onCreated) {
      onCreated(createdProjectId, "home");
    } else if (createdProjectId) {
      navigate(
        steamloomPath(
          embedded
            ? `my/workspace/${createdProjectId}`
            : `my/project/${createdProjectId}`,
        ),
      );
    }
    setCreatedProjectId(null);
  }

  function performSave() {
    const pendingTag = tagInputValue.trim();
    const payload: StorytellerProjectRequest = {
      ...input,
      tags: normalizeTags(
        pendingTag ? [...input.tags, pendingTag] : input.tags,
      ),
      slug: isEditing ? input.slug : projectNameToSlug(input.name),
    };
    if (isEditing) {
      payload.cover_asset_public_id = coverAssetPublicId;
    }
    saveProject.mutate(
      { publicId: editingProject?.public_id, input: payload },
      {
        onSuccess: (project) => {
          if (!project?.public_id) {
            return;
          }
          if (isEditing) {
            // 宿主自己處理存完去哪時，暫存專案 ID，提示訊息關閉後交給 onSaved
            setEditSuccessTarget(
              onSaved
                ? project.public_id
                : steamloomPath(
                    embedded
                      ? `my/workspace/${project.public_id}`
                      : `my/project/${project.public_id}`,
                  ),
            );
            return;
          }
          setCreatedProjectId(project.public_id);
        },
      },
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (atProjectLimit) {
      return;
    }
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

  // sitePath 是 steamloomPath／storytellerReaderPath 的結果。網站直接接在目前網域後；
  // 有 publicOrigin（Writer）時，steamloomPath 會因為不在網站網域而多帶 /storyteller，先拿掉再依該 origin 重組。
  function publicUrl(sitePath: string) {
    if (!publicOrigin) {
      return `${typeof window !== "undefined" ? window.location.origin : ""}${sitePath}`;
    }
    const relative = sitePath.startsWith(STEAMLOOM_PATH_PREFIX)
      ? sitePath.slice(STEAMLOOM_PATH_PREFIX.length)
      : sitePath;
    return steamloomUrlForOrigin(publicOrigin, relative);
  }
  let urlPreview: string | null = null;
  if (isEditing && editingProject) {
    if (input.visibility === "public") {
      const readerPath = storytellerReaderPath({
        ...editingProject,
        slug: input.slug.trim(),
      });
      urlPreview = publicUrl(readerPath);
    } else if (input.visibility === "unlisted") {
      urlPreview =
        editingProject.visibility === "unlisted" && editingProject.share_token
          ? publicUrl(steamloomPath(`work/share/${editingProject.share_token}`))
          : t("writer.projectForm.shareAfterSave");
    }
  } else if (!isEditing) {
    if (input.visibility === "public") {
      urlPreview = t("writer.projectForm.publicUrlPreview", { url: publicUrl(steamloomPath(`work/system-${projectNameToSlug(input.name)}`)) });
    } else if (input.visibility === "unlisted") {
      urlPreview = t("writer.projectForm.shareAfterCreate");
    }
  }

  return (
    <StorytellerShell
      title={t(isEditing ? "writer.projectForm.edit" : "writer.projectForm.create")}
      breadcrumbs={
        embedded
          ? []
          : [
              { label: STORYTELLER_APP_NAME, to: steamloomPath() },
              { label: t("writer.projectForm.workspace"), to: steamloomPath("my") },
              { label: t("writer.projectForm.projects"), to: steamloomPath("my/projects") },
              ...(editingProject
                ? [
                    {
                      label: editingProject.name,
                      to: steamloomPath(
                        `my/project/${editingProject.public_id}`,
                      ),
                    },
                  ]
                : []),
              { label: t(isEditing ? "writer.projectForm.edit" : "writer.projectForm.create") },
            ]
      }
      plain={embedded}
      hideHeading={embedded}
    >
      <StorytellerMascotDialog
        open={Boolean(createdProjectId)}
        state="success"
        eyebrow={t("writer.projectForm.created")}
        title={t("writer.projectForm.ready", { name: input.name })}
        description={t("writer.projectForm.readyDescription")}
        onClose={handleGoToProjectHome}
        actions={
          <>
            <Button onClick={handleGoToProjectHome}>{t("writer.projectForm.goHome")}</Button>
            <Button
              autoFocus
              variant="contained"
              onClick={handleStartFirstStory}
            >
              {t("writer.projectForm.firstStory")}
            </Button>
          </>
        }
      >
        <Paper
          sx={{
            display: "grid",
            gap: 0.5,
            p: 2,
            bgcolor: "action.hover",
            borderLeft: 3,
            borderColor: "success.main",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {t("writer.projectForm.newProject")}
          </Typography>
          <Typography fontWeight={800}>{input.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t(`writer.projectForm.visibilitySummary.${input.visibility}`)}
            {" · "}
            {t(`writer.projectForm.ratingOptions.${input.rating}`)}
          </Typography>
        </Paper>
      </StorytellerMascotDialog>
      <Dialog
        open={slugWarningOpen}
        onClose={() => setSlugWarningOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t("writer.projectForm.slugDialogTitle")}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {t("writer.projectForm.slugDialogDescription")}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlugWarningOpen(false)}>{t("writer.common.cancel")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              setSlugWarningOpen(false);
              performSave();
            }}
          >
            {t("writer.projectForm.confirmChange")}
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
          {atProjectLimit && accountLimits && (
            <Alert severity="warning">
              {t("writer.projectForm.limit", { count: accountLimits.max_projects })}
            </Alert>
          )}
          {saveProject.isError && (
            <Alert severity="error" variant="outlined">
              {errorMessage(
                saveProject.error,
                t("writer.projectForm.saveFailed", { action: t(isEditing ? "writer.projectForm.updateAction" : "writer.projectForm.createAction") }),
              )}
            </Alert>
          )}
          <Tabs
            value={activeTab}
            onChange={(_, value: number) => setActiveTab(value)}
          >
            <Tab label={t("writer.projectForm.tabs.main")} />
            <Tab label={t("writer.projectForm.tabs.cover")} />
          </Tabs>
          <Grid
            container
            spacing={2}
            sx={{ display: activeTab === 0 ? "flex" : "none" }}
          >
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                required
                fullWidth
                label={t("writer.projectForm.name")}
                placeholder={t("writer.projectForm.namePlaceholder")}
                helperText={t("writer.projectForm.nameHelp")}
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
                label={t("writer.projectForm.slug")}
                helperText={
                  isEditing
                    ? t("writer.projectForm.slugEditHelp")
                    : t("writer.projectForm.slugCreateHelp")
                }
                value={isEditing ? input.slug : projectNameToSlug(input.name)}
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
                label={t("writer.projectForm.description")}
                placeholder={t("writer.projectForm.descriptionPlaceholder")}
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
                label={t("writer.projectForm.visibility")}
                value={input.visibility}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    visibility: event.target
                      .value as StorytellerProjectRequest["visibility"],
                  }))
                }
              >
                <MenuItem value="private">{t("writer.projectForm.visibilityOptions.private")}</MenuItem>
                <MenuItem value="unlisted">{t("writer.projectForm.visibilityOptions.unlisted")}</MenuItem>
                <MenuItem value="public">{t("writer.projectForm.visibilityOptions.public")}</MenuItem>
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                select
                label={t("writer.projectForm.rating")}
                value={input.rating}
                onChange={(event) =>
                  setInput((value) => ({
                    ...value,
                    rating: event.target
                      .value as StorytellerProjectRequest["rating"],
                  }))
                }
                helperText={t("writer.projectForm.ratingHelp")}
              >
                <MenuItem value="general">{t("writer.projectForm.ratingOptions.general")}</MenuItem>
                <MenuItem value="guidance">{t("writer.projectForm.ratingOptions.guidance")}</MenuItem>
                <MenuItem value="restricted">{t("writer.projectForm.ratingOptions.restricted")}</MenuItem>
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
                    label={t("writer.projectForm.tags")}
                    helperText={t("writer.projectForm.tagsHelp", { count: maxTagCount, length: maxTagLength })}
                    placeholder={
                      input.tags.length === 0 ? t("writer.projectForm.tagsPlaceholder") : ""
                    }
                  />
                )}
              />
            </Grid>
          </Grid>
          <Grid
            container
            spacing={2}
            sx={{ display: activeTab === 1 ? "flex" : "none" }}
          >
            {isEditing && editingProject ? (
              <Grid size={12}>
                <StorytellerProjectCoverEditor
                  projectPublicId={editingProject.public_id}
                  coverAssetPublicId={coverAssetPublicId}
                  coverUrl={coverPreviewUrl}
                  coverLayout={input.cover_layout ?? "split"}
                  coverFocalPoint={
                    input.cover_focal_point ?? { x: 0.5, y: 0.32 }
                  }
                  onChange={(publicId, previewUrl) => {
                    setCoverAssetPublicId(publicId);
                    setCoverPreviewUrl(previewUrl);
                  }}
                  onLayoutChange={(coverLayout) =>
                    setInput((value) => ({
                      ...value,
                      cover_layout: coverLayout,
                    }))
                  }
                  onFocalPointChange={(coverFocalPoint) =>
                    setInput((value) => ({
                      ...value,
                      cover_focal_point: coverFocalPoint,
                    }))
                  }
                  onNotify={(message, severity) =>
                    setCoverSnack({ message, severity })
                  }
                />
              </Grid>
            ) : (
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary">
                  {t("writer.projectForm.coverAfterCreate")}
                </Typography>
              </Grid>
            )}
          </Grid>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {onCancel ? (
              <Button onClick={onCancel} variant="text">
                {t("writer.projectForm.back")}
              </Button>
            ) : (
              <Button href={steamloomPath("my/projects")} variant="text">
                {t("writer.projectForm.back")}
              </Button>
            )}
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saveProject.isPending || atProjectLimit}
            >
              {saveProject.isPending
                ? isEditing
                  ? t("writer.projectForm.updating")
                  : t("writer.projectForm.creating")
                : isEditing
                  ? t("writer.projectForm.edit")
                  : t("writer.projectForm.create")}
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <CustomSnackbar
        open={Boolean(coverSnack.message)}
        message={coverSnack.message}
        severity={coverSnack.severity}
        onClose={() => setCoverSnack((prev) => ({ ...prev, message: "" }))}
      />
      <CustomSnackbar
        open={Boolean(editSuccessTarget)}
        message={t("writer.projectForm.updated")}
        severity="success"
        autoHideDuration={1200}
        onClose={() => {
          if (editSuccessTarget && onSaved) {
            onSaved(editSuccessTarget);
          } else if (editSuccessTarget) {
            navigate(editSuccessTarget);
          }
          setEditSuccessTarget(null);
        }}
      />
      <CustomSnackbar
        open={saveProject.isError}
        message={t("writer.projectForm.retryFailed", { action: t(isEditing ? "writer.projectForm.updateAction" : "writer.projectForm.createAction") })}
        severity="error"
        onClose={() => saveProject.reset()}
      />
    </StorytellerShell>
  );
}
