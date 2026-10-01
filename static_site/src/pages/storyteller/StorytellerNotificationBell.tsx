import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import {
  useStorytellerNotificationAction,
  useStorytellerNotifications,
  useStorytellerNotificationUnreadCount,
} from "@/apis/storyteller.ts";
import { StorytellerNotificationRow } from "./StorytellerNotificationRow.tsx";
import {
  notificationPath,
  notificationTimeLabel,
} from "./storytellerNotificationUI.ts";

// popover 只顯示最近幾則，完整列表在通知頁
const POPOVER_LIMIT = 10;

// 頂欄鈴鐺：桌機開 popover，手機直接進通知頁；未讀數每分鐘輪詢、換頁時也更新。
export function StorytellerNotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const unread = useStorytellerNotificationUnreadCount();
  const list = useStorytellerNotifications("all", Boolean(anchor));
  const action = useStorytellerNotificationAction();
  const items = list.data?.pages[0]?.items.slice(0, POPOVER_LIMIT) ?? [];

  const refetchUnread = unread.refetch;
  useEffect(() => {
    void refetchUnread();
  }, [location.pathname, refetchUnread]);

  function open(path: string) {
    setAnchor(null);
    navigate(path);
  }

  return (
    <>
      <Tooltip title="通知">
        <IconButton
          aria-label={`通知${unread.data ? `（${unread.data} 則未讀）` : ""}`}
          onClick={(event) =>
            isMobile ? open(notificationPath()) : setAnchor(event.currentTarget)
          }
          sx={{ mr: 0.5 }}
        >
          <Badge color="error" max={99} badgeContent={unread.data ?? 0}>
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { width: 400, maxWidth: "calc(100vw - 16px)" } },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.75, py: 1.25 }}
        >
          <Typography fontWeight={800}>通知</Typography>
          <Button
            size="small"
            disabled={!unread.data || action.isPending}
            onClick={() => action.mutate({ type: "read-all" })}
          >
            全部標為已讀
          </Button>
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 460, overflow: "auto" }}>
          {list.isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={22} />
            </Stack>
          ) : list.isError ? (
            <Typography
              variant="body2"
              color="error"
              textAlign="center"
              sx={{ py: 4, px: 2 }}
            >
              通知載入失敗，請稍後再試。
            </Typography>
          ) : items.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 4, px: 2 }} spacing={0.5}>
              <Typography fontWeight={800}>目前沒有通知</Typography>
              <Typography variant="body2" color="text.secondary">
                追蹤作者或收藏作品後，更新會出現在這裡。
              </Typography>
            </Stack>
          ) : (
            items.map((n) => (
              <StorytellerNotificationRow
                key={n.public_id}
                n={n}
                compact
                timeLabel={notificationTimeLabel(n.created_at)}
                onOpen={() => open(notificationPath(n.public_id))}
              />
            ))
          )}
        </Box>
        <Divider />
        <Stack alignItems="center" sx={{ py: 0.75 }}>
          <Button size="small" onClick={() => open(notificationPath())}>
            查看全部通知
          </Button>
        </Stack>
      </Popover>
      <CustomSnackbar
        open={action.isError}
        message="標為已讀失敗，請稍後再試。"
        severity="error"
        onClose={() => action.reset()}
      />
    </>
  );
}
