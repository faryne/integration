import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import {
  Avatar,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  useDeleteStorytellerUserProfile,
  useSaveStorytellerUserProfile,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { useTitle } from "@/helpers/title.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type { StorytellerUserProfileRequest } from "@/types/storyteller.ts";

const emptyForm: StorytellerUserProfileRequest = {
  pen_name: "",
  bio: "",
  use_default_avatar: true,
  avatar_url: "",
  sns_links: {},
  hide_favorite_projects: false,
  hide_favorite_authors: false,
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

interface SNSLinkRow {
  id: string;
  type: string;
  customLabel: string;
  url: string;
}

function rowsFromSNSLinks(links: Record<string, string> | undefined): SNSLinkRow[] {
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
  const deleteProfile = useDeleteStorytellerUserProfile();
  const [form, setForm] = useState<StorytellerUserProfileRequest>(emptyForm);
  const [snsRows, setSnsRows] = useState<SNSLinkRow[]>([]);
  const [message, setMessage] = useState("");
  const defaultAvatar = session?.user.photo_url ?? user?.photoURL ?? "";
  const previewAvatar = form.use_default_avatar
    ? defaultAvatar
    : form.avatar_url;
  const displayName =
    form.pen_name || session?.user.display_name || "Storyteller";

  useTitle("Storyteller 作者設定", {
    path: "/storyteller/profile",
    robots: "noindex, nofollow",
  });

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
    });
    setSnsRows(rowsFromSNSLinks(profileQuery.data.sns_links));
  }, [profileQuery.data]);

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

  const hasProfileValue = useMemo(
    () => Boolean(form.pen_name || form.bio || form.avatar_url),
    [form],
  );

  const save = () => {
    saveProfile.mutate(
      { ...form, sns_links: snsLinksFromRows(snsRows) },
      { onSuccess: () => setMessage("作者設定已儲存") },
    );
  };

  const reset = () => {
    deleteProfile.mutate(undefined, {
      onSuccess: () => {
        setForm(emptyForm);
        setSnsRows([]);
        setMessage("作者設定已清除");
      },
    });
  };

  return (
    <StorytellerShell
      title="作者設定"
      description="設定在 Storyteller 公開閱讀頁顯示的作者資訊。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "作者設定" },
      ]}
    >
      {loading ? (
        <StorytellerLoading label="正在確認登入狀態..." />
      ) : !session ? (
        <CustomLoginRequiredState
          description="登入後即可維護 Storyteller 作者資訊。"
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
              minRows={4}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.use_default_avatar}
                  onChange={(event) =>
                    setForm((value) => ({
                      ...value,
                      use_default_avatar: event.target.checked,
                      avatar_url: event.target.checked ? "" : value.avatar_url,
                    }))
                  }
                />
              }
              label="使用登入帳號的 avatar"
            />
            <TextField
              label="Storyteller avatar URL"
              value={form.avatar_url}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  avatar_url: event.target.value,
                }))
              }
              disabled={form.use_default_avatar}
              fullWidth
            />
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={saveProfile.isPending}
                onClick={save}
              >
                儲存
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                disabled={deleteProfile.isPending || !hasProfileValue}
                onClick={reset}
              >
                清除設定
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
      <CustomSnackbar
        open={Boolean(message)}
        message={message}
        onClose={() => setMessage("")}
      />
    </StorytellerShell>
  );
}
