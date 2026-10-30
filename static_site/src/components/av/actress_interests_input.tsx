import { useState } from "react";
import { Chip, Stack, TextField } from "@mui/material";

/** 興趣：輸入後按 Enter 加入，點 × 移除；baseItems 有給時（修改模式）新加的標色 */
export function ActressInterestsInput({
  items,
  baseItems,
  onChange,
}: {
  items: string[];
  baseItems?: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft("");
  };

  return (
    <Stack spacing={1}>
      <TextField
        label="興趣（Enter 新增）"
        onChange={(e) => setDraft(e.target.value)}
        // Enter 只加入興趣，不送出整張表單
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        size="small"
        value={draft}
      />
      {items.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {items.map((item) => (
            <Chip
              color={
                baseItems && !baseItems.includes(item) ? "success" : "default"
              }
              key={item}
              label={item}
              onDelete={() => onChange(items.filter((i) => i !== item))}
              size="small"
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
