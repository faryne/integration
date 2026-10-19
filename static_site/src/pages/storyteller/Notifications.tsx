import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  useStorytellerNotification,
  useStorytellerNotificationAction,
  useStorytellerNotifications,
} from "@/apis/storyteller.ts";
import type {
  StorytellerNotification,
  StorytellerNotificationFilter,
} from "@/types/storytellerNotification.ts";
import { StorytellerNotificationDetail } from "./StorytellerNotificationDetail.tsx";
import {
  NotificationActions,
  StorytellerNotificationRow,
} from "./StorytellerNotificationRow.tsx";
import {
  notificationErrorMessage,
  notificationGroupLabel,
  notificationPath,
  notificationTimeLabel,
} from "./storytellerNotificationUI.ts";

// 空狀態文案：web.notification.empty.<filter>.title／.description

// 內容區寬度低於這個值就改成「列表 → 內容」切換（手機、平板、側欄展開的窄視窗）
const SPLIT_MIN_WIDTH = 760;

// 「我的工作台 › 通知」：左邊列表、右邊內容；點通知＝打開內容並標為已讀，不直接跳走。
export function StorytellerNotificationsPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notificationId } = useParams();
  const [filter, setFilter] = useState<StorytellerNotificationFilter>("all");
  const [pendingDelete, setPendingDelete] =
    useState<StorytellerNotification | null>(null);
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const list = useStorytellerNotifications(filter);
  const action = useStorytellerNotificationAction();
  const items = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  );
  const firstPage = list.data?.pages[0];
  // 深連結進來時這一則可能不在目前的列表頁裡，另外打單則 API
  const cached = items.find((item) => item.public_id === notificationId);
  const single = useStorytellerNotification(
    cached ? undefined : notificationId,
  );
  const selected = cached ?? single.data;

  // 打開即標為已讀
  const markRead = action.mutate;
  useEffect(() => {
    if (selected && !selected.read) {
      markRead({ type: "read", publicId: selected.public_id });
    }
  }, [selected, markRead]);

  // 捲到底自動載入下一頁
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function run(
    input: Parameters<typeof action.mutate>[0],
    success: string,
    fallbackError: string,
  ) {
    action.mutate(input, {
      onSuccess: () => setSnack({ message: success, severity: "success" }),
      onError: (error) =>
        setSnack({
          message: notificationErrorMessage(error, fallbackError),
          severity: "error",
        }),
    });
  }

  const actionsFor = (n: StorytellerNotification) => (
    <NotificationActions
      n={n}
      disabled={action.isPending}
      onToggleLock={() =>
        run(
          { type: n.locked ? "unlock" : "lock", publicId: n.public_id },
          n.locked
            ? t("web.notification.messages.unlocked")
            : t("web.notification.messages.locked"),
          n.locked
            ? t("web.notification.errors.unlock")
            : t("web.notification.errors.lock"),
        )
      }
      onDelete={() => setPendingDelete(n)}
    />
  );

  const lockedCount = firstPage?.locked_count ?? 0;
  const lockLimit = firstPage?.lock_limit ?? 0;
  let lastGroup = "";

  return (
    <Box
      sx={{
        containerType: "inline-size",
        // 窄版：選了通知就只顯示內容，沒選就只顯示列表
        [`@container (max-width: ${SPLIT_MIN_WIDTH}px)`]: {
          "& [data-notification-split]": {
            gridTemplateColumns: "minmax(0, 1fr)",
          },
          "& [data-notification-detail]": {
            position: "static",
            display: selected || notificationId ? "block" : "none",
          },
          "& [data-notification-list]": {
            display: selected || notificationId ? "none" : "block",
          },
          "& [data-notification-back]": { display: "inline-flex" },
        },
      }}
    >
      <Stack spacing={2} data-notification-list>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Box>
            <Typography variant="h6" fontWeight={800}>
              {t("web.notification.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("web.notification.description")}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            disabled={action.isPending || !firstPage?.unread_count}
            onClick={() =>
              run(
                { type: "read-all" },
                t("web.notification.messages.allRead"),
                t("web.notification.errors.markRead"),
              )
            }
          >
            {t("web.notification.markAllRead")}
          </Button>
        </Stack>

        {/* 保留期說明：常駐、不可關閉 */}
        <Alert severity="info" variant="outlined">
          <Trans
            i18nKey="web.notification.retention"
            components={{ strong: <strong /> }}
          />
          {lockLimit > 0 && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 1 }}
            >
              <Typography variant="caption" fontWeight={700} noWrap>
                {t("web.notification.lockedCount", {
                  count: lockedCount,
                  limit: lockLimit,
                })}
              </Typography>
              <LinearProgress
                variant="determinate"
                color={lockedCount >= lockLimit ? "error" : "primary"}
                value={Math.min(100, (lockedCount / lockLimit) * 100)}
                sx={{ width: 120 }}
              />
            </Stack>
          )}
        </Alert>
      </Stack>

      <Box
        data-notification-split
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)",
          gap: 2,
          alignItems: "start",
        }}
      >
        <Stack spacing={1.25} data-notification-list>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_, value: StorytellerNotificationFilter | null) =>
              value && setFilter(value)
            }
          >
            <ToggleButton value="all">{t("web.common.all")}</ToggleButton>
            <ToggleButton value="unread">
              {t("web.notification.filters.unread")}
              {firstPage?.unread_count ? ` ${firstPage.unread_count}` : ""}
            </ToggleButton>
            <ToggleButton value="locked">
              {t("web.notification.filters.locked")}
              {lockedCount ? ` ${lockedCount}` : ""}
            </ToggleButton>
          </ToggleButtonGroup>
          <Paper
            variant="outlined"
            sx={{ borderRadius: 1, overflow: "hidden" }}
          >
            {list.isLoading ? (
              <Stack alignItems="center" sx={{ py: 5 }}>
                <CircularProgress size={26} />
              </Stack>
            ) : list.isError ? (
              <Alert severity="error" sx={{ m: 1.5 }}>
                {notificationErrorMessage(
                  list.error,
                  t("web.notification.errors.load"),
                )}
              </Alert>
            ) : items.length === 0 ? (
              <Stack alignItems="center" spacing={1} sx={{ py: 5, px: 2 }}>
                <NotificationsNoneOutlinedIcon color="disabled" />
                <Typography fontWeight={800}>
                  {t(`web.notification.empty.${filter}.title`)}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  {t(`web.notification.empty.${filter}.description`)}
                </Typography>
              </Stack>
            ) : (
              items.map((n) => {
                const group = notificationGroupLabel(n.created_at);
                const showGroup = group !== lastGroup;
                lastGroup = group;
                return (
                  <Fragment key={n.public_id}>
                    {showGroup && (
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          px: 2,
                          py: 0.75,
                          fontWeight: 800,
                          color: "text.disabled",
                          bgcolor: "action.hover",
                        }}
                      >
                        {group}
                      </Typography>
                    )}
                    <StorytellerNotificationRow
                      n={n}
                      timeLabel={notificationTimeLabel(n.created_at)}
                      selected={n.public_id === notificationId}
                      actions={actionsFor(n)}
                      onOpen={() => navigate(notificationPath(n.public_id))}
                    />
                  </Fragment>
                );
              })
            )}
            <Box ref={sentinelRef} />
            {isFetchingNextPage && (
              <Stack alignItems="center" sx={{ py: 2 }}>
                <CircularProgress size={20} />
              </Stack>
            )}
          </Paper>
        </Stack>

        <Paper
          data-notification-detail
          variant="outlined"
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            position: "sticky",
            top: 0,
          }}
        >
          {selected ? (
            <StorytellerNotificationDetail
              n={selected}
              actions={actionsFor(selected)}
              onBack={() => navigate(notificationPath())}
            />
          ) : notificationId && single.isLoading ? (
            <Stack alignItems="center" sx={{ py: 8 }}>
              <CircularProgress size={26} />
            </Stack>
          ) : (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={0.5}
              sx={{ minHeight: 360, px: 2, textAlign: "center" }}
            >
              <Typography fontWeight={800}>
                {notificationId
                  ? t("web.notification.detail.notFound")
                  : t("web.notification.detail.selectOne")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {notificationId
                  ? t("web.notification.detail.notFoundDescription")
                  : t("web.notification.detail.selectOneDescription")}
              </Typography>
              {notificationId && (
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => navigate(notificationPath())}
                >
                  {t("web.notification.backToList")}
                </Button>
              )}
            </Stack>
          )}
        </Paper>
      </Box>

      <StorytellerMascotDialog
        open={pendingDelete !== null}
        state="danger"
        eyebrow={t("web.notification.delete")}
        title={t("web.notification.confirmDeleteTitle")}
        description={
          pendingDelete?.locked
            ? t("web.notification.confirmDeleteLocked")
            : t("web.discussion.confirm.deleteBody")
        }
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <Button onClick={() => setPendingDelete(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={action.isPending}
              onClick={() => {
                if (pendingDelete) {
                  const deletingSelected =
                    pendingDelete.public_id === notificationId;
                  run(
                    { type: "delete", publicId: pendingDelete.public_id },
                    t("web.notification.messages.deleted"),
                    t("web.notification.errors.delete"),
                  );
                  if (deletingSelected) navigate(notificationPath());
                }
                setPendingDelete(null);
              }}
            >
              {t("web.common.delete")}
            </Button>
          </>
        }
      />
      <CustomSnackbar
        open={snack !== null}
        message={snack?.message ?? ""}
        severity={snack?.severity}
        onClose={() => setSnack(null)}
      />
    </Box>
  );
}
