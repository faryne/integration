import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import SubscriptIcon from "@mui/icons-material/Subscript";
import SuperscriptIcon from "@mui/icons-material/Superscript";
import {
  Alert,
  Box,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useState } from "react";

import { useTitle } from "@/helpers/title.tsx";

import { markdownToDoc } from "./wysiwygDemo/parser";
import { Preview } from "./wysiwygDemo/Preview";
import { serializeDocToMarkdown } from "./wysiwygDemo/serializer";
import { ALIGNMENT_VALUES, type AlignmentValue } from "./wysiwygDemo/whitelist";
import { wysiwygDemoExtensions } from "./wysiwygDemo/extensions";

// 刻意不帶 marker 記號，用來驗證載入舊資料（尚未跑過 marker 遷移）時會自動補上 id。
const SAMPLE_MARKDOWN = [
  "歡迎使用所見即所得編輯器 Demo。試試看 **粗體**、*斜體*、++底線++、H~2~O 下標、x^2^ 上標。",
  "::: center\n這一段設定為置中對齊，可以在下面的原始碼區塊確認序列化結果。\n:::",
  "這段刻意打了 # 標題語法 跟 - 清單語法，因為都不在白名單內，應該原封不動顯示成純文字，不會被渲染成標題或清單。",
].join("\n\n");

export function WysiwygDemo() {
  useTitle("所見即所得編輯器 Demo - Storyteller", {
    path: "/storyteller/wysiwyg-demo",
    robots: "noindex, nofollow",
  });

  const [markdown, setMarkdown] = useState("");

  const editor = useEditor({
    extensions: wysiwygDemoExtensions,
    content: markdownToDoc(SAMPLE_MARKDOWN),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        style: "min-height: 320px; outline: none;",
      },
      // 白名單規則：不接受任何 HTML 內容。無論剪貼簿裡帶了什麼樣式，
      // 一律只取 text/plain 內容當純文字插入，貼上後格式跑掉是可接受的結果。
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text === "") return false;
        event.preventDefault();
        view.dispatch(view.state.tr.insertText(text));
        return true;
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      setMarkdown(serializeDocToMarkdown(updatedEditor.getJSON()));
    },
    onCreate: ({ editor: createdEditor }) => {
      setMarkdown(serializeDocToMarkdown(createdEditor.getJSON()));
    },
  });

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return {
          bold: false,
          italic: false,
          underline: false,
          subscript: false,
          superscript: false,
          align: "left" as AlignmentValue,
        };
      }
      const align =
        ALIGNMENT_VALUES.find((value) =>
          ctx.editor!.isActive({ textAlign: value }),
        ) ?? "left";
      return {
        bold: ctx.editor.isActive("bold"),
        italic: ctx.editor.isActive("italic"),
        underline: ctx.editor.isActive("underline"),
        subscript: ctx.editor.isActive("subscript"),
        superscript: ctx.editor.isActive("superscript"),
        align,
      };
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const activeMarks = [
    editorState.bold && "bold",
    editorState.italic && "italic",
    editorState.underline && "underline",
    editorState.subscript && "subscript",
    editorState.superscript && "superscript",
  ].filter(Boolean) as string[];

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        所見即所得編輯器 Demo
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        這是第一階段的獨立測試頁面，不會讀寫任何故事/設定集資料。只用來驗證語法白名單、段落
        marker 機制與中文輸入法相容性。
      </Alert>

      <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <ToggleButtonGroup
            size="small"
            value={activeMarks}
            onChange={() => {}}
          >
            <ToggleButton
              value="bold"
              selected={editorState.bold}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <FormatBoldIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="italic"
              selected={editorState.italic}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <FormatItalicIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="underline"
              selected={editorState.underline}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <FormatUnderlinedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="subscript"
              selected={editorState.subscript}
              onClick={() => editor.chain().focus().toggleSubscript().run()}
            >
              <SubscriptIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton
              value="superscript"
              selected={editorState.superscript}
              onClick={() => editor.chain().focus().toggleSuperscript().run()}
            >
              <SuperscriptIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup
            size="small"
            exclusive
            value={editorState.align}
            onChange={(_event, value: AlignmentValue | null) => {
              if (value) editor.chain().focus().setTextAlign(value).run();
            }}
          >
            <ToggleButton value="left">
              <FormatAlignLeftIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="center">
              <FormatAlignCenterIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="right">
              <FormatAlignRightIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            編輯區
          </Typography>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <EditorContent editor={editor} />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            預覽區（重新解析序列化後的 markdown，模擬未來的閱讀頁）
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
            <Preview markdown={markdown} />
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2 }}>
        序列化後的原始 markdown 字串（含段落 marker，供檢查白名單/marker 是否正確）
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mt: 1,
          fontFamily: "monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          fontSize: 13,
          maxHeight: 240,
          overflow: "auto",
        }}
      >
        {markdown}
      </Paper>

      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" color="text.secondary">
          白名單語法：**粗體**／__粗體__、*斜體*、++底線++、~下標~、^上標^、::: left / center
          / right。不在此清單內的語法（標題、清單、連結、表格、程式碼區塊等）一律以純文字顯示。
        </Typography>
      </Box>
    </Container>
  );
}
