import { Box, Button, Link, Stack, Typography } from "@mui/material";
import { useMemo, useState } from "react";

const urlPattern = /(https?:\/\/[^\s<>"'）)]+)/g;

function linkedText(text: string) {
  return text.split(urlPattern).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <Link
        key={`${part}-${index}`}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ overflowWrap: "anywhere" }}
      >
        {part}
      </Link>
    ) : (
      part
    ),
  );
}

export function ExpandableText({
  text,
  collapsedLines = 6,
}: {
  text: string;
  collapsedLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 360 || text.split("\n").length > collapsedLines;
  const content = useMemo(() => linkedText(text), [text]);

  return (
    <Stack spacing={1} alignItems="flex-start">
      <Box
        sx={
          !expanded && isLong
            ? {
                display: "-webkit-box",
                overflow: "hidden",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: collapsedLines,
              }
            : undefined
        }
      >
        <Typography component="div" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {content}
        </Typography>
      </Box>
      {isLong && (
        <Button size="small" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收合介紹" : "展開完整介紹"}
        </Button>
      )}
    </Stack>
  );
}
