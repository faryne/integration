import { Alert, Box, Container, Grid, Paper, Typography } from "@mui/material";
import { useState } from "react";

import { useTitle } from "@/helpers/title.tsx";

import { StorytellerWysiwygMarkdown } from "./StorytellerWysiwygMarkdown";
import { StorytellerWysiwygEditor } from "./StorytellerWysiwygEditor";

// 刻意不帶 marker 記號，用來驗證載入舊資料（尚未跑過 marker 遷移）時會自動補上 id。
// 一行 = 一個段落（要跟書籤 line_index／版本 diff 的逐行索引對齊），所以這裡用單一 \n 接。
// 對齊是 marker 屬性、不是行首前綴，需要先有 marker 才能表示，這份沒帶 marker 的舊資料
// 沒辦法示範對齊——請直接用編輯區的置中按鈕試試看。
const SAMPLE_MARKDOWN = [
  "# 這是標題 1 範例",
  "## 這是標題 2 範例，一樣支援 **粗體** *斜體* 等行內樣式",
  "歡迎使用所見即所得編輯器 Demo。試試看 **粗體**、*斜體*、++底線++、H~2~O 下標、x^2^ 上標。",
  "試試看工具列的置左/置中/置右按鈕，對齊設定會存成 marker 上的 align 屬性。",
  "這段句子中間刻意寫了 # 字元 跟 - 清單語法，因為標題語法只認「行首」的 #，這裡不在行首，應該原封不動顯示成純文字，不會被渲染成標題或清單。",
].join("\n");

/**
 * 這個 demo 頁只負責展示編輯器+預覽並排的效果，實際的編輯器/工具列/註解機制
 * 都在 StorytellerWysiwygEditor.tsx（跟 StoryEditor.tsx／LoreEditor.tsx 共用同一份元件，
 * 避免每個地方各自維護一份幾乎一樣的 Tiptap 設定/工具列程式碼）。
 */
export function WysiwygDemo() {
  useTitle("所見即所得編輯器 Demo - Storyteller", {
    path: "/storyteller/wysiwyg-demo",
    robots: "noindex, nofollow",
  });

  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        所見即所得編輯器 Demo
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        這是第一階段的獨立測試頁面，不會讀寫任何故事/設定集資料。只用來驗證語法白名單、段落
        marker 機制與中文輸入法相容性。
      </Alert>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            編輯區（右鍵點段落可以加註解／編輯註解／移除註解）
          </Typography>
          <StorytellerWysiwygEditor value={markdown} onChange={setMarkdown} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            預覽區（重新解析序列化後的 markdown，模擬未來的閱讀頁）
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, minHeight: 320 }}>
            <StorytellerWysiwygMarkdown>{markdown}</StorytellerWysiwygMarkdown>
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
          / right、行首 # 到 ###### 標題。不在此清單內的語法（清單、連結、表格、程式碼區塊等）一律以純文字顯示。
        </Typography>
      </Box>
    </Container>
  );
}
