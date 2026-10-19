import i18n from "i18next";
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
import { useTranslation } from "react-i18next";
import {
  useCreateStorytellerAuthorProfile,
  useDeleteStorytellerAuthorProfile,
  useStorytellerAccountLimits,
  useUpdateStorytellerAuthorProfile,
} from "@/apis/storyteller.ts";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { StorytellerSnsLinksEditor } from "@/components/storyteller/StorytellerSnsLinksEditor.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  hasSnsRowError,
  snsPayloadFromRows,
  snsRowsFromLinks,
  type SNSLinkRow,
} from "@/helpers/storytellerSnsLinks.ts";
import type {
  StorytellerAuthorProfile,
  StorytellerAuthorProfileRequest,
} from "@/types/storyteller.ts";

// eslint-disable-next-line no-control-regex -- 與本人筆名同一套限制，筆名會進 /user/:username
const INVALID_PEN_NAME_CHARS = /[/\\?#%\x00-\x1F]/;

function penNameError(penName: string): string | undefined {
  const trimmed = penName.trim();
  // 非元件 helper，取全域 i18next
  if (!trimmed) return i18n.t("web.profile.errors.penNameEmpty");
  if (INVALID_PEN_NAME_CHARS.test(trimmed)) {
    return i18n.t("web.profile.errors.penNameInvalid");
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
  const { t } = useTranslation();
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
  const [snsRows, setSnsRows] = useState<SNSLinkRow[]>([]);
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
    setSnsRows(snsRowsFromLinks(profile.sns_links, profile.sns_private_keys));
    setDialogOpen(true);
  }

  function save() {
    const payload = { ...form, ...snsPayloadFromRows(snsRows) };
    const onError = (error: unknown) => {
      setSeverity("error");
      setMessage(errorMessage(error, t("web.profile.extra.errors.save")));
    };
    if (editing) {
      updateProfile.mutate(
        { profileId: editing.id, input: payload },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setSeverity("success");
            setMessage(t("web.profile.extra.messages.updated"));
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
        setMessage(t("web.profile.extra.messages.created"));
      },
      onError,
    });
  }

  const saving = createProfile.isPending || updateProfile.isPending;
  const nameError = penNameError(form.pen_name);

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
        {t("web.profile.extra.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t("web.profile.extra.description")}
      </Typography>
      {atLimit && accountLimits && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t("web.profile.extra.limitReached", {
            max: accountLimits.max_profiles,
          })}
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
              aria-label={t("web.profile.extra.editNamed", {
                name: profile.pen_name,
              })}
              onClick={() => openEdit(profile)}
            >
              <EditIcon />
            </IconButton>
            <IconButton
              aria-label={t("web.profile.extra.deleteNamed", {
                name: profile.pen_name,
              })}
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
          {t("web.profile.extra.add")}
        </Button>
      </Stack>
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing ? t("web.profile.extra.edit") : t("web.profile.extra.add")}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t("web.onboarding.penName")}
              value={form.pen_name}
              onChange={(event) =>
                setForm((value) => ({ ...value, pen_name: event.target.value }))
              }
              error={Boolean(nameError)}
              helperText={nameError ?? t("web.profile.extra.penNameHelp")}
              fullWidth
            />
            <TextField
              label={t("web.profile.bio")}
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
              helperText={t("web.profile.extra.avatarHelp")}
              fullWidth
            />
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t("web.profile.snsLinks")}
              </Typography>
              <StorytellerSnsLinksEditor
                rows={snsRows}
                onChange={setSnsRows}
                compact
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            {t("web.common.cancel")}
          </Button>
          <Button
            variant="contained"
            disabled={saving || Boolean(nameError) || hasSnsRowError(snsRows)}
            onClick={save}
          >
            {saving ? t("web.assetManager.saving") : t("web.common.save")}
          </Button>
        </DialogActions>
      </Dialog>
      <StorytellerConfirmNameDialog
        open={Boolean(deleteTarget)}
        title={t("web.profile.extra.delete")}
        description={
          deleteTarget?.post_count
            ? t("web.profile.extra.deleteDescriptionWithPosts", {
                count: deleteTarget.post_count,
              })
            : t("web.profile.extra.deleteDescription")
        }
        confirmName={deleteTarget?.pen_name ?? ""}
        confirmLabel={t("web.profile.extra.delete")}
        loading={deleteProfile.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProfile.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null);
              setSeverity("success");
              setMessage(t("web.profile.extra.messages.deleted"));
            },
            onError: (error) => {
              setSeverity("error");
              setMessage(
                errorMessage(error, t("web.profile.extra.errors.delete")),
              );
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
