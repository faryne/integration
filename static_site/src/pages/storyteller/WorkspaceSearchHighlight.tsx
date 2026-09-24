import { Box } from "@mui/material";

function escapeRegexp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 直接切成 React nodes，不使用 innerHTML，搜尋私人草稿時不讓內容成為注入來源。
export function HighlightedSearchText({
  text,
  keyword,
}: {
  text: string;
  keyword: string;
}) {
  const value = keyword.trim();
  if (!value) return text;
  const parts = text.split(new RegExp(`(${escapeRegexp(value)})`, "gi"));
  return (
    <>
      {parts.map((part, index) =>
        index % 2 ? (
          <Box
            component="mark"
            key={`${index}-${part}`}
            sx={(theme) => ({
              bgcolor: "warning.light",
              color: theme.palette.getContrastText(theme.palette.warning.light),
              px: 0.15,
            })}
          >
            {part}
          </Box>
        ) : (
          part
        ),
      )}
    </>
  );
}
