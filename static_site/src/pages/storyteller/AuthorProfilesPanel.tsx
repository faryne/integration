import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  useCreateStorytellerAuthorProfile,
  useDeleteStorytellerAuthorProfile,
  useStorytellerAccountLimits,
  useUpdateStorytellerAuthorProfile,
} from "@/apis/storyteller.ts";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type {
  StorytellerAuthorProfile,
  StorytellerAuthorProfileRequest,
} from "@/types/storyteller.ts";

// eslint-disable-next-line no-control-regex -- 與本人筆名同一套限制，筆名會進 /user/:username
const INVALID_PEN_NAME_CHARS = /[/\\?#%\x00-\x1F]/;

function penNameError(penName: string): string | undefined {
  const trimmed = penName.trim();
  if (!trimmed) return "筆名不能是空白";
  if (INVALID_PEN_NAME_CHARS.test(trimmed)) {
    return "筆名不能包含 / \\ ? # % 或控制字元";
  }
  return undefined;
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

const emptyForm: StorytellerAuthorProfileRequest = {
  pen_name: "",
  bio: "",
  use_default_avatar: true,
  avatar_url: "",
  sns_links: {},
};

export function AuthorProfilesPanel({
  profiles,
}: {
  profiles: StorytellerAuthorProfile[];
}) {
  const { data: accountLimits } = useStorytellerAccountLimits();
  const createProfile = useCreateStorytellerAuthorProfile();
  const updateProfile = useUpdateStorytellerAuthorProfile();
  const deleteProfile = useDeleteStorytellerAuthorProfile();
  const atLimit = Boolean(
    accountLimits &&
      accountLimits.current_profiles >= accountLimits.max_profiles,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StorytellerAuthorProfile | null>(null);
  const [form, setForm] = useState<StorytellerAuthorProfileRequest>(emptyForm);
  const [snsRows, setSnsRows] = useState<Array<{ id: string; key: string; url: string }>>(
    [],
  );
  const [deleteTarget, setDeleteTarget] =
    useState<StorytellerAuthorProfile | null>(null);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"success" | "error">("success");

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setSnsRows([]);
    setDialogOpen(true);
  }

  function openEdit(profile: StorytellerAuthorProfile) {
    setEditing(profile);
    setForm({
      pen_name: profile.pen_name,
      bio: profile.bio ?? "",
      use_default_avatar: profile.use_default_avatar,
      avatar_url: profile.avatar_url ?? "",
      sns_links: profile.sns_links ?? {},
    });
    setSnsRows(
      Object.entries(profile.sns_links ?? {}).map(([key, url], index) => ({
        id: `${index}-${key}`,
        key,
        url,
      })),
    );
    setDialogOpen(true);
  }

  function save() {
    const snsLinks: Record<string, string> = {};
    for (const row of snsRows) {
      const key = row.key.trim();
      const url = row.url.trim();
      if (key && url) snsLinks[key] = url;
    }
    const payload = { ...form, sns_links: snsLinks };
    const onError = (error: unknown) => {
      setSeverity("error");
      setMessage(errorMessage(error, "筆名儲存失敗，請確認欄位內容。"));
    };
    if (editing) {
      updateProfile.mutate(
        { profileId: editing.id, input: payload },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setSeverity("success");
            setMessage("額外筆名已更新");
          },
          onError,
        },
      );
      return;
    }
    createProfile.mutate(payload, {
      onSuccess: () => {
        setDialogOpen(false);
        setSeverity("success");
        setMessage("額外筆名已建立");
      },
      onError,
    });
  }

  const saving = createProfile.isPending || updateProfile.isPending;
  const nameError = penNameError(form.pen_name);

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
        額外筆名
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        可指定給個別故事作為署名。沒有建立時，故事一律使用上面的本人筆名。
      </Typography>
      {atLimit && accountLimits && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          已達可建立的額外筆名數量上限（{accountLimits.max_profiles}{" "}
          個），請刪除後再建立新的。
        </Alert>
      )}
      <Stack spacing={1.5}>
        {profiles.map((profile) => (
          <Stack
            key={profile.id}
            direction="row"
            spacing={1.5}
            alignItems="center"
          >
            <Avatar src={profile.avatar_url} alt={profile.pen_name}>
              <PersonIcon />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
                {profile.pen_name}
              </Typography>
              {profile.bio && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ overflowWrap: "anywhere" }}
                >
                  {profile.bio}
                </Typography>
              )}
            </Box>
            <IconButton
              aria-label={`編輯筆名 ${profile.pen_name}`}
              onClick={() => openEdit(profile)}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              aria-label={`刪除筆名 ${profile.pen_name}`}
              onClick={() => setDeleteTarget(profile)}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Stack>
        ))}
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={atLimit}
          onClick={openCreate}
          sx={{ alignSelf: "flex-start" }}
        >
          新增筆名
        </Button>
      </Stack>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{editing ? "編輯筆名" : "新增筆名"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="筆名"
              value={form.pen_name}
              onChange={(event) =>
                setForm((value) => ({ ...value, pen_name: event.target.value }))
              }
              error={Boolean(nameError)}
              helperText={
                nameError ?? "會顯示在公開作者頁網址上，全站不可與其他筆名重複。"
              }
              fullWidth
            />
            <TextField
              label="自我介紹"
              value={form.bio}
              onChange={(event) =>
                setForm((value) => ({ ...value, bio: event.target.value }))
              }
              fullWidth
              multiline
              minRows={3}
            />
            <TextField
              label="Avatar URL"
              value={form.avatar_url}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  use_default_avatar: event.target.value.trim() === "",
                  avatar_url: event.target.value,
                }))
              }
              helperText="留空時使用依筆名產生的 identicon。"
              fullWidth
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                SNS 連結
              </Typography>
              <Stack spacing={1}>
                {snsRows.map((row) => (
                  <Stack key={row.id} direction="row" spacing={1}>
                    <TextField
                      label="類型"
                      value={row.key}
                      onChange={(event) =>
                        setSnsRows((rows) =>
                          rows.map((item) =>
                            item.id === row.id
                              ? { ...item, key: event.target.value }
                              : item,
                          ),
                        )
                      }
                      sx={{ width: 140 }}
                    />
                    <TextField
                      label="網址"
                      value={row.url}
                      onChange={(event) =>
                        setSnsRows((rows) =>
                          rows.map((item) =>
                            item.id === row.id
                              ? { ...item, url: event.target.value }
                              : item,
                          ),
                        )
                      }
                      fullWidth
                    />
                  </Stack>
                ))}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    setSnsRows((rows) => [
                      ...rows,
                      { id: `new-${Date.now()}`, key: "x", url: "" },
                    ])
                  }
                  sx={{ alignSelf: "flex-start" }}
                >
                  新增一列
                </Button>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            disabled={saving || Boolean(nameError)}
            onClick={save}
          >
            {saving ? "儲存中" : "儲存"}
          </Button>
        </DialogActions>
      </Dialog>
      <StorytellerConfirmNameDialog
        open={Boolean(deleteTarget)}
        title="刪除筆名"
        description="刪除後無法復原。若仍有故事署名此筆名，後端會拒絕刪除。"
        confirmName={deleteTarget?.pen_name ?? ""}
        confirmLabel="刪除筆名"
        loading={deleteProfile.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProfile.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null);
              setSeverity("success");
              setMessage("額外筆名已刪除");
            },
            onError: (error) => {
              setSeverity("error");
              setMessage(errorMessage(error, "刪除筆名失敗。"));
            },
          });
        }}
      />
      <CustomSnackbar
        open={Boolean(message)}
        message={message}
        severity={severity}
        onClose={() => setMessage("")}
      />
    </Box>
  );
}
