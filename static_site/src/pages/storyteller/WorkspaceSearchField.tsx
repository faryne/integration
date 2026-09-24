import SearchIcon from "@mui/icons-material/Search";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import { useState } from "react";
import { STORYTELLER_WORKSPACE_SEARCH_KEYWORD_LIMIT } from "@/apis/storyteller.ts";
import { ShortcutHint } from "@/components/common/ShortcutHint.tsx";

/**
 * 側欄頂端的工作台搜尋入口：輸入後按 Enter 或放大鏡，把關鍵字交給搜尋對話框。
 * 送出後清空，避免關閉對話框後側欄與對話框顯示兩份不同的關鍵字。
 */
export function WorkspaceSearchField({
  onSubmit,
}: {
  onSubmit: (keyword: string) => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    onSubmit(value.trim());
    setValue("");
  }

  return (
    <Box sx={{ px: 1, pt: 1 }}>
      <TextField
        size="small"
        fullWidth
        value={value}
        placeholder="搜尋此專案……"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // 注音／倉頡選字的 Enter 不能當成送出。
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
        slotProps={{
          htmlInput: {
            maxLength: STORYTELLER_WORKSPACE_SEARCH_KEYWORD_LIMIT,
            "aria-label": "搜尋此專案",
          },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                {!value && (
                  <Box
                    component="span"
                    sx={{ color: "text.disabled", mr: 0.5, lineHeight: 1 }}
                  >
                    <ShortcutHint shortcutKey="K" />
                  </Box>
                )}
                <IconButton
                  size="small"
                  edge="end"
                  aria-label="送出搜尋"
                  onClick={submit}
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
