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
