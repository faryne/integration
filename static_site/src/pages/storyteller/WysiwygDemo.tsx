import { useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  StorytellerWysiwygEditor,
  type StorytellerWysiwygEditorHandle,
} from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";

// Phase -1 WYSIWYG Playground：只在 dev 環境掛載（見 App.tsx 的 import.meta.env.DEV 判斷），
// 不接 autosave／真實 story or lore API／DB，純粹用來隔離測試編輯器本身的互動與 marker 語法輸出。

const SAMPLE_CONTENTS: Record<string, string> = {
  "空白": "",
  "基本語法": [
    "# ⟦p1⟧序章：齒輪之城⟦/p1⟧",
    "⟦p2⟧這是一段**粗體**與*斜體*混用的敘述文字，還有⟦span-c1 textColor=\"red\" bgColor=\"yellow\"⟧上色文字⟦/span-c1⟧。⟦/p2⟧",
    "⟦p3⟧這裡有個⟦footnote-f1 note=\"這是腳注的補充說明，可以用**粗體**。\"⟧腳注標記詞⟦/footnote-f1⟧，還有一段⟦comment-r1 comment=\"這段之後要再潤一次\" commentColor=\"pink\"⟧被人加了註解的句子⟦/comment-r1⟧。⟦/p3⟧",
    "> ⟦p4⟧這是一段引用文字。⟦/p4⟧",
    "- ⟦p5⟧清單項目一⟦/p5⟧",
    "1. ⟦p6⟧有序清單項目⟦/p6⟧",
    "⟦p7⟧![城堡插畫](steamloom-asset://demo-asset-001)⟦/p7⟧",
    '⟦p9 align="center"⟧置中對齊的段落⟦/p9⟧',
  ].join("\n"),
  "舊表格（table-row）": [
    "|⟦t1⟧角色|任務|狀態⟦/t1⟧",
    "|⟦t2⟧莉亞|偵查|完成⟦/t2⟧",
    "|⟦t3⟧米菈|支援|取消⟦/t3⟧",
  ].join("\n"),
  "行內樣式測試": [
    "⟦s1⟧++底線++、~下標~、^上標^、--刪除線--（若尚未支援會顯示原字）⟦/s1⟧",
  ].join("\n"),
};

export default function WysiwygDemo() {
  const [content, setContent] = useState(SAMPLE_CONTENTS["基本語法"]);
  const [selectedSample, setSelectedSample] = useState("基本語法");
  const [assetPublicId, setAssetPublicId] = useState("demo-asset-002");
  const editorRef = useRef<StorytellerWysiwygEditorHandle>(null);

  function handleSampleChange(name: string) {
    setSelectedSample(name);
    setContent(SAMPLE_CONTENTS[name] ?? "");
  }

  function handleInsertAsset() {
    const inserted = editorRef.current?.insertAsset({
      publicId: assetPublicId,
      alt: "demo 插入的資產",
    });
    // eslint-disable-next-line no-console
    console.log("insertAsset result:", inserted);
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" gutterBottom>
        Storyteller WYSIWYG Playground（Phase -1，僅限 dev 環境）
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        掛載正式的 StorytellerWysiwygEditor
        元件，本地 state 管理內容，不接 autosave／真實 API／DB。用來驗證
        Phase 0–5 的編輯器改動。
      </Typography>

      <Stack direction="row" spacing={2} sx={{ my: 2 }} flexWrap="wrap">
        <TextField
          select
          size="small"
          label="Sample content"
          value={selectedSample}
          onChange={(e) => handleSampleChange(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {Object.keys(SAMPLE_CONTENTS).map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="假 asset publicId"
          value={assetPublicId}
          onChange={(e) => setAssetPublicId(e.target.value)}
        />
        <Button variant="outlined" onClick={handleInsertAsset}>
          呼叫 insertAsset()
        </Button>
      </Stack>

      <Box sx={{ border: "1px solid", borderColor: "divider", mb: 3 }}>
        <StorytellerWysiwygEditor
          ref={editorRef}
          value={content}
          onChange={setContent}
        />
      </Box>

      <Typography variant="subtitle2" gutterBottom>
        Raw content（serialized markdown-like 字串）
      </Typography>
      <TextField
        value={content}
        onChange={(e) => setContent(e.target.value)}
        multiline
        minRows={8}
        maxRows={20}
        fullWidth
        sx={{ fontFamily: "monospace" }}
        InputProps={{ sx: { fontFamily: "monospace", fontSize: 13 } }}
      />
    </Container>
  );
}
