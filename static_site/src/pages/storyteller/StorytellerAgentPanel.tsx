import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ReplyIcon from "@mui/icons-material/Reply";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import type { ButtonProps } from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  STORYTELLER_ASSISTANT_AVATAR_SRC,
  STORYTELLER_ASSISTANT_THINKING_GIF_SRC,
} from "@/helpers/storytellerMascot.ts";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";
import { buildStorytellerAgentMessageLinks } from "@/pages/storyteller/storytellerAgentReferences.ts";
import type {
  StorytellerAgentRunMode,
  StorytellerAgentRunUsage,
  StorytellerAssistantExpression,
} from "@/types/storyteller.ts";

export interface StorytellerAgentPanelAgent {
  id: string;
  name: string;
  prompt: string;
  enabled: boolean;
}

export interface StorytellerAgentPanelSelection {
  start: number;
  end: number;
  text: string;
}

export interface StorytellerAgentPanelMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  speaker: string;
  expression?: StorytellerAssistantExpression;
  mode?: StorytellerAgentRunMode;
  // 選字觸發 skill 時保留原始選取段落，讓送出當下與重整後都看得出指令作用範圍。
  selectedContent?: string;
  usage?: StorytellerAgentRunUsage;
  resultSelection?: StorytellerAgentPanelSelection | null;
  isLoading?: boolean;
  isCurrentResult?: boolean;
  // skill 現在也走背景執行＋輪詢：chatId／chatStatus 讓 loading 中的 skill
  // 訊息能被跟 agentic 對話同一套 polling 邏輯認出來、換成正式結果；
  // chatStatus="pending" 代表背景呼叫失敗，沒有拿到回覆。
  chatId?: number;
  chatStatus?: "pending" | "in_progress" | "completed";
}

// /rewrite／/expand 等 skill 指令的完整 mode 值 -> skill 名稱，給訊息泡泡上的
// 「這則走了哪個指令」標籤用；標籤文字取 web.agent.skills.<skill>.label，
// 跟「指令與引用說明」抽屜共用同一份翻譯。key 是完整 mode 值（存進 metadata 的就是這個）。
const AGENT_RUN_MODE_SKILLS: Record<StorytellerAgentRunMode, string> = {
  rewrite_selection: "rewrite",
  expand_selection: "expand",
  translate_selection: "translate",
  continue_chapter: "continue",
  custom_selection: "custom",
};

export type StorytellerAgentApplyAction =
  "replace" | "insert" | "append" | "copy";

// Provider 與多輪工具呼叫可能需要一段時間；動畫表達梭梭仍在思考，秒數則明確告訴
// 使用者已經等了多久，不再用隨機文案猜測目前進度。
export function StorytellerAgentLoadingState() {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    setElapsedSeconds(0);
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Stack spacing={0.5} alignItems="center" sx={{ py: 0.5 }}>
      <Box
        component="img"
        src={STORYTELLER_ASSISTANT_THINKING_GIF_SRC}
        alt={t("web.agent.thinkingAlt")}
        sx={{ width: 112, height: 112, objectFit: "contain" }}
      />
      <Typography variant="body2" color="text.secondary">
        {t("web.agent.thinking", { seconds: elapsedSeconds })}
      </Typography>
    </Stack>
  );
}

// 泡泡下面那排「附加末尾/複製/回覆」動作鍵，之前用 variant="outlined" 疊在泡泡
// 下面，等於又是一排跟泡泡本身一樣的方框，看起來像箱子疊箱子。改成無邊框的
// 文字按鈕，視覺上依附在泡泡上而不是獨立的一排容器——StorytellerAgentMessage／
// AgenticAssistantMessage 共用同一份，維持兩邊手感一致。
export const storytellerChatActionButtonProps: Pick<
  ButtonProps,
  "size" | "variant"
> = { size: "small", variant: "text" };

// 訊息泡泡的外觀（圓角、陰影、說話者標籤這層）給 StorytellerAgentMessage（skill
// 訊息）跟 StorytellerAgenticPanel.tsx 的 AgenticAssistantMessage（agentic 訊息）
// 共用——這兩個一直是「雙胞胎」，樣式改一邊很容易忘記改另一邊，抽出來後改一次
// 兩邊自動一起套用。
//
// 圓角刻意做成不對稱：貼近說話者那一側的角（使用者泡泡右下、AI 泡泡左下）留小，
// 其餘三個角放大，做出經典聊天泡泡「尖角指向說話者」的手感，不是四個角一樣的
// 卡片。原本完全沒有陰影，泡泡直接貼在同色系的面板底色上、只靠一條細邊框分界，
// 加一層很淺的陰影（MUI 內建 shadows[1]）讓泡泡從底色浮起來，是這次最主要的
// 「不再像方塊」的來源。
export function StorytellerChatBubble({
  messageId,
  isUser,
  isReplyTarget,
  speaker,
  avatarSrc,
  avatarFallbackSrc,
  avatarAlt,
  avatarFallback,
  hideAvatar = false,
  badge,
  children,
}: {
  messageId: string;
  isUser: boolean;
  isReplyTarget?: boolean;
  speaker: ReactNode;
  avatarSrc?: string;
  avatarFallbackSrc?: string;
  avatarAlt: string;
  avatarFallback: string;
  hideAvatar?: boolean;
  // 這則訊息實際用了哪個 Agent 人設／哪個 skill 指令——小小一個 Chip 貼在
  // 說話者名稱旁邊，事後回頭看對話紀錄才追得回「這則當時發生了什麼事」。
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  useEffect(() => setAvatarLoadFailed(false), [avatarSrc]);

  return (
    <Box
      data-agent-message-id={messageId}
      sx={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 1,
      }}
    >
      {!hideAvatar && (
        <Avatar
          src={(avatarLoadFailed ? avatarFallbackSrc : avatarSrc) || undefined}
          alt={avatarAlt}
          slotProps={{ img: { onError: () => setAvatarLoadFailed(true) } }}
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            border: "1px solid",
            borderColor: isUser ? "primary.light" : "divider",
            bgcolor: isUser ? "primary.dark" : "background.paper",
            color: isUser ? "primary.contrastText" : "text.secondary",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}
        >
          {avatarFallback}
        </Avatar>
      )}
      <Box
        sx={{
          maxWidth: hideAvatar ? "100%" : "calc(100% - 44px)",
          p: 1.5,
          borderRadius: "16px",
          borderBottomRightRadius: isUser ? "4px" : "16px",
          borderBottomLeftRadius: isUser ? "16px" : "4px",
          boxShadow: 1,
          bgcolor: isUser ? "primary.main" : "background.paper",
          color: isUser ? "primary.contrastText" : "text.primary",
          border: isUser ? 0 : "1px solid",
          borderColor: isReplyTarget ? "primary.main" : "divider",
          outline: isReplyTarget ? "2px solid" : "none",
          outlineColor: "primary.main",
          "& blockquote": {
            m: 0,
            mt: 0.75,
            mb: 1,
            px: 1.25,
            py: 0.75,
            borderLeft: "3px solid",
            borderColor: isUser ? "primary.contrastText" : "primary.main",
            bgcolor: isUser ? "rgba(255,255,255,0.14)" : "action.hover",
            borderRadius: 0.5,
          },
          "& blockquote p": { m: 0 },
        }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Typography
            variant="caption"
            fontWeight={700}
            color={isUser ? "inherit" : "text.secondary"}
            sx={{ opacity: isUser ? 0.82 : 1 }}
          >
            {speaker}
          </Typography>
          {badge}
        </Stack>
        {children}
      </Box>
    </Box>
  );
}

// 給 StorytellerChatBubble 的 badge prop 用——標出這則走了哪個 skill 指令（mode），
// 沒有 mode 就不渲染任何東西（一般聊天訊息不用特別標）。
export function StorytellerChatBadges({
  mode,
}: {
  mode?: StorytellerAgentRunMode | string;
}) {
  const { t } = useTranslation();
  const skill = mode ? AGENT_RUN_MODE_SKILLS[mode as StorytellerAgentRunMode] : undefined;
  if (!skill) {
    return null;
  }
  const modeLabel = `/${skill} ${t(`web.agent.skills.${skill}.label`)}`;
  return (
    <Chip
      size="small"
      variant="outlined"
      label={modeLabel}
      sx={{
        height: 18,
        "& .MuiChip-label": { px: 0.75, fontSize: "0.68rem" },
      }}
    />
  );
}

export interface StorytellerAgentMessageProps {
  message: StorytellerAgentPanelMessage;
  userAvatarSrc?: string;
  userAvatarFallback: string;
  assistantAvatarSrc: string;
  enableReplace: boolean;
  enableInsert: boolean;
  onApplyText: (
    text: string,
    action: StorytellerAgentApplyAction,
    selection: StorytellerAgentPanelSelection | null,
  ) => void;
  onReply?: (message: StorytellerAgentPanelMessage) => void;
  // 呼叫端可在共用的訊息動作列加入功能，例如把這輪對話整理成記憶。
  additionalActions?: ReactNode;
  isReplyTarget?: boolean;
  // 給 @thisStory／@story:[...] 這類引用 token 解析成真連結用——留空時
  // （例如載入中的暫時訊息，content 本來就是空字串）直接照原樣顯示，不會出錯。
  targetKind?: "story" | "lore";
  projectPublicId?: string;
  targetPublicId?: string;
  otherStories?: { id: string; title: string; content: string }[];
  lores?: { id: string; title: string; content: string }[];
}

// 由 StorytellerAgenticPanel.tsx（「AI 助理」面板）在渲染 skill（slash command）
// 觸發的訊息時複用，維持一套訊息泡泡樣式與套用按鈕邏輯，不重複刻一份。
export function StorytellerAgentMessage(props: StorytellerAgentMessageProps) {
  const { t } = useTranslation();
  const { message } = props;
  const isUser = message.role === "user";
  const canApply = !isUser && message.content.trim() !== "";
  const linkedContent = props.targetKind
    ? buildStorytellerAgentMessageLinks(message.content, {
        targetKind: props.targetKind,
        projectPublicId: props.projectPublicId,
        targetPublicId: props.targetPublicId,
        otherStories: props.otherStories ?? [],
        lores: props.lores ?? [],
      })
    : message.content;

  return (
    <StorytellerChatBubble
      messageId={message.id}
      isUser={isUser}
      isReplyTarget={props.isReplyTarget}
      speaker={message.speaker}
      avatarSrc={
        isUser
          ? props.userAvatarSrc
          : message.role === "assistant"
            ? props.assistantAvatarSrc
            : undefined
      }
      avatarFallbackSrc={
        message.role === "assistant"
          ? STORYTELLER_ASSISTANT_AVATAR_SRC
          : undefined
      }
      avatarAlt={
        isUser
          ? t("web.agent.avatar.user")
          : message.role === "assistant"
            ? t("web.agent.avatar.assistant")
            : t("web.agent.avatar.system")
      }
      avatarFallback={
        isUser
          ? props.userAvatarFallback
          : message.role === "assistant"
            ? t("web.agent.avatar.assistantInitial")
            : t("web.agent.avatar.systemInitial")
      }
      hideAvatar={message.isLoading}
      badge={<StorytellerChatBadges mode={message.mode} />}
    >
      {message.isLoading ? (
        <StorytellerAgentLoadingState />
      ) : (
        <Box sx={{ typography: "body2", mt: 0.5 }}>
          {message.selectedContent && (
            <Typography
              component="blockquote"
              variant="body2"
              sx={{
                m: 0,
                mb: message.content.trim() ? 1 : 0,
                pl: 1.25,
                py: 0.5,
                borderLeft: "3px solid",
                borderColor: "primary.main",
                color: "text.secondary",
                fontStyle: "italic",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.selectedContent}
            </Typography>
          )}
          {message.content.trim() ? (
            <StorytellerMarkdown>{linkedContent}</StorytellerMarkdown>
          ) : null}
        </Box>
      )}
      {isUser && message.chatStatus === "pending" && (
        <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
          {t("web.agent.pendingReply")}
        </Alert>
      )}
      {!isUser && message.usage?.total_tokens ? (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          <Chip size="small" label={`${message.usage.total_tokens} tokens`} />
        </Stack>
      ) : null}
      {canApply && (
        <Stack
          direction="row"
          spacing={1}
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1 }}
        >
          {props.enableReplace &&
            message.isCurrentResult &&
            message.resultSelection && (
              <Button
                {...storytellerChatActionButtonProps}
                onClick={() =>
                  props.onApplyText(
                    message.content,
                    "replace",
                    message.resultSelection ?? null,
                  )
                }
              >
                {t("web.agent.apply.replace")}
              </Button>
            )}
          {props.enableInsert && (
            <Button
              {...storytellerChatActionButtonProps}
              onClick={() => props.onApplyText(message.content, "insert", null)}
            >
              {t("web.agent.apply.insert")}
            </Button>
          )}
          <Button
            {...storytellerChatActionButtonProps}
            onClick={() => props.onApplyText(message.content, "append", null)}
          >
            {t("web.agent.apply.append")}
          </Button>
          <Button
            {...storytellerChatActionButtonProps}
            startIcon={<ContentCopyIcon />}
            onClick={() => props.onApplyText(message.content, "copy", null)}
          >
            {t("web.common.copy")}
          </Button>
          {props.onReply && (
            <Button
              {...storytellerChatActionButtonProps}
              startIcon={<ReplyIcon />}
              onClick={() => props.onReply?.(message)}
            >
              {t("web.agent.apply.reply")}
            </Button>
          )}
          {props.additionalActions}
        </Stack>
      )}
    </StorytellerChatBubble>
  );
}
