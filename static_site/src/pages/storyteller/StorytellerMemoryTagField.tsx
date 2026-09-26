import { Autocomplete, Chip, TextField } from "@mui/material";
import { useState } from "react";

const maxTagCount = 8;
const maxTagLength = 24;

export function StorytellerMemoryTagField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  return (
    <Autocomplete
      multiple
      freeSolo
      fullWidth
      options={[]}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, nextInputValue, reason) => {
        if (reason === "input" && /[,，]/.test(nextInputValue)) {
          const segments = nextInputValue.split(/[,，]/);
          const remainder = segments.pop() ?? "";
          onChange(normalizeMemoryTags([...value, ...segments]));
          setInputValue(remainder.trimStart());
          return;
        }
        setInputValue(nextInputValue);
      }}
      onChange={(_, nextValue) => onChange(normalizeMemoryTags(nextValue))}
      renderTags={(tags, getTagProps) =>
        tags.map((tag, index) => (
          <Chip
            {...getTagProps({ index })}
            key={tag}
            label={tag}
            size="small"
            variant="outlined"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="標籤"
          placeholder={value.length === 0 ? "角色口吻, 世界觀, 待確認" : ""}
          helperText={`輸入後按 Enter，或用逗號分隔；最多 ${maxTagCount} 個，每個最多 ${maxTagLength} 字。`}
        />
      )}
    />
  );
}

function normalizeMemoryTags(tags: string[]) {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.trim())
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();
      if (!tag || tag.length > maxTagLength || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxTagCount);
}
