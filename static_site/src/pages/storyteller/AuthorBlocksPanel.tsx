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
import { useTranslation } from "react-i18next";
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
  const { t, i18n } = useTranslation();
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
      label: profile.data?.pen_name
        ? t("web.profile.blocks.self", { name: profile.data.pen_name })
        : t("web.documentEditor.selfOnly"),
    },
    ...(profile.data?.profiles ?? []).map((p) => ({
      value: p.pen_name,
      label: t("web.profile.blocks.penName", { name: p.pen_name }),
    })),
  ];
  const identityName =
    as || profile.data?.pen_name || t("web.documentEditor.selfOnly");

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h5" fontWeight={800}>
          {t("web.profile.blocks.title")}
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
        <StorytellerLoading label={t("web.profile.blocks.loading")} />
      ) : (blocks.data ?? []).length === 0 ? (
        <CustomEmptyState
          icon={<BlockOutlinedIcon fontSize="large" />}
          title={t("web.profile.blocks.empty", { name: identityName })}
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
                    {t("web.profile.blocks.blockedOn", {
                      date: new Date(block.created_at).toLocaleDateString(
                        i18n.resolvedLanguage,
                      ),
                    })}
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={() => setTarget(block)}>
                  {t("web.profile.blocks.unblock")}
                </Button>
              </Stack>
            </Fragment>
          ))}
        </Paper>
      )}
      <StorytellerMascotDialog
        open={Boolean(target)}
        state="neutral"
        eyebrow={t("web.profile.blocks.unblock")}
        title={t("web.profile.blocks.confirmTitle", {
          name: target?.blocked.pen_name ?? "",
        })}
        description={t("web.profile.blocks.confirmDescription", {
          name: identityName,
        })}
        onClose={() => setTarget(null)}
        actions={
          <>
            <Button onClick={() => setTarget(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              variant="contained"
              disabled={unblock.isPending}
              onClick={() =>
                target &&
                unblock.mutate(target.public_id, {
                  onSuccess: () => {
                    setSnack({
                      message: t("web.profile.blocks.unblocked", {
                        name: target.blocked.pen_name,
                      }),
                      severity: "success",
                    });
                    setTarget(null);
                  },
                  onError: (error) =>
                    setSnack({
                      message: apiErrorMessage(
                        error,
                        t("web.profile.blocks.errors.unblock"),
                      ),
                      severity: "error",
                    }),
                })
              }
            >
              {t("web.profile.blocks.unblock")}
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
