import { Button, Stack, TextField, Typography } from "@mui/material";
import { useRef, type ReactNode } from "react";
import {
  wrapTextareaSelection,
  type PostMarkerKind,
} from "@/helpers/postMarkers.ts";

// 發文框與留言框共用的輸入區：多行文字、劇透／R18 標記按鈕、字數計數。
// 標記本身也算字數（跟後端一致）。extraTools 放在標記按鈕後面（附上作品、預覽）。
export function PostTextInput({
  value,
  onChange,
  maxLength,
  placeholder,
  minRows = 3,
  extraTools,
  footer,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder: string;
  minRows?: number;
  extraTools?: ReactNode;
  // 右下角的送出按鈕等
  footer: ReactNode;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const length = [...value].length;

  function wrap(kind: PostMarkerKind) {
    const textarea = inputRef.current;
    if (!textarea) return;
    const next = wrapTextareaSelection(textarea, kind);
    onChange(next.value);
    // 等 React 把新值寫回 textarea 後再選起標記裡的文字
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(next.selectionStart, next.selectionEnd);
    });
  }

  return (
    <Stack spacing={1}>
      <TextField
        multiline
        minRows={minRows}
        fullWidth
        value={value}
        placeholder={placeholder}
        inputRef={inputRef}
        onChange={(event) => onChange(event.target.value)}
      />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        useFlexGap
        spacing={1}
      >
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            title="選取文字後按，包成劇透"
            onClick={() => wrap("spoiler")}
          >
            🙈 劇透
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            title="選取文字後按，包成限制級"
            onClick={() => wrap("r18")}
          >
            🔞 R18
          </Button>
          {extraTools}
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Typography
            variant="caption"
            color={length > maxLength ? "error" : "text.disabled"}
            fontWeight={length > maxLength ? 800 : 400}
          >
            {length} / {maxLength}
          </Typography>
          {footer}
        </Stack>
      </Stack>
    </Stack>
  );
}
