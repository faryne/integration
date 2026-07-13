import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
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
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import {
  useSaveStorytellerUserProfile,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
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

const SNS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "x", label: "X（Twitter）" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "website", label: "個人網站" },
  { value: "plurk", label: "Plurk" },
  { value: "bahamut", label: "巴哈姆特" },
  { value: "discord", label: "Discord" },
  { value: "youtube", label: "YouTube" },
];

const CUSTOM_SNS_TYPE = "__custom__";
const KNOWN_SNS_TYPES = new Set(SNS_TYPE_OPTIONS.map((option) => option.value));

const SNS_DOMAIN_HINTS: Record<string, string[]> = {
  x: ["x.com", "twitter.com"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  threads: ["threads.net", "threads.com"],
  plurk: ["plurk.com"],
  bahamut: ["gamer.com.tw"],
  discord: ["discord.com", "discord.gg"],
  youtube: ["youtube.com", "youtu.be"],
};

function snsUrlError(type: string, url: string): string | undefined {
  if (!url.trim()) return undefined;
  const domains = SNS_DOMAIN_HINTS[type];
  if (!domains) return undefined;
  const lower = url.toLowerCase();
  if (domains.some((domain) => lower.includes(domain))) return undefined;
  return `網址需包含 ${domains.join(" 或 ")}`;
}

// eslint-disable-next-line no-control-regex -- intentionally blocking raw control characters
const INVALID_PEN_NAME_CHARS = /[/\\?#%\x00-\x1F]/;

function penNameError(penName: string): string | undefined {
  const trimmed = penName.trim();
  if (!trimmed) return "筆名不能是空白";
  if (INVALID_PEN_NAME_CHARS.test(trimmed)) {
    return "筆名不能包含 / \\ ? # % 或控制字元";
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

interface SNSLinkRow {
  id: string;
  type: string;
  customLabel: string;
  url: string;
}

function rowsFromSNSLinks(
  links: Record<string, string> | undefined,
): SNSLinkRow[] {
  return Object.entries(links ?? {}).map(([key, url], index) => ({
    id: `${index}-${key}`,
    type: KNOWN_SNS_TYPES.has(key) ? key : CUSTOM_SNS_TYPE,
    customLabel: KNOWN_SNS_TYPES.has(key) ? "" : key,
    url,
  }));
}

function snsLinksFromRows(rows: SNSLinkRow[]): Record<string, string> {
  const links: Record<string, string> = {};
  for (const row of rows) {
    const key =
      row.type === CUSTOM_SNS_TYPE ? row.customLabel.trim() : row.type;
    const url = row.url.trim();
    if (!key || !url) continue;
    links[key] = url;
  }
  return links;
}

export default function StorytellerProfile() {
  const { session, user, loading, login, submitting } = useAuth();
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
  const previewAvatar =
    avatarOption === "default"
      ? defaultAvatar
      : avatarOption === "gravatar"
        ? gravatarUrl
        : form.avatar_url;
  const displayName =
    form.pen_name || session?.user.display_name || STORYTELLER_APP_NAME;

  useTitle(`${STORYTELLER_APP_NAME} 作者設定`, {
    path: steamloomPath("profile"),
    robots: "noindex, nofollow",
  });

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
    setSnsRows(rowsFromSNSLinks(profileQuery.data.sns_links));
  }, [profileQuery.data, gravatarUrl]);

  const addSnsRow = () => {
    setSnsRows((rows) => [
      ...rows,
      { id: `new-${Date.now()}`, type: "x", customLabel: "", url: "" },
    ]);
  };

  const updateSnsRow = (id: string, changes: Partial<SNSLinkRow>) => {
    setSnsRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    );
  };

  const removeSnsRow = (id: string) => {
    setSnsRows((rows) => rows.filter((row) => row.id !== id));
  };

  const hasSnsError = snsRows.some((row) =>
    Boolean(snsUrlError(row.type, row.url)),
  );
  const hasPenNameError = Boolean(penNameError(form.pen_name));
  const hasAutoSaveIntervalError =
    !Number.isInteger(form.auto_save_interval_minutes) ||
    form.auto_save_interval_minutes < autoSaveIntervalMinutesMin ||
    form.auto_save_interval_minutes > autoSaveIntervalMinutesMax;

  const save = () => {
    saveProfile.mutate(
      { ...form, sns_links: snsLinksFromRows(snsRows) },
      {
        onSuccess: () => {
          setSeverity("success");
          setMessage("作者設定已儲存");
        },
        onError: (error) => {
          setSeverity("error");
          setMessage(errorMessage(error, "作者設定儲存失敗，請確認欄位內容。"));
        },
      },
    );
  };

  return (
    <StorytellerShell
      title="作者設定"
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: "作者設定" },
      ]}
    >
      {loading ? (
        <StorytellerLoading label="正在確認登入狀態..." />
      ) : !session ? (
        <CustomLoginRequiredState
          description={`登入後即可維護 ${STORYTELLER_APP_NAME} 作者資訊。`}
          onLogin={() => void login()}
          submitting={submitting}
        />
      ) : profileQuery.isLoading ? (
        <StorytellerLoading label="正在載入作者設定..." />
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
                  這些資料會用在公開故事閱讀頁的作者資訊。
                </Typography>
              </Box>
            </Stack>
            <Divider />
            <TextField
              label="筆名"
              value={form.pen_name}
              onChange={(event) =>
                setForm((value) => ({ ...value, pen_name: event.target.value }))
              }
              error={Boolean(penNameError(form.pen_name))}
              helperText={
                penNameError(form.pen_name) ??
                "會顯示在公開作者頁網址上，不能包含 / \\ ? # % 等符號。"
              }
              fullWidth
            />
            <TextField
              label="自我介紹"
              value={form.bio}
              onChange={(event) =>
                setForm((value) => ({ ...value, bio: event.target.value }))
              }
              helperText="支援 Markdown 語法，會顯示在公開作者頁。"
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
            />
            <Box>
              <FormControl>
                <FormLabel id="storyteller-avatar-option-label">
                  Avatar 來源
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
                    label="使用 Gravatar"
                    disabled={!gravatarUrl}
                  />
                  <FormControlLabel
                    value="default"
                    control={<Radio />}
                    label="使用登入帳號的 avatar"
                  />
                  <FormControlLabel
                    value="custom"
                    control={<Radio />}
                    label="自己填入網址"
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
                SNS 連結
              </Typography>
              <Stack spacing={1.5}>
                {snsRows.map((row) => (
                  <Stack
                    key={row.id}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <FormControl sx={{ minWidth: { sm: 160 } }}>
                      <InputLabel>類型</InputLabel>
                      <Select
                        label="類型"
                        value={row.type}
                        onChange={(event) =>
                          updateSnsRow(row.id, { type: event.target.value })
                        }
                      >
                        {SNS_TYPE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                        <MenuItem value={CUSTOM_SNS_TYPE}>自訂類型</MenuItem>
                      </Select>
                    </FormControl>
                    {row.type === CUSTOM_SNS_TYPE && (
                      <TextField
                        label="自訂類型名稱"
                        value={row.customLabel}
                        onChange={(event) =>
                          updateSnsRow(row.id, {
                            customLabel: event.target.value,
                          })
                        }
                        sx={{ minWidth: { sm: 160 } }}
                      />
                    )}
                    <TextField
                      label="網址"
                      value={row.url}
                      onChange={(event) =>
                        updateSnsRow(row.id, { url: event.target.value })
                      }
                      error={Boolean(snsUrlError(row.type, row.url))}
                      helperText={snsUrlError(row.type, row.url)}
                      fullWidth
                    />
                    <IconButton
                      aria-label="刪除這個 SNS 連結"
                      onClick={() => removeSnsRow(row.id)}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={addSnsRow}
                  sx={{ alignSelf: "flex-start" }}
                >
                  新增一列
                </Button>
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                隱私設定
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
                  label="隱藏我收藏的作品"
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
                  label="隱藏我收藏的作家"
                />
              </Stack>
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
                編輯器設定
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                這裡是故事與設定集編輯頁的預設值，開啟編輯頁時仍可依當次需要另外調整。
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
                  label="自動存檔"
                />
                <TextField
                  type="number"
                  label="自動存檔頻率（分鐘）"
                  size="small"
                  sx={{ width: 220 }}
                  value={form.auto_save_interval_minutes}
                  disabled={!form.auto_save_enabled}
                  error={hasAutoSaveIntervalError}
                  helperText={
                    hasAutoSaveIntervalError
                      ? `請輸入 ${autoSaveIntervalMinutesMin} 到 ${autoSaveIntervalMinutesMax} 之間的整數`
                      : `未填寫預設為 ${autoSaveIntervalMinutesDefault} 分鐘`
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
                儲存
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
    </StorytellerShell>
  );
}
