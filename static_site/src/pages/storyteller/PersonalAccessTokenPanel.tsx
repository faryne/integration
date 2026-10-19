import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import KeyIcon from "@mui/icons-material/Key";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  useCreateStorytellerPersonalAccessToken,
  useDeleteStorytellerPersonalAccessToken,
  useStorytellerPersonalAccessTokens,
} from "@/apis/storyteller.ts";
import { CopyableCode } from "@/pages/storyteller/developerShared.tsx";
import { useClipboardCopy } from "@/pages/storyteller/useClipboardCopy.tsx";
import {
  mcpJsonConfigSnippet,
  mcpEndpoint,
  personalAccessTokenExpiryDays,
  personalAccessTokenExpiryOptions,
} from "@/pages/storyteller/mcpClientSetup.ts";
import type {
  StorytellerPersonalAccessToken,
  StorytellerPersonalAccessTokenCreated,
} from "@/types/storyteller.ts";

// 「開發者 › Personal Access Token」分頁：給 Codex CLI 這類要在設定檔寫 token 的本機工具。
// 只輸出內容本體，外層標題／麵包屑交給 Home.tsx 的 WorkspaceChrome。
export function StorytellerPersonalAccessTokenPanel() {
  const { t } = useTranslation();
  const { data: tokens = [], isLoading } = useStorytellerPersonalAccessTokens();
  const createToken = useCreateStorytellerPersonalAccessToken();
  const deleteToken = useDeleteStorytellerPersonalAccessToken();
  const { copy, snackbars } = useClipboardCopy();
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [createdToken, setCreatedToken] =
    useState<StorytellerPersonalAccessTokenCreated | null>(null);
  const configSnippet = createdToken
    ? mcpJsonConfigSnippet(mcpEndpoint, createdToken.token)
    : "";

  return (
    <Stack spacing={3}>
      <Alert
        severity="info"
        variant="outlined"
        action={
          <Button
            component={RouterLink}
            to={steamloomPath("my/mcp")}
            color="inherit"
            size="small"
          >
            {t("web.developer.viewConnectGuide")}
          </Button>
        }
      >
        {t("web.developer.pat.webServicesHint")}
      </Alert>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault();
            createToken.mutate(
              {
                label,
                expires_in_days: personalAccessTokenExpiryDays(expiresInDays),
              },
              {
                onSuccess: (created) => {
                  if (created) {
                    setCreatedToken(created);
                  }
                  setLabel("");
                  setExpiresInDays("30");
                },
              },
            );
          }}
        >
          <Box>
            <Typography variant="h6">
              {t("web.developer.pat.createTitle")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("web.developer.pat.createDescription")}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <TextField
                required
                fullWidth
                label={t("web.developer.pat.name")}
                placeholder={t("web.developer.pat.namePlaceholder")}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                select
                label={t("web.developer.pat.expiry")}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
              >
                {personalAccessTokenExpiryOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {t(option.label, { count: option.days })}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid
              size={{ xs: 12, md: 3 }}
              sx={{ display: "flex", alignItems: "center" }}
            >
              <Button
                type="submit"
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                disabled={createToken.isPending || !label.trim()}
              >
                {createToken.isPending
                  ? t("web.developer.pat.creating")
                  : t("web.common.create")}
              </Button>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack sx={{ p: { xs: 2, md: 3 } }} spacing={1}>
          <Typography variant="h6">
            {t("web.developer.pat.listTitle")}
          </Typography>
          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : tokens.length === 0 ? (
            <Alert severity="info" variant="outlined">
              {t("web.developer.pat.empty")}
            </Alert>
          ) : (
            <List disablePadding>
              {tokens.map((token, index) => (
                <Stack key={token.id}>
                  {index > 0 && <Divider component="li" />}
                  <PersonalAccessTokenRow
                    token={token}
                    onDelete={() => deleteToken.mutate(token.id)}
                    deletePending={deleteToken.isPending}
                  />
                </Stack>
              ))}
            </List>
          )}
        </Stack>
      </Paper>

      <StorytellerMascotDialog
        open={createdToken !== null}
        state="success"
        eyebrow="Personal Access Token"
        title={t("web.developer.pat.created")}
        onClose={() => setCreatedToken(null)}
        actions={
          <Button variant="contained" onClick={() => setCreatedToken(null)}>
            {t("web.developer.pat.copiedClose")}
          </Button>
        }
      >
        <Stack spacing={1.5}>
          <Alert severity="warning" variant="outlined">
            {t("web.developer.pat.showOnce")}
          </Alert>
          {createdToken && (
            <>
              <CopyableCode
                label="Token"
                value={createdToken.token}
                onCopy={(value) => void copy(value)}
              />
              <CopyableCode
                label={t("web.developer.pat.configExample")}
                value={configSnippet}
                onCopy={(value) => void copy(value)}
              />
            </>
          )}
        </Stack>
      </StorytellerMascotDialog>

      {snackbars}
      <CustomSnackbar
        open={createToken.isError}
        message={t("web.developer.pat.errors.create")}
        severity="error"
        onClose={() => createToken.reset()}
      />
      <CustomSnackbar
        open={deleteToken.isError}
        message={t("web.developer.pat.errors.delete")}
        severity="error"
        onClose={() => deleteToken.reset()}
      />
    </Stack>
  );
}

function PersonalAccessTokenRow({
  token,
  onDelete,
  deletePending,
}: {
  token: StorytellerPersonalAccessToken;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isExpired =
    token.expires_at !== null && new Date(token.expires_at) < new Date();

  return (
    <ListItem
      secondaryAction={
        <Tooltip title={t("web.developer.pat.delete")}>
          <IconButton
            edge="end"
            disabled={deletePending}
            onClick={() => setConfirmingDelete(true)}
            sx={{
              bgcolor: "error.main",
              color: "error.contrastText",
              "&:hover": { bgcolor: "error.dark" },
              "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
    >
      <ListItemIcon>
        <KeyIcon color={isExpired ? "disabled" : "action"} />
      </ListItemIcon>
      <ListItemText
        primary={token.label || t("web.developer.untitled")}
        secondary={
          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
            <span>
              {token.token_prefix}
              {"…"}・
              {t("web.developer.createdAt", {
                date: new Date(token.created_at).toLocaleString(
                  i18n.resolvedLanguage,
                ),
              })}
            </span>
            <span>
              {token.last_used_at
                ? t("web.developer.lastUsed", {
                    date: new Date(token.last_used_at).toLocaleString(
                      i18n.resolvedLanguage,
                    ),
                  })
                : t("web.developer.neverUsed")}
              {token.expires_at &&
                `・${t(
                  isExpired
                    ? "web.developer.pat.expiredAt"
                    : "web.developer.pat.expiresAt",
                  {
                    date: new Date(token.expires_at).toLocaleString(
                      i18n.resolvedLanguage,
                    ),
                  },
                )}`}
            </span>
          </Stack>
        }
        slotProps={{ secondary: { component: "div" } }}
      />
      <StorytellerMascotDialog
        open={confirmingDelete}
        state="danger"
        eyebrow={t("web.developer.pat.delete")}
        title={t("web.developer.pat.confirmDeleteTitle", {
          name: token.label || t("web.developer.untitled"),
        })}
        description={t("web.developer.pat.confirmDeleteDescription")}
        onClose={() => setConfirmingDelete(false)}
        actions={
          <>
            <Button onClick={() => setConfirmingDelete(false)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={deletePending}
              onClick={() => {
                onDelete();
                setConfirmingDelete(false);
              }}
            >
              {t("web.developer.pat.delete")}
            </Button>
          </>
        }
      />
    </ListItem>
  );
}
