import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
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
import { Link as RouterLink } from "react-router-dom";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type { StorytellerNotification } from "@/types/storytellerNotification.ts";
import {
  NotificationTags,
  NotificationTitle,
  NotificationToneAvatar,
} from "./StorytellerNotificationRow.tsx";
import {
  notificationDaysLeft,
  notificationFullTime,
  notificationHeadline,
  notificationProjectPath,
  notificationSafeLink,
  notificationSourceLabel,
  notificationStoryPath,
  summarizeUserAgent,
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
        返回通知
      </Button>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="flex-start"
        sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.25, pb: 1.75 }}
      >
        <NotificationToneAvatar tone={notificationHeadline(n).tone} size={40} />
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
            <NotificationTags n={n} />
          </Stack>
        </Box>
        {actions}
      </Stack>
      <Divider />
      <Stack spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, py: 2.25 }}>
        <NotificationBody n={n} />
      </Stack>
      <Divider />
      <Typography
        variant="caption"
        color="text.disabled"
        component="p"
        sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5 }}
      >
        {daysLeft === null
          ? "已鎖定，這則通知不會被自動清除。"
          : `這則通知會在 ${daysLeft} 天後自動清除，想留下來可以按右上角的鎖頭。`}
      </Typography>
    </Box>
  );
}

function NotificationBody({ n }: { n: StorytellerNotification }) {
  switch (n.kind) {
    case "story.published":
      return <StoryPublishedBody n={n} />;
    case "project.published":
      return <ProjectPublishedBody n={n} />;
    case "security.oauth.authorized":
    case "security.pat.created":
      return <SecurityBody n={n} />;
    default:
      return <GenericBody n={n} />;
  }
}

// 沒有專屬畫面的類型：顯示通用內文與「前往查看」
function GenericBody({ n }: { n: StorytellerNotification }) {
  const link = notificationSafeLink(n.payload.link);
  return (
    <>
      {n.payload.body && (
        <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
          {n.payload.body}
        </Typography>
      )}
      {link && (
        <Box>
          <Button variant="contained" component={RouterLink} to={link}>
            前往查看
          </Button>
        </Box>
      )}
    </>
  );
}

// 「從第 N 話開始讀」＋「前往作品首頁」，新話與新作品共用
function ReadActions({ n }: { n: StorytellerNotification }) {
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
          從〈{first.title}〉開始讀
        </Button>
      )}
      {projectPath && (
        <Button variant="outlined" component={RouterLink} to={projectPath}>
          前往作品首頁
        </Button>
      )}
    </Stack>
  );
}

function StoryPublishedBody({ n }: { n: StorytellerNotification }) {
  const stories = n.payload.stories ?? [];
  const rest = (n.payload.story_total ?? stories.length) - stories.length;
  return (
    <>
      <Typography variant="overline" color="text.secondary">
        這次更新的內容
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
                閱讀
              </Button>
            }
          >
            <ListItemText
              primary={story.title}
              secondary={[
                story.volume_title,
                `${story.word_count.toLocaleString()} 字`,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          </ListItem>
        ))}
        {rest > 0 && (
          <ListItem>
            <ListItemText
              secondary={`以及其他 ${rest} 話，到作品首頁看完整目錄。`}
            />
          </ListItem>
        )}
      </List>
      <ReadActions n={n} />
    </>
  );
}

function ProjectPublishedBody({ n }: { n: StorytellerNotification }) {
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
          label={`目前 ${p.story_total ?? 0} 話 · 約 ${(p.word_total ?? 0).toLocaleString()} 字`}
        />
      </Stack>
      <ReadActions n={n} />
    </>
  );
}

function SecurityBody({ n }: { n: StorytellerNotification }) {
  const p = n.payload;
  const isOAuth = n.kind === "security.oauth.authorized";
  const rows: [string, ReactNode][] = isOAuth
    ? [
        ["應用程式", p.client_name],
        ["授權時間", notificationFullTime(n.created_at)],
        ["授權範圍", "讀取與修改你帳號下所有專案，包含刪除"],
      ]
    : [
        ["名稱", p.label],
        ["Token 前綴", p.token_prefix && <code>{p.token_prefix}…</code>],
        ["建立時間", notificationFullTime(n.created_at)],
        [
          "到期日",
          p.expires_at ? notificationFullTime(p.expires_at) : "不會過期",
        ],
      ];
  rows.push(
    ["入口", notificationSourceLabel(p.source)],
    ["IP", p.ip || "—"],
    [
      "裝置",
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
        <strong>不是你本人操作？</strong>
        {isOAuth
          ? `請立刻撤銷這個授權，${p.client_name} 會馬上失去存取權限。`
          : "請立刻刪除這組 Token，並檢查最近的活動紀錄。"}
      </Alert>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          color="error"
          variant="contained"
          component={RouterLink}
          to={steamloomPath(isOAuth ? "my/oauth" : "my/pat")}
        >
          {isOAuth ? "前往撤銷授權" : "前往刪除 Token"}
        </Button>
        <Button
          variant="outlined"
          component={RouterLink}
          to={steamloomPath("my/activity")}
        >
          查看活動紀錄
        </Button>
      </Stack>
    </>
  );
}
