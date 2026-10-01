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

const emptyCopy: Record<StorytellerNotificationFilter, [string, string]> = {
  all: ["目前沒有通知", "追蹤作者或收藏作品後，更新會出現在這裡。"],
  unread: ["都看完了", "沒有未讀的通知。"],
  locked: [
    "還沒有鎖定的通知",
    "按通知右側的鎖頭就能鎖定，鎖定的通知不會被自動清除。",
  ],
};

// 內容區寬度低於這個值就改成「列表 → 內容」切換（手機、平板、側欄展開的窄視窗）
const SPLIT_MIN_WIDTH = 760;

// 「我的工作台 › 通知」：左邊列表、右邊內容；點通知＝打開內容並標為已讀，不直接跳走。
export function StorytellerNotificationsPanel() {
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
          n.locked ? "已解除鎖定" : "已鎖定，這則通知不會被自動清除",
          n.locked ? "解除鎖定失敗，請稍後再試。" : "鎖定失敗，請稍後再試。",
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
              通知
            </Typography>
            <Typography variant="body2" color="text.secondary">
              追蹤的作者、收藏的作品更新，以及帳號安全提醒。
            </Typography>
          </Box>
          <Button
            variant="outlined"
            disabled={action.isPending || !firstPage?.unread_count}
            onClick={() =>
              run(
                { type: "read-all" },
                "已將全部通知標為已讀",
                "標為已讀失敗，請稍後再試。",
              )
            }
          >
            全部標為已讀
          </Button>
        </Stack>

        {/* 保留期說明：常駐、不可關閉 */}
        <Alert severity="info" variant="outlined">
          通知會在<strong>建立 180 天後自動清除</strong>
          。想留下來的通知可以按鎖頭鎖定，鎖定的通知會永久保留。
          {lockLimit > 0 && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 1 }}
            >
              <Typography variant="caption" fontWeight={700} noWrap>
                已鎖定 {lockedCount} / {lockLimit}
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
            <ToggleButton value="all">全部</ToggleButton>
            <ToggleButton value="unread">
              未讀
              {firstPage?.unread_count ? ` ${firstPage.unread_count}` : ""}
            </ToggleButton>
            <ToggleButton value="locked">
              已鎖定{lockedCount ? ` ${lockedCount}` : ""}
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
                  "通知載入失敗，請稍後再試。",
                )}
              </Alert>
            ) : items.length === 0 ? (
              <Stack alignItems="center" spacing={1} sx={{ py: 5, px: 2 }}>
                <NotificationsNoneOutlinedIcon color="disabled" />
                <Typography fontWeight={800}>{emptyCopy[filter][0]}</Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  textAlign="center"
                >
                  {emptyCopy[filter][1]}
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
                {notificationId ? "找不到這則通知" : "選一則通知查看內容"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {notificationId
                  ? "可能已經被刪除，或超過保留期限被清除了。"
                  : "點左邊的通知就會在這裡打開。"}
              </Typography>
              {notificationId && (
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => navigate(notificationPath())}
                >
                  返回通知
                </Button>
              )}
            </Stack>
          )}
        </Paper>
      </Box>

      <StorytellerMascotDialog
        open={pendingDelete !== null}
        state="danger"
        eyebrow="刪除通知"
        title="確定要刪除這則通知？"
        description={
          pendingDelete?.locked
            ? "這則通知已鎖定，刪除後就不會再保留，此操作無法復原。"
            : "刪除後無法復原。"
        }
        onClose={() => setPendingDelete(null)}
        actions={
          <>
            <Button onClick={() => setPendingDelete(null)}>取消</Button>
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
                    "通知已刪除",
                    "刪除通知失敗，請稍後再試。",
                  );
                  if (deletingSelected) navigate(notificationPath());
                }
                setPendingDelete(null);
              }}
            >
              刪除
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
