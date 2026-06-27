import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Paper,
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
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type { StorytellerUserProfileRequest } from "@/types/storyteller.ts";

const emptyForm: StorytellerUserProfileRequest = {
  pen_name: "",
  bio: "",
  use_default_avatar: true,
  avatar_url: "",
};

export default function StorytellerProfile() {
  const { session, user, loading, login, submitting } = useAuth();
  const profileQuery = useStorytellerUserProfile();
  const saveProfile = useSaveStorytellerUserProfile();
  const deleteProfile = useDeleteStorytellerUserProfile();
  const [form, setForm] = useState<StorytellerUserProfileRequest>(emptyForm);
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
    });
  }, [profileQuery.data]);

  const hasProfileValue = useMemo(
    () => Boolean(form.pen_name || form.bio || form.avatar_url),
    [form],
  );

  const save = () => {
    saveProfile.mutate(form, {
      onSuccess: () => setMessage("作者設定已儲存"),
    });
  };

  const reset = () => {
    deleteProfile.mutate(undefined, {
      onSuccess: () => {
        setForm(emptyForm);
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
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
          <Stack spacing={2} alignItems="flex-start">
            <Alert severity="info" variant="outlined">
              登入後即可維護 Storyteller 作者資訊。
            </Alert>
            <Button
              variant="contained"
              onClick={() => void login()}
              disabled={submitting}
            >
              {submitting ? "登入中..." : "使用 Google 登入"}
            </Button>
          </Stack>
        </Paper>
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
