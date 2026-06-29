import CloseIcon from "@mui/icons-material/Close";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { type ReactNode, useState } from "react";
import { allowedHtmlBlockRules } from "@/pages/storyteller/storytellerMarkdownRules.ts";

interface StorytellerMarkdownSyntaxDrawerProps {
  trigger?: (openDrawer: () => void) => ReactNode;
}

const markdownSyntaxGroups = [
  {
    title: "Markdown",
    items: [
      { label: "標題", syntax: "# 標題\n## 次標題" },
      { label: "粗體", syntax: "**粗體文字**" },
      { label: "斜體", syntax: "*斜體文字*" },
      { label: "刪除線", syntax: "~~刪除線文字~~" },
      { label: "連結", syntax: "[連結文字](https://example.com)" },
      { label: "引用", syntax: "> 引用文字" },
      { label: "項目清單", syntax: "- 項目\n- 項目" },
      { label: "編號清單", syntax: "1. 第一項\n2. 第二項" },
      { label: "待辦清單", syntax: "- [ ] 未完成\n- [x] 已完成" },
      { label: "程式碼", syntax: "`inline code`\n\n```ts\nconst value = 1;\n```" },
      { label: "表格", syntax: "| 欄位 | 欄位 |\n| --- | --- |\n| 內容 | 內容 |" },
    ],
  },
  // HTML-like 語法直接從 renderer 白名單產生，避免說明與實際支援範圍不一致。
  {
    title: "允許的 HTML-like 語法",
    items: allowedHtmlBlockRules.map((rule) => ({
      description: rule.description,
      label: rule.label,
      syntax: rule.syntaxExamples.join("\n\n"),
    })),
  },
];

export function StorytellerMarkdownSyntaxDrawer({
  trigger,
}: StorytellerMarkdownSyntaxDrawerProps) {
  const [open, setOpen] = useState(false);
  const openDrawer = () => setOpen(true);

  return (
    <>
      {trigger ? (
        trigger(openDrawer)
      ) : (
        <Tooltip title="Markdown 語法">
          <IconButton aria-label="Markdown 語法" size="small" onClick={openDrawer}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: { xs: 320, sm: 420 }, maxWidth: "92vw", p: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography variant="h6" fontWeight={800}>
                Markdown 語法
              </Typography>
              <IconButton aria-label="關閉" onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              支援標準 Markdown 與 GFM 語法。HTML-like 語法只允許下方列出的簡單格式。
            </Typography>
            <Divider />
            {markdownSyntaxGroups.map((group) => (
              <Stack key={group.title} spacing={1.25}>
                <Typography fontWeight={800}>{group.title}</Typography>
                {group.items.map((item) => (
                  <Stack key={item.label} spacing={0.5}>
                    <Typography variant="body2" fontWeight={700}>
                      {item.label}
                    </Typography>
                    {"description" in item && item.description ? (
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                    ) : null}
                    <Box
                      component="pre"
                      sx={{
                        bgcolor: "action.hover",
                        borderRadius: 1,
                        fontFamily:
                          '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                        fontSize: 13,
                        m: 0,
                        overflowX: "auto",
                        p: 1,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {item.syntax}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            ))}
            <Divider />
            <Typography variant="body2" color="text.secondary">
              不支援任意 HTML。像是 {"<script>"}、{"<iframe>"}、{"<link>"} 等標籤會以文字顯示，不會執行。
            </Typography>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}

export function StorytellerMarkdownSyntaxLink() {
  return (
    <StorytellerMarkdownSyntaxDrawer
      trigger={(openDrawer) => (
        <Button size="small" variant="text" onClick={openDrawer}>
          查看可使用的 Markdown / HTML-like 語法
        </Button>
      )}
    />
  );
}
