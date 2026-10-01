import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GppMaybeOutlinedIcon from "@mui/icons-material/GppMaybeOutlined";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { StorytellerNotification } from "@/types/storytellerNotification.ts";
import {
  NOTIFICATION_EXPIRING_WITHIN_DAYS,
  notificationDaysLeft,
  notificationHeadline,
  type NotificationTone,
} from "./storytellerNotificationUI.ts";

const toneIcons: Record<NotificationTone, ReactNode> = {
  story: <AutoStoriesOutlinedIcon fontSize="small" />,
  project: <AutoAwesomeOutlinedIcon fontSize="small" />,
  security: <GppMaybeOutlinedIcon fontSize="small" />,
  general: <NotificationsNoneOutlinedIcon fontSize="small" />,
};

const toneColor = (theme: Theme, tone: NotificationTone) =>
  tone === "story"
    ? theme.palette.primary.main
    : tone === "project"
      ? theme.palette.success.main
      : tone === "security"
        ? theme.palette.warning.main
        : theme.palette.info.main;

export function NotificationToneAvatar({
  tone,
  size = 36,
}: {
  tone: NotificationTone;
  size?: number;
}) {
  return (
    <Avatar
      sx={(theme) => ({
        width: size,
        height: size,
        color: toneColor(theme, tone),
        bgcolor: alpha(toneColor(theme, tone), 0.14),
      })}
    >
      {toneIcons[tone]}
    </Avatar>
  );
}

// 標題：主詞（筆名／應用程式）粗體，其餘一般字重
export function NotificationTitle({ n }: { n: StorytellerNotification }) {
  const headline = notificationHeadline(n);
  return (
    <>
      {headline.actor && <b>{headline.actor}</b>}
      {headline.text}
    </>
  );
}

// 分級、安全、鎖定、即將清除等標記；列表與內容頁共用
export function NotificationTags({ n }: { n: StorytellerNotification }) {
  const daysLeft = notificationDaysLeft(n);
  return (
    <>
      {n.payload.rating === "restricted" && (
        <Chip size="small" color="error" variant="outlined" label="R18" />
      )}
      {n.kind.startsWith("security.") && (
        <Chip size="small" variant="outlined" label="帳號安全" />
      )}
      {n.locked && (
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          icon={<LockIcon />}
          label="已鎖定"
        />
      )}
      {daysLeft !== null && daysLeft <= NOTIFICATION_EXPIRING_WITHIN_DAYS && (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          label={`${daysLeft} 天後清除`}
        />
      )}
    </>
  );
}

export function NotificationActions({
  n,
  disabled,
  onToggleLock,
  onDelete,
}: {
  n: StorytellerNotification;
  disabled?: boolean;
  onToggleLock: () => void;
  onDelete: () => void;
}) {
  return (
    <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
      <Tooltip title={n.locked ? "解除鎖定" : "鎖定（不會被自動清除）"}>
        <IconButton
          size="small"
          disabled={disabled}
          color={n.locked ? "primary" : "default"}
          aria-label={n.locked ? "解除鎖定" : "鎖定通知"}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLock();
          }}
        >
          {n.locked ? (
            <LockIcon fontSize="small" />
          ) : (
            <LockOpenOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Tooltip title="刪除">
        <IconButton
          size="small"
          disabled={disabled}
          aria-label="刪除通知"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

// 一則通知列；compact（popover）不顯示操作按鈕與「N 天後清除」以外的雜訊
export function StorytellerNotificationRow({
  n,
  timeLabel,
  selected = false,
  compact = false,
  actions,
  onOpen,
}: {
  n: StorytellerNotification;
  timeLabel: string;
  selected?: boolean;
  compact?: boolean;
  actions?: ReactNode;
  onOpen: () => void;
}) {
  const headline = notificationHeadline(n);
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
      sx={(theme) => ({
        position: "relative",
        display: "grid",
        gridTemplateColumns: "36px minmax(0, 1fr) auto",
        gap: 1.25,
        alignItems: "start",
        px: compact ? 1.75 : 2,
        py: compact ? 1.25 : 1.5,
        cursor: "pointer",
        borderTop: 1,
        borderColor: "divider",
        "&:first-of-type": { borderTop: 0 },
        bgcolor: selected
          ? alpha(theme.palette.primary.main, 0.1)
          : n.read
            ? "transparent"
            : alpha(theme.palette.primary.main, 0.05),
        boxShadow: selected
          ? `inset 3px 0 0 ${theme.palette.primary.main}`
          : "none",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: -2,
        },
        // 未讀圓點
        "&::before": n.read
          ? undefined
          : {
              content: '""',
              position: "absolute",
              left: 5,
              top: "50%",
              width: 6,
              height: 6,
              mt: "-3px",
              borderRadius: "50%",
              bgcolor: "primary.main",
            },
      })}
    >
      <NotificationToneAvatar tone={headline.tone} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ lineHeight: 1.5, fontWeight: n.read ? 400 : 500 }}
        >
          <NotificationTitle n={n} />
        </Typography>
        {headline.sub && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: "block" }}
          >
            {headline.sub}
          </Typography>
        )}
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 0.5 }}
        >
          <Typography variant="caption" color="text.disabled">
            {timeLabel}
          </Typography>
          {!compact && <NotificationTags n={n} />}
        </Stack>
      </Box>
      {!compact && actions}
    </Box>
  );
}
