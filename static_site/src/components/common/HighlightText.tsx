import { Box } from "@mui/material";

/** 把文字裡第一個符合關鍵字的地方（不分大小寫）加上底色；沒有關鍵字或找不到就原樣顯示 */
export function HighlightText({
  text,
  keyword,
}: {
  text: string;
  keyword?: string;
}) {
  const index = keyword
    ? text.toLowerCase().indexOf(keyword.toLowerCase())
    : -1;
  if (!keyword || index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <Box
        component={"mark"}
        sx={{
          bgcolor: "warning.light",
          color: "inherit",
          borderRadius: 0.25,
          px: 0.125,
        }}
      >
        {text.slice(index, index + keyword.length)}
      </Box>
      {text.slice(index + keyword.length)}
    </>
  );
}
