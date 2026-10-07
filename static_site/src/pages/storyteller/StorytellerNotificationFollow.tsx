import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import PersonIcon from "@mui/icons-material/Person";
import {
  Avatar,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useStorytellerNotificationAction } from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { steamloomCreatorPath } from "@/helpers/steamloom.ts";
import type {
  StorytellerNotification,
  StorytellerNotificationFollowBack,
} from "@/types/storytellerNotification.ts";
import {
  notificationActorName,
  notificationErrorMessage,
  notificationProjectPath,
} from "./storytellerNotificationUI.ts";

// 追蹤（follower）／收藏作品（favorite）兩種通知的畫面與回追按鈕。
// 回追用哪個身份由後端依通知決定，前端只在作品有多個署名身份時讓使用者選一個。

// 追蹤者頭像；身份還在就能點進對方的創作者頁
export function NotificationActorAvatar({
  n,
  size = 36,
}: {
  n: StorytellerNotification;
  size?: number;
}) {
  const actor = n.payload.actor;
  const avatar = (
    <Avatar
      src={actor?.avatar_url}
      alt={notificationActorName(n)}
      sx={{ width: size, height: size }}
    >
      <PersonIcon fontSize="small" />
    </Avatar>
  );
  return actor ? (
    <Box
      component={RouterLink}
      to={steamloomCreatorPath(actor.pen_name)}
      title={`前往 ${actor.pen_name} 的創作者頁`}
      // 列表列整列可點，頭像點擊不要再觸發「打開通知」
      onClick={(event) => event.stopPropagation()}
      sx={{ display: "inline-flex", borderRadius: "50%" }}
    >
      {avatar}
    </Box>
  ) : (
    avatar
  );
}

// 收藏作品通知的列表圖示：作品書封（方）＋右下角收藏者小頭像，跟追蹤通知的圓頭像一眼分得出來
export function NotificationFavoriteCover({
  n,
  size = 36,
}: {
  n: StorytellerNotification;
  size?: number;
}) {
  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        width: size,
        height: size * 1.28,
        borderRadius: 0.75,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.3,
        fontWeight: 800,
        color: "primary.contrastText",
        background: `linear-gradient(160deg, ${theme.palette.primary.main}, ${alpha(theme.palette.success.main, 0.7)})`,
      })}
    >
      {(n.payload.project_name ?? "").slice(0, 2)}
      <Box
        sx={{
          position: "absolute",
          right: -6,
          bottom: -6,
          borderRadius: "50%",
          border: 2,
          borderColor: "background.paper",
          display: "inline-flex",
        }}
      >
        <NotificationActorAvatar n={n} size={size * 0.55} />
      </Box>
    </Box>
  );
}

// 回追：已互相追蹤顯示 chip；snack 放在外層，回追成功、按鈕換成 chip 時才不會跟著被卸載
function FollowBackControl({ n }: { n: StorytellerNotification }) {
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const followBack = n.follow_back;
  if (!followBack || followBack.state === "unavailable") return null;
  return (
    <>
      {followBack.state === "following" ? (
        <Chip icon={<CheckIcon />} label="已互相追蹤" variant="outlined" />
      ) : (
        <FollowBackButton
          n={n}
          identities={followBack.identities}
          onResult={(message, severity) => setSnack({ message, severity })}
        />
      )}
      <CustomSnackbar
        open={snack !== null}
        message={snack?.message ?? ""}
        severity={snack?.severity}
        onClose={() => setSnack(null)}
      />
    </>
  );
}

// 回追按鈕；多個署名身份時是「以 P 回追 ▾」可切換身份
function FollowBackButton({
  n,
  identities,
  onResult,
}: {
  n: StorytellerNotification;
  identities: StorytellerNotificationFollowBack["identities"];
  onResult: (message: string, severity: "success" | "error") => void;
}) {
  const action = useStorytellerNotificationAction();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState(0);
  const identity = identities[Math.min(selected, identities.length - 1)];
  const label = identity.is_self ? "回追" : `以 ${identity.pen_name} 回追`;
  const followBackNow = () =>
    action.mutate(
      {
        type: "follow-back",
        publicId: n.public_id,
        // 只有一個候選時後端自己決定，不用傳
        as: identities.length > 1 ? identity.pen_name : undefined,
      },
      {
        onSuccess: () =>
          onResult(
            identity.is_self
              ? `已回追 ${notificationActorName(n)}`
              : `已以 ${identity.pen_name} 回追 ${notificationActorName(n)}`,
            "success",
          ),
        onError: (error) =>
          onResult(
            notificationErrorMessage(error, "回追失敗，請稍後再試。"),
            "error",
          ),
      },
    );

  return (
    <>
      <ButtonGroup variant="contained" disabled={action.isPending}>
        <Button onClick={followBackNow} sx={{ whiteSpace: "nowrap" }}>
          {label}
        </Button>
        {identities.length > 1 && (
          <Button
            size="small"
            aria-label="選擇回追身份"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
          >
            <ArrowDropDownIcon />
          </Button>
        )}
      </ButtonGroup>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        {identities.map((item, index) => (
          <MenuItem
            key={item.pen_name}
            selected={index === selected}
            onClick={() => {
              setSelected(index);
              setMenuAnchor(null);
            }}
          >
            以 {item.pen_name}
            {item.is_self ? "（本人）" : ""} 回追
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

// 說明這次回追會用哪個身份，讓使用者知道對方看不出筆名屬於誰
function identityNote(n: StorytellerNotification, isFavorite: boolean) {
  const followBack = n.follow_back;
  if (!followBack || followBack.state === "unavailable") {
    return n.payload.actor
      ? "你被追蹤的身份已經不存在，無法回追。"
      : "對方已刪除這個身份，無法回追。";
  }
  if (!isFavorite) {
    const target = n.payload.target_pen_name;
    return target
      ? `對方追蹤的是你的筆名「${target}」，回追也會用「${target}」的身份，對方看不出這個筆名屬於誰。`
      : "對方追蹤的是你的本人身份，回追會用本人身份。";
  }
  const identities = followBack.identities;
  if (identities.length > 1) {
    return `這部作品有 ${identities.length} 個署名身份，選一個回追；只會列出這部作品署名過的身份。`;
  }
  return identities[0]?.is_self
    ? "這部作品以本人身份署名，回追會用本人身份。"
    : `這部作品署名「${identities[0]?.pen_name}」，回追會用「${identities[0]?.pen_name}」的身份。`;
}

// 追蹤者卡片：大頭像與筆名可點進創作者頁，右邊是回追
function ActorCard({ n }: { n: StorytellerNotification }) {
  const actor = n.payload.actor;
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.75, display: "flex", alignItems: "center", gap: 1.75 }}
    >
      <NotificationActorAvatar n={n} size={56} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {actor ? (
          <Typography
            component={RouterLink}
            to={steamloomCreatorPath(actor.pen_name)}
            variant="subtitle1"
            fontWeight={800}
            color="text.primary"
            sx={{
              textDecoration: "none",
              overflowWrap: "anywhere",
              "&:hover": { color: "primary.main", textDecoration: "underline" },
            }}
          >
            {actor.pen_name}
          </Typography>
        ) : (
          <Typography variant="subtitle1" fontWeight={800}>
            已不存在的使用者
          </Typography>
        )}
        {actor?.bio && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {actor.bio}
          </Typography>
        )}
      </Box>
      <FollowBackControl n={n} />
    </Paper>
  );
}

export function FollowerBody({ n }: { n: StorytellerNotification }) {
  return (
    <>
      <ActorCard n={n} />
      <Typography variant="body2" color="text.secondary">
        {identityNote(n, false)}
      </Typography>
    </>
  );
}

export function FavoriteBody({ n }: { n: StorytellerNotification }) {
  const p = n.payload;
  const projectPath = notificationProjectPath(n);
  return (
    <>
      <Paper
        variant="outlined"
        sx={{ p: 1.75, display: "flex", gap: 1.75, alignItems: "center" }}
      >
        <Box
          sx={(theme) => ({
            width: 64,
            height: 84,
            flexShrink: 0,
            borderRadius: 1,
            display: "grid",
            placeItems: "center",
            fontWeight: 900,
            color: "primary.contrastText",
            background: `linear-gradient(160deg, ${theme.palette.primary.main}, ${alpha(theme.palette.success.main, 0.7)})`,
          })}
        >
          {(p.project_name ?? "").slice(0, 2)}
        </Box>
        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
          <Typography variant="h6" fontWeight={900}>
            《{p.project_name}》
          </Typography>
          {(p.authors ?? []).length > 0 && (
            <Typography variant="body2" color="text.secondary">
              署名：{p.authors!.join("、")}
            </Typography>
          )}
          {projectPath && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                component={RouterLink}
                to={projectPath}
              >
                前往作品首頁
              </Button>
            </Box>
          )}
        </Stack>
      </Paper>
      <ActorCard n={n} />
      <Typography variant="body2" color="text.secondary">
        {identityNote(n, true)}
      </Typography>
    </>
  );
}
