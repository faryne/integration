import type { ReactNode } from "react";
import { Box } from "@mui/material";
import Markdown from "react-markdown";
import remarkCjkFriendly from "remark-cjk-friendly";
import remarkGfm from "remark-gfm";

// 討論版留言的 Markdown：只留段落、粗斜體、刪除線、清單、引用、程式碼。
// 不掛 rehype-raw，HTML 不會被解析；不產生任何連結（網址只當純文字，[文字](網址) 顯示成「文字（網址）」，網址藏不住）；
// 圖片只顯示替代文字、標題當一般段落、表格攤平成文字

const text = (children?: ReactNode) => <>{children}</>;

const components = {
  a: ({ href, children }: { href?: string; children?: ReactNode }) => {
    // GFM 會把裸網址也變成連結，這時文字就是網址本身，不用再括一次
    const label = typeof children === "string" ? children : undefined;
    return (
      <>
        {children}
        {href && label !== href && `（${href}）`}
      </>
    );
  },
  img: ({ alt }: { alt?: string }) => <>{alt}</>,
  h1: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  h2: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  h3: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  h4: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  h5: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  h6: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  table: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  thead: ({ children }: { children?: ReactNode }) => text(children),
  tbody: ({ children }: { children?: ReactNode }) => text(children),
  tr: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  th: ({ children }: { children?: ReactNode }) => <span>{children} </span>,
  td: ({ children }: { children?: ReactNode }) => <span>{children} </span>,
};

export function CommentMarkdown({ children }: { children: string }) {
  return (
    <Box
      sx={{
        fontSize: 14,
        lineHeight: 1.75,
        overflowWrap: "anywhere",
        // 留言裡按 Enter 就是換行（Markdown 預設會把單一換行合併成空白）
        "& p, & li": { whiteSpace: "pre-line" },
        "& p": { my: 0.5 },
        "& ul, & ol": { my: 0.5, pl: 3 },
        "& blockquote": {
          borderLeft: "3px solid",
          borderColor: "divider",
          color: "text.secondary",
          mx: 0,
          my: 0.5,
          pl: 1.5,
        },
        "& code": {
          bgcolor: "action.hover",
          borderRadius: 0.5,
          fontSize: 13,
          px: 0.5,
        },
        "& pre": {
          bgcolor: "action.hover",
          borderRadius: 1,
          overflowX: "auto",
          p: 1,
        },
        "& pre code": { bgcolor: "transparent", px: 0 },
      }}
    >
      <Markdown
        components={components}
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
        skipHtml
      >
        {children}
      </Markdown>
    </Box>
  );
}
