import i18n from "i18next";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import {
  Avatar,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useSaveStorytellerUserProfile,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { StorytellerSnsLinksEditor } from "@/components/storyteller/StorytellerSnsLinksEditor.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import {
  hasSnsRowError,
  snsPayloadFromRows,
  snsRowsFromLinks,
  type SNSLinkRow,
} from "@/helpers/storytellerSnsLinks.ts";
import { storytellerUserAvatarSrc } from "@/helpers/storytellerUser.ts";
import { AuthorProfilesPanel } from "@/pages/storyteller/AuthorProfilesPanel.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type { StorytellerUserProfileRequest } from "@/types/storyteller.ts";

const autoSaveIntervalMinutesMin = 2;
const autoSaveIntervalMinutesMax = 60;
const autoSaveIntervalMinutesDefault = 5;

const emptyForm: StorytellerUserProfileRequest = {
  pen_name: "",
  bio: "",
  use_default_avatar: true,
  avatar_url: "",
  sns_links: {},
  hide_favorite_projects: false,
  hide_favorite_authors: false,
  auto_save_enabled: true,
  auto_save_interval_minutes: autoSaveIntervalMinutesDefault,
};

// eslint-disable-next-line no-control-regex -- intentionally blocking raw control characters
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

async function gravatarUrlFromEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `https://www.gravatar.com/avatar/${hash}`;
}

type AvatarOption = "default" | "gravatar" | "custom";

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

// 「我的檔案」的內容——掛在 /my 工作台殼底下（見 Home.tsx），登入狀態已經由
// Home.tsx 統一擋過，這裡不用再自己判斷 session。
export function StorytellerProfileContent() {
  const { t } = useTranslation();
  const { session, user } = useAuth();
  const profileQuery = useStorytellerUserProfile();
  const saveProfile = useSaveStorytellerUserProfile();
  const [form, setForm] = useState<StorytellerUserProfileRequest>(emptyForm);
  const [snsRows, setSnsRows] = useState<SNSLinkRow[]>([]);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"success" | "error">("success");
  const [avatarOption, setAvatarOption] = useState<AvatarOption>("default");
  const [gravatarUrl, setGravatarUrl] = useState("");
  const defaultAvatar = session?.user.photo_url ?? user?.photoURL ?? "";
  const email = session?.user.email ?? "";
  const previewAvatar = storytellerUserAvatarSrc(
    {
      use_default_avatar: avatarOption === "default",
      avatar_url: avatarOption === "gravatar" ? gravatarUrl : form.avatar_url,
    },
    defaultAvatar,
  );
  const displayName =
    form.pen_name || session?.user.display_name || STORYTELLER_APP_NAME;

  useEffect(() => {
    if (!email) {
      setGravatarUrl("");
      return;
    }
    let cancelled = false;
    gravatarUrlFromEmail(email).then((url) => {
      if (!cancelled) {
        setGravatarUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }
    setForm({
      pen_name: profileQuery.data.pen_name ?? "",
      bio: profileQuery.data.bio ?? "",
      use_default_avatar: profileQuery.data.use_default_avatar,
      avatar_url: profileQuery.data.avatar_url ?? "",
      sns_links: profileQuery.data.sns_links ?? {},
      hide_favorite_projects: profileQuery.data.hide_favorite_projects,
      hide_favorite_authors: profileQuery.data.hide_favorite_authors,
      auto_save_enabled: profileQuery.data.auto_save_enabled,
      auto_save_interval_minutes: profileQuery.data.auto_save_interval_minutes,
    });
    if (profileQuery.data.use_default_avatar) {
      setAvatarOption("default");
    } else if (gravatarUrl && profileQuery.data.avatar_url === gravatarUrl) {
      setAvatarOption("gravatar");
    } else {
      setAvatarOption("custom");
    }
    setSnsRows(
      snsRowsFromLinks(
        profileQuery.data.sns_links,
        profileQuery.data.sns_private_keys,
      ),
    );
  }, [profileQuery.data, gravatarUrl]);

  const hasSnsError = hasSnsRowError(snsRows);
  const hasPenNameError = Boolean(penNameError(form.pen_name));
  const hasAutoSaveIntervalError =
    !Number.isInteger(form.auto_save_interval_minutes) ||
    form.auto_save_interval_minutes < autoSaveIntervalMinutesMin ||
    form.auto_save_interval_minutes > autoSaveIntervalMinutesMax;

  const save = () => {
    saveProfile.mutate(
      { ...form, ...snsPayloadFromRows(snsRows) },
      {
        onSuccess: () => {
          setSeverity("success");
          setMessage(t("web.profile.messages.saved"));
        },
        onError: (error) => {
          setSeverity("error");
          setMessage(errorMessage(error, t("web.profile.errors.save")));
        },
      },
    );
  };

  return (
    <>
      {profileQuery.isLoading ? (
        <StorytellerLoading label={t("web.profile.loading")} />
      ) : (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
          <Stack spacing={3}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Avatar
                src={previewAvatar}
                alt={displayName}
                sx={{ width: 64, height: 64 }}
              >
                <PersonIcon />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={800}>
                  {displayName}
                </Typography>
                <Typography color="text.secondary">
                  {t("web.profile.description")}
                </Typography>
              </Box>
            </Stack>
            <Divider />
            <TextField
              label={t("web.onboarding.penName")}
              value={form.pen_name}
              onChange={(event) =>
                setForm((value) => ({ ...value, pen_name: event.target.value }))
              }
              error={Boolean(penNameError(form.pen_name))}
              helperText={
                penNameError(form.pen_name) ?? t("web.profile.penNameHelp")
              }
              fullWidth
            />
            <TextField
              label={t("web.profile.bio")}
              value={form.bio}
              onChange={(event) =>
                setForm((value) => ({ ...value, bio: event.target.value }))
              }
              helperText={t("web.profile.bioHelp")}
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
            />
            <Box>
              <FormControl>
                <FormLabel id="storyteller-avatar-option-label">
                  {t("web.profile.avatar.source")}
                </FormLabel>
                <RadioGroup
                  aria-labelledby="storyteller-avatar-option-label"
                  value={avatarOption}
                  onChange={(event) => {
                    const next = event.target.value as AvatarOption;
                    setAvatarOption(next);
                    setForm((value) => ({
                      ...value,
                      use_default_avatar: next === "default",
                      avatar_url: next === "gravatar" ? gravatarUrl : "",
                    }));
                  }}
                >
                  <FormControlLabel
                    value="gravatar"
                    control={<Radio />}
                    label={t("web.profile.avatar.gravatar")}
                    disabled={!gravatarUrl}
                  />
                  <FormControlLabel
                    value="default"
                    control={<Radio />}
                    label={t("web.profile.avatar.default")}
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio />}
                    label={t("web.profile.avatar.custom")}
                  />
                </RadioGroup>
              </FormControl>
              {avatarOption === "custom" && (
                <TextField
                  label={`${STORYTELLER_APP_NAME} avatar URL`}
                  value={form.avatar_url}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      avatar_url: event.target.value,
                    }))
                  }
                  fullWidth
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {t("web.profile.snsLinks")}
              </Typography>
              <StorytellerSnsLinksEditor rows={snsRows} onChange={setSnsRows} />
            </Box>
            <Divider />
            <AuthorProfilesPanel profiles={profileQuery.data?.profiles ?? []} />
            <Divider />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {t("web.profile.privacy.title")}
              </Typography>
              <Stack>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.hide_favorite_projects}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          hide_favorite_projects: event.target.checked,
                        }))
                      }
                    />
                  }
                  label={t("web.profile.privacy.hideFavoriteWorks")}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.hide_favorite_authors}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          hide_favorite_authors: event.target.checked,
                        }))
                      }
                    />
                  }
                  label={t("web.profile.privacy.hideFavoriteAuthors")}
                />
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                {t("web.profile.editor.title")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t("web.profile.editor.description")}
              </Typography>
              <Stack spacing={1.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.auto_save_enabled}
                      onChange={(event) =>
                        setForm((value) => ({
                          ...value,
                          auto_save_enabled: event.target.checked,
                        }))
                      }
                    />
                  }
                  label={t("web.documentEditor.autoSave.label")}
                />
                <TextField
                  type="number"
                  label={t("web.profile.editor.autoSaveInterval")}
                  size="small"
                  sx={{ width: 220 }}
                  value={form.auto_save_interval_minutes}
                  disabled={!form.auto_save_enabled}
                  error={hasAutoSaveIntervalError}
                  helperText={
                    hasAutoSaveIntervalError
                      ? t("web.profile.editor.intervalRange", {
                          min: autoSaveIntervalMinutesMin,
                          max: autoSaveIntervalMinutesMax,
                        })
                      : t("web.profile.editor.intervalDefault", {
                          minutes: autoSaveIntervalMinutesDefault,
                        })
                  }
                  slotProps={{
                    htmlInput: {
                      min: autoSaveIntervalMinutesMin,
                      max: autoSaveIntervalMinutesMax,
                      step: 1,
                    },
                  }}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      auto_save_interval_minutes:
                        event.target.value === ""
                          ? autoSaveIntervalMinutesDefault
                          : Math.trunc(Number(event.target.value)),
                    }))
                  }
                />
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={
                  saveProfile.isPending ||
                  hasSnsError ||
                  hasPenNameError ||
                  hasAutoSaveIntervalError
                }
                onClick={save}
              >
                {t("web.common.save")}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
      <CustomSnackbar
        open={Boolean(message)}
        message={message}
        severity={severity}
        onClose={() => setMessage("")}
      />
    </>
  );
}
