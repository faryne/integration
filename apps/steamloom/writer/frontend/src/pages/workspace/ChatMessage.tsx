import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { StorytellerMarkdown } from "@steamloom-web/pages/storyteller/StorytellerMarkdown.tsx";
import dayjs from "dayjs";
import type { ChatLine } from "@writer/pages/workspace/useChatLog.ts";
import { promptReferencePreview } from "@writer/pages/workspace/promptReferences.ts";

// Agent 回答沿用網站版 Markdown renderer；使用者輸入保持原文，避免 @reference 被誤判成 Markdown。
export function ChatMessage({ message, onQuote }: { message: ChatLine; onQuote?: () => void }) {
  const { t } = useTranslation();
  const system = message.role === "system";
  const markdown = message.role === "assistant";
  const time = message.created_at ? dayjs(message.created_at) : null;
  const metadata = [time?.isValid() ? time.format("YYYY-MM-DD HH:mm") : "", message.model, message.reasoning_effort].filter(Boolean);
  const align = system ? "center" : message.role === "user" ? "flex-end" : "flex-start";
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: align, "&:hover .chat-quote-action, &:focus-within .chat-quote-action": { opacity: 1 } }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", flexDirection: message.role === "user" ? "row-reverse" : "row", gap: 0.5, maxWidth: system ? "100%" : "88%" }}>
      <Paper
        variant="outlined"
        sx={{ px: 1.5, py: 1, minWidth: 0, borderRadius: 2, bgcolor: system ? "action.hover" : message.role === "user" ? "action.selected" : "transparent" }}
      >
        {message.references && message.references.length > 0 && (
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {message.references.map((reference) => (
              <Box key={reference.id} sx={{ borderLeft: 2, borderColor: "divider", pl: 1 }}>
                <Typography color="text.secondary" sx={{ fontSize: 10.5, fontWeight: 700 }}>{reference.title}</Typography>
                <Typography color="text.secondary" sx={{ fontSize: 11.5 }}>{promptReferencePreview(reference.text)}</Typography>
              </Box>
            ))}
          </Stack>
        )}
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
      {onQuote && (
        <Tooltip title={t("workspace.chat.quoteReply")}>
          <IconButton className="chat-quote-action" size="small" aria-label={t("workspace.chat.quoteReply")} onClick={onQuote} sx={{ opacity: 0, transition: "opacity 120ms", mt: 0.25 }}>
            <FormatQuoteIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      )}
      </Box>
      {metadata.length > 0 && (
        <Typography component="time" dateTime={message.created_at} color="text.disabled" sx={{ mt: 0.4, px: 0.5, fontSize: 10.5 }}>
          {metadata.join(" · ")}
        </Typography>
      )}
    </Box>
  );
}
