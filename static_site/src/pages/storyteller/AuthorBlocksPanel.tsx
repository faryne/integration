import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import PersonIcon from "@mui/icons-material/Person";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Fragment, useState } from "react";
import {
  useAuthorBlocks,
  useDeleteAuthorBlock,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import type { AuthorBlock } from "@/types/storytellerTimeline.ts";

// 工作台「封鎖名單」：封鎖以身份為單位（本人、各筆名分開），在動態留言旁按「封鎖」就會加進來。
// 被封鎖的人不能在這個身份的動態（以及之後的討論區）留言或回覆，但還是能閱讀與按讚。
export function StorytellerAuthorBlocksPanel() {
  const profile = useStorytellerUserProfile();
  // 空字串＝本人身份；其餘是筆名
  const [as, setAs] = useState("");
  const blocks = useAuthorBlocks(as);
  const unblock = useDeleteAuthorBlock();
  const [target, setTarget] = useState<AuthorBlock | null>(null);
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const identities = [
    {
      value: "",
      label: profile.data?.pen_name ? `本人 ${profile.data.pen_name}` : "本人",
    },
    ...(profile.data?.profiles ?? []).map((p) => ({
      value: p.pen_name,
      label: `筆名 ${p.pen_name}`,
    })),
  ];
  const identityName = as || profile.data?.pen_name || "本人";

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          封鎖名單
        </Typography>
      </Box>
      {identities.length > 1 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {identities.map((identity) => (
            <Chip
              key={identity.value || "self"}
              label={identity.label}
              color={identity.value === as ? "primary" : "default"}
              variant={identity.value === as ? "filled" : "outlined"}
              onClick={() => setAs(identity.value)}
            />
          ))}
        </Stack>
      )}
      {blocks.isLoading ? (
        <StorytellerLoading label="正在載入封鎖名單..." />
      ) : (blocks.data ?? []).length === 0 ? (
        <CustomEmptyState
          icon={<BlockOutlinedIcon fontSize="large" />}
          title={`${identityName} 沒有封鎖任何人`}
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
          {(blocks.data ?? []).map((block, index) => (
            <Fragment key={block.public_id}>
              {index > 0 && <Divider />}
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ px: 2, py: 1.5 }}
              >
                <Avatar
                  src={block.blocked.avatar_url}
                  alt={block.blocked.pen_name}
                >
                  <PersonIcon />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>
                    {block.blocked.pen_name}
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    {new Date(block.created_at).toLocaleDateString("zh-TW")}{" "}
                    封鎖
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => setTarget(block)}>
                  解除封鎖
                </Button>
              </Stack>
            </Fragment>
          ))}
        </Paper>
      )}
      <StorytellerMascotDialog
        open={Boolean(target)}
        state="neutral"
        eyebrow="解除封鎖"
        title={`解除封鎖 ${target?.blocked.pen_name ?? ""}？`}
        description={`對方之後就可以在 ${identityName} 的動態留言了。`}
        onClose={() => setTarget(null)}
        actions={
          <>
            <Button onClick={() => setTarget(null)}>取消</Button>
            <Button
              variant="contained"
              disabled={unblock.isPending}
              onClick={() =>
                target &&
                unblock.mutate(target.public_id, {
                  onSuccess: () => {
                    setSnack({
                      message: `已解除封鎖 ${target.blocked.pen_name}`,
                      severity: "success",
                    });
                    setTarget(null);
                  },
                  onError: (error) =>
                    setSnack({
                      message: apiErrorMessage(error, "解除封鎖失敗，請重試。"),
                      severity: "error",
                    }),
                })
              }
            >
              解除封鎖
            </Button>
          </>
        }
      />
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
    </Stack>
  );
}
