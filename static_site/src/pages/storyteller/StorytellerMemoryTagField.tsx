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
  const [errorMessage, setErrorMessage] = useState("");

  function commitTags(nextValue: string[], invalidInput = "") {
    const normalized = normalizeMemoryTags(nextValue);
    const error = memoryTagValidationError(normalized);
    if (error) {
      setErrorMessage(error);
      if (invalidInput) setInputValue(invalidInput);
      return false;
    }
    setErrorMessage("");
    onChange(normalized);
    return true;
  }

  return (
    <Autocomplete
      multiple
      freeSolo
      fullWidth
      options={[]}
      value={value}
      inputValue={inputValue}
      onInputChange={(_, nextInputValue, reason) => {
        // freeSolo 建立選項時會另外送一次 reset；輸入值由下面的 commitTags 明確管理。
        if (reason === "reset") return;
        if (reason === "input" && /[,，]/.test(nextInputValue)) {
          const segments = nextInputValue.split(/[,，]/);
          const remainder = segments.pop() ?? "";
          if (
            commitTags(
              [...value, ...segments],
              segments
                .find((tag) => memoryTagLength(tag.trim()) > maxTagLength)
                ?.trim(),
            )
          ) {
            setInputValue(remainder.trimStart());
          }
          return;
        }
        setInputValue(nextInputValue);
        setErrorMessage(
          memoryTagLength(nextInputValue.trim()) > maxTagLength
            ? `每個標籤最多 ${maxTagLength} 字。`
            : "",
        );
      }}
      onChange={(_, nextValue, reason) => {
        const lastValue = nextValue.at(-1)?.trim() ?? "";
        if (commitTags(nextValue, lastValue) && reason === "createOption") {
          setInputValue("");
        }
      }}
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
          error={Boolean(errorMessage)}
          helperText={
            errorMessage ||
            `輸入後按 Enter，或用逗號分隔；最多 ${maxTagCount} 個，每個最多 ${maxTagLength} 字。`
          }
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
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function memoryTagValidationError(tags: string[]) {
  if (tags.some((tag) => memoryTagLength(tag) > maxTagLength)) {
    return `每個標籤最多 ${maxTagLength} 字。`;
  }
  if (tags.length > maxTagCount) return `最多只能加入 ${maxTagCount} 個標籤。`;
  return "";
}

function memoryTagLength(value: string) {
  return [...value].length;
}
