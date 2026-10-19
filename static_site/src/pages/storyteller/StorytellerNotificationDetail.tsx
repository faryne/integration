import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { moderationReasonLabel } from "@/helpers/moderationReasons.ts";
import type {
  StorytellerNotification,
  StorytellerNotificationView,
} from "@/types/storytellerNotification.ts";
import {
  FavoriteBody,
  FollowerBody,
} from "./StorytellerNotificationFollow.tsx";
import {
  CommentNotificationBody,
  PostedNotificationBody,
} from "./StorytellerNotificationPost.tsx";
import {
  NotificationLeading,
  NotificationTags,
  NotificationTitle,
} from "./StorytellerNotificationRow.tsx";
import {
  notificationDaysLeft,
  notificationFullTime,
  notificationProjectPath,
  notificationLink,
  notificationSourceLabel,
  notificationStoryPath,
  summarizeUserAgent,
  useNotificationView,
} from "./storytellerNotificationUI.ts";

// 通知內容頁：依 kind 顯示這次更新的每一話、新作品簡介或安全事件的完整資訊。
// 動作一律導到既有頁面（Reader、作品首頁、憑證管理頁），不在通知裡直接撤銷。
export function StorytellerNotificationDetail({
  n,
  actions,
  onBack,
}: {
  n: StorytellerNotification;
  actions: ReactNode;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const view = useNotificationView(n);
  const daysLeft = notificationDaysLeft(n);
  return (
    <Box>
      {/* 窄版（列表 → 內容切換）才顯示，見 Notifications.tsx 的 container query */}
      <Button
        data-notification-back
        size="small"
        startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 12 }} />}
        onClick={onBack}
        sx={{ display: "none", m: 1.5, mb: 0 }}
      >
        {t("web.notification.backToList")}
      </Button>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-start"
        sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.25, pb: 1.75 }}
      >
        <NotificationLeading n={n} view={view} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontSize: 17, lineHeight: 1.45 }}>
            <NotificationTitle n={n} />
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 0.75 }}
          >
            <Typography variant="caption" color="text.disabled">
              {notificationFullTime(n.created_at)}
            </Typography>
            <NotificationTags n={n} showKindLabel />
          </Stack>
        </Box>
        {actions}
      </Stack>
      <Divider />
      <Stack spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, py: 2.25 }}>
        <NotificationBody n={n} view={view} />
      </Stack>
      <Divider />
      <Typography
        variant="caption"
        color="text.disabled"
        component="p"
        sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}
      >
        {daysLeft === null
          ? t("web.notification.detail.lockedNote")
          : t("web.notification.detail.expiresNote", { count: daysLeft })}
      </Typography>
    </Box>
  );
}

// 依註冊表給的呈現方式分派，不寫死 kind
function NotificationBody({
  n,
  view,
}: {
  n: StorytellerNotification;
  view: StorytellerNotificationView;
}) {
  switch (view) {
    case "stories":
      return <StoryPublishedBody n={n} />;
    case "project":
      return <ProjectPublishedBody n={n} />;
    case "security":
      return <SecurityBody n={n} />;
    case "follower":
      return <FollowerBody n={n} />;
    case "favorite":
      return <FavoriteBody n={n} />;
    case "posted":
      return <PostedNotificationBody n={n} />;
    case "comment":
      return <CommentNotificationBody n={n} />;
    case "moderation":
      return <ModerationBody n={n} />;
    default:
      return <GenericBody n={n} />;
  }
}

// 站方移除：被移除的內容名稱／摘要與原因（原因 slug 在前端對照文字）
function ModerationBody({ n }: { n: StorytellerNotification }) {
  const { t } = useTranslation();
  return (
    <>
      {n.payload.label && (
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
          「{n.payload.label}」
        </Typography>
      )}
      <Typography variant="body2" color="text.secondary">
        {t("web.notification.reason", {
          reason: moderationReasonLabel(n.payload.delete_reason ?? ""),
        })}
      </Typography>
    </>
  );
}

// 沒有專屬畫面的類型：顯示通用內文與「前往查看」
function GenericBody({ n }: { n: StorytellerNotification }) {
  const { t } = useTranslation();
  const link = notificationLink(n.payload.link);
  return (
    <>
      {n.payload.body && (
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
          {n.payload.body}
        </Typography>
      )}
      {link && (
        <Box>
          {link.external ? (
            <Button
              variant="contained"
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon />}
            >
              {t("web.notification.detail.open")}
            </Button>
          ) : (
            <Button variant="contained" component={RouterLink} to={link.href}>
              {t("web.notification.detail.open")}
            </Button>
          )}
        </Box>
      )}
    </>
  );
}

// 「從第 N 話開始讀」＋「前往作品首頁」，新話與新作品共用
function ReadActions({ n }: { n: StorytellerNotification }) {
  const { t } = useTranslation();
  const first = n.payload.stories?.[0];
  const projectPath = notificationProjectPath(n);
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {first && (
        <Button
          variant="contained"
          component={RouterLink}
          to={notificationStoryPath(n, first.public_id)}
        >
          {t("web.notification.detail.startFrom", { title: first.title })}
        </Button>
      )}
      {projectPath && (
        <Button variant="outlined" component={RouterLink} to={projectPath}>
          {t("web.notification.detail.goToWork")}
        </Button>
      )}
    </Stack>
  );
}

function StoryPublishedBody({ n }: { n: StorytellerNotification }) {
  const { t } = useTranslation();
  const stories = n.payload.stories ?? [];
  const rest = (n.payload.story_total ?? stories.length) - stories.length;
  return (
    <>
      <Typography variant="overline" color="text.secondary">
        {t("web.notification.detail.updatedContent")}
      </Typography>
      <List
        disablePadding
        sx={{ border: 1, borderColor: "divider", borderRadius: 1, mt: -1 }}
      >
        {stories.map((story, index) => (
          <ListItem
            key={story.public_id}
            divider={index < stories.length - 1 || rest > 0}
            secondaryAction={
              <Button
                size="small"
                component={RouterLink}
                to={notificationStoryPath(n, story.public_id)}
              >
                {t("web.notification.detail.read")}
              </Button>
            }
          >
            <ListItemText
              primary={story.title}
              secondary={[
                story.volume_title,
                t("web.notification.detail.words", {
                  count: story.word_count.toLocaleString(),
                }),
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </ListItem>
        ))}
        {rest > 0 && (
          <ListItem>
            <ListItemText
              secondary={t("web.notification.detail.moreStories", {
                count: rest,
              })}
            />
          </ListItem>
        )}
      </List>
      <ReadActions n={n} />
    </>
  );
}

function ProjectPublishedBody({ n }: { n: StorytellerNotification }) {
  const { t } = useTranslation();
  const p = n.payload;
  return (
    <>
      <Box
        sx={(theme) => ({
          px: 2,
          py: 2.5,
          borderRadius: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.35)}, ${alpha(theme.palette.success.main, 0.18)})`,
        })}
      >
        <Typography variant="h5" fontWeight={900}>
          {p.project_name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {(p.authors ?? []).join("、")}
        </Typography>
      </Box>
      {p.description && (
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
          {p.description}
        </Typography>
      )}
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {(p.tags ?? []).map((tag) => (
          <Chip key={tag} size="small" variant="outlined" label={tag} />
        ))}
        <Chip
          size="small"
          variant="outlined"
          label={t("web.notification.detail.projectStats", {
            count: p.story_total ?? 0,
            words: (p.word_total ?? 0).toLocaleString(),
          })}
        />
      </Stack>
      <ReadActions n={n} />
    </>
  );
}

function SecurityBody({ n }: { n: StorytellerNotification }) {
  const { t } = useTranslation();
  const p = n.payload;
  // 安全類共用同一個畫面：有 client_name 的是 OAuth 授權，否則是 Personal Access Token
  const isOAuth = Boolean(p.client_name);
  const rows: [string, ReactNode][] = isOAuth
    ? [
        [t("web.notification.detail.security.app"), p.client_name],
        [
          t("web.notification.detail.security.grantedAt"),
          notificationFullTime(n.created_at),
        ],
        [
          t("web.notification.detail.security.scope"),
          t("web.notification.detail.security.scopeValue"),
        ],
      ]
    : [
        [t("web.notification.detail.security.name"), p.label],
        [
          t("web.notification.detail.security.tokenPrefix"),
          p.token_prefix && <code>{p.token_prefix}…</code>,
        ],
        [
          t("web.notification.detail.security.createdAt"),
          notificationFullTime(n.created_at),
        ],
        [
          t("web.notification.detail.security.expiresAt"),
          p.expires_at
            ? notificationFullTime(p.expires_at)
            : t("web.notification.detail.security.neverExpires"),
        ],
      ];
  rows.push(
    [
      t("web.notification.detail.security.source"),
      notificationSourceLabel(p.source),
    ],
    ["IP", p.ip || "—"],
    [
      t("web.notification.detail.security.device"),
      <Tooltip key="ua" title={p.user_agent ?? ""}>
        <span>{summarizeUserAgent(p.user_agent) || "—"}</span>
      </Tooltip>,
    ],
  );
  return (
    <>
      <Box
        component="dl"
        sx={{
          m: 0,
          display: "grid",
          gridTemplateColumns: "96px minmax(0, 1fr)",
          gap: "8px 12px",
          fontSize: 14,
          "& dt": { color: "text.secondary" },
          "& dd": { m: 0, wordBreak: "break-all" },
        }}
      >
        {rows.map(([label, value]) => (
          <Box key={label} sx={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd>{value || "—"}</dd>
          </Box>
        ))}
      </Box>
      <Alert severity="warning" variant="outlined">
        <strong>{t("web.notification.detail.security.notYou")}</strong>
        {isOAuth
          ? t("web.notification.detail.security.revokeOAuth", {
              name: p.client_name,
            })
          : t("web.notification.detail.security.deleteToken")}
      </Alert>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          color="error"
          variant="contained"
          component={RouterLink}
          to={steamloomPath(isOAuth ? "my/oauth" : "my/pat")}
        >
          {isOAuth
            ? t("web.notification.detail.security.goRevoke")
            : t("web.notification.detail.security.goDeleteToken")}
        </Button>
        <Button
          variant="outlined"
          component={RouterLink}
          to={steamloomPath("my/activity")}
        >
          {t("web.notification.detail.security.viewActivity")}
        </Button>
      </Stack>
    </>
  );
}
