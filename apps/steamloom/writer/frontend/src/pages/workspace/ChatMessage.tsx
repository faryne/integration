import { Box, Paper, Typography } from "@mui/material";
import { StorytellerMarkdown } from "@steamloom-web/pages/storyteller/StorytellerMarkdown.tsx";
import dayjs from "dayjs";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";

// Agent 回答沿用網站版 Markdown renderer；使用者輸入保持原文，避免 @reference 被誤判成 Markdown。
export function ChatMessage({ message }: { message: ChatLine }) {
  const system = message.role === "system";
  const markdown = message.role === "assistant";
  const time = message.created_at ? dayjs(message.created_at) : null;
  const align = system ? "center" : message.role === "user" ? "flex-end" : "flex-start";
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: align }}>
      <Paper
        variant="outlined"
        sx={{ px: 1.5, py: 1, maxWidth: system ? "100%" : "80%", minWidth: 0, borderRadius: 2, bgcolor: system ? "action.hover" : message.role === "user" ? "action.selected" : "transparent" }}
      >
        {markdown ? (
          <Box
            sx={{
              fontSize: 14,
              lineHeight: 1.7,
              overflowWrap: "anywhere",
              "& > :first-child, & > :first-child > :first-child": { mt: 0 },
              "& > :last-child, & > :last-child > :last-child": { mb: 0 },
              "& p, & ul, & ol, & blockquote, & pre": { my: 1 },
              "& pre": { maxWidth: "100%", overflow: "auto", p: 1.25, borderRadius: 1, bgcolor: "action.hover" },
              "& code": { fontFamily: "monospace", fontSize: "0.9em" },
              "& :not(pre) > code": { px: 0.5, py: 0.15, borderRadius: 0.5, bgcolor: "action.hover" },
            }}
          >
            <StorytellerMarkdown>{message.text}</StorytellerMarkdown>
          </Box>
        ) : (
          <Typography color={system ? "text.secondary" : "text.primary"} sx={{ fontSize: system ? 12.5 : 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {message.text}
          </Typography>
        )}
      </Paper>
      {time?.isValid() && (
        <Typography component="time" dateTime={message.created_at} color="text.disabled" sx={{ mt: 0.4, px: 0.5, fontSize: 10.5 }}>
          {time.format("YYYY-MM-DD HH:mm")}
        </Typography>
      )}
    </Box>
  );
}
