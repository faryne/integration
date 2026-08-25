import { Box } from "@mui/material";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { storytellerMarkdownSegments } from "@/pages/storyteller/storytellerMarkdownRules.ts";

interface StorytellerMarkdownProps {
  children: string;
}

function markdownComponents() {
  return {
    // 對話內容裡的連結一律開新分頁——最常見的來源是 @thisStory／@story:[...]
    // 這類引用被 linkifyStorytellerAgentReferenceTokens 轉成真連結（見呼叫端），
    // 點下去應該是「另外開一頁去看那篇」，不是在聊天面板裡整頁跳走。
    // 顏色故意用 inherit 不寫死：這個元件會被套進使用者訊息泡泡（深色底、淺色
    // 字）跟 AI 訊息泡泡（淺色底、深色字）兩種完全相反的配色，寫死任何一個固定色
    // 都會在另一種情境下跟底色疊在一起看不見——靠底線＋粗體做出「這是連結」的
    // 視覺區隔，文字顏色永遠跟隨當下泡泡本來就設定好、對比一定夠的顏色。
    a: ({ href, children }: { href?: string; children?: ReactNode }) => (
      <Box
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: "inherit",
          fontWeight: 700,
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        }}
      >
        {children}
      </Box>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <Box sx={{ overflowX: "auto", my: 2 }}>
        <Box
          component="table"
          sx={{
            borderCollapse: "collapse",
            minWidth: "100%",
            "& th, & td": {
              border: "1px solid",
              borderColor: "divider",
              px: 1.25,
              py: 0.75,
              textAlign: "left",
              verticalAlign: "top",
            },
            "& th": {
              bgcolor: "action.hover",
              fontWeight: 800,
            },
          }}
        >
          {children}
        </Box>
      </Box>
    ),
  };
}

function MarkdownContent({ children }: StorytellerMarkdownProps) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents()}>
      {children}
    </Markdown>
  );
}

export function StorytellerMarkdown({ children }: StorytellerMarkdownProps) {
  return (
    <>
      {storytellerMarkdownSegments(children).map((segment, index) =>
        segment.align ? (
          <Box key={index} sx={{ textAlign: segment.align }}>
            <MarkdownContent>{segment.content}</MarkdownContent>
          </Box>
        ) : segment.subscript ? (
          <Box key={index} component="sub">
            {segment.content}
          </Box>
        ) : (
          <MarkdownContent key={index}>{segment.content}</MarkdownContent>
        ),
      )}
    </>
  );
}
