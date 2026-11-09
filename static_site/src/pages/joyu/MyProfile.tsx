import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { useJoyuProfile, useSetNickname } from "@/apis/av/joyu_comments.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { useTitle } from "@/helpers/title.tsx";

const cardSx = {
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
  maxWidth: 560,
  p: 2,
} as const;

/**
 * joyu 個人資料（/me/profile）：登入方式、討論版暱稱（只有 Google 帳號能改，匿名帳號固定「訪客-xxxx」）、刪除帳號。
 * 刪帳號時追蹤與片單刪除，討論版留言保留並改顯示「已刪除的帳號」
 */
export function JoyuMyProfile() {
  useTitle("個人資料");
  const navigate = useNavigate();
  const { user, loading, loginWithGoogle, deleteAccount } = useJoyuAuth();
  const profile = useJoyuProfile(user?.uid);
  const setNickname = useSetNickname(user?.uid);
  const [nickname, setNicknameInput] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  useEffect(() => {
    if (profile.data) setNicknameInput(profile.data.nickname);
  }, [profile.data]);

  const save = async () => {
    try {
      await setNickname.mutateAsync(nickname);
      setMessage({ text: "暱稱已更新", ok: true });
    } catch (err) {
      setMessage({ text: apiErrorMessage(err, "暱稱更新失敗"), ok: false });
    }
  };
  const doDelete = async () => {
    setConfirmDelete(false);
    try {
      await deleteAccount();
      navigate(joyuPath(""));
    } catch {
      setMessage({ text: "刪除帳號失敗，請稍後再試", ok: false });
    }
  };
  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      setMessage({ text: apiErrorMessage(err, "登入失敗"), ok: false });
    }
  };

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={2} sx={{ textAlign: "left" }}>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
          個人資料
        </Typography>

        {!loading && !user ? (
          <Box sx={cardSx}>
            <Button onClick={() => void login()} variant="contained">
              用 Google 登入
            </Button>
          </Box>
        ) : (
          <>
            <Stack spacing={2} sx={cardSx}>
              <Box>
                <Typography color="text.secondary" sx={{ fontSize: 12 }}>
                  登入方式
                </Typography>
                {user?.isAnonymous ? (
                  <Stack
                    direction="row"
                    gap={1}
                    sx={{ alignItems: "center", mt: 0.5 }}
                  >
                    <Typography>匿名</Typography>
                    <Button
                      onClick={() => void login()}
                      size="small"
                      variant="outlined"
                    >
                      用 Google 登入
                    </Button>
                  </Stack>
                ) : (
                  <Typography>Google・{user?.email}</Typography>
                )}
              </Box>
              <Box>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 12, mb: 0.5 }}
                >
                  討論版顯示的名字
                </Typography>
                {profile.data?.can_edit ? (
                  <Stack direction="row" gap={1}>
                    <TextField
                      fullWidth
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder={profile.data.display_name}
                      size="small"
                      slotProps={{ htmlInput: { maxLength: 20 } }}
                      value={nickname}
                    />
                    <Button
                      disabled={
                        setNickname.isPending ||
                        nickname === profile.data.nickname
                      }
                      onClick={() => void save()}
                      variant="contained"
                    >
                      儲存
                    </Button>
                  </Stack>
                ) : (
                  <Typography>{profile.data?.display_name}</Typography>
                )}
              </Box>
            </Stack>

            <Stack
              direction="row"
              sx={{
                ...cardSx,
                alignItems: "center",
                borderColor: "error.light",
                gap: 2,
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700 }}>刪除帳號</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                  刪除所有追蹤、片單與帳號，無法復原
                </Typography>
              </Box>
              <Button
                color="error"
                onClick={() => setConfirmDelete(true)}
                variant="outlined"
              >
                刪除帳號
              </Button>
            </Stack>
          </>
        )}
      </Stack>

      <Dialog onClose={() => setConfirmDelete(false)} open={confirmDelete}>
        <DialogTitle>刪除帳號？</DialogTitle>
        <DialogContent>
          所有追蹤、片單和這個帳號都會被刪除，無法復原；討論版的留言會保留，名字改顯示「已刪除的帳號」。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>取消</Button>
          <Button
            color="error"
            onClick={() => void doDelete()}
            variant="contained"
          >
            刪除
          </Button>
        </DialogActions>
      </Dialog>
      <CustomSnackbar
        message={message?.text ?? ""}
        onClose={() => setMessage(undefined)}
        open={!!message}
        severity={message?.ok ? "success" : "error"}
      />
    </AgeConfirmationGate>
  );
}
