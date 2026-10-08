import { Box, Button, Link } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Fragment, useState, type KeyboardEvent, type MouseEvent } from "react";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { setAgeConfirmed, useAgeConfirmed } from "@/helpers/ageConfirmation.ts";
import {
  POST_MARKER_LABEL,
  parsePostBody,
  splitUrls,
  type PostMarkerKind,
} from "@/helpers/postMarkers.ts";

// 動態／留言內文：保留換行、網址自動連結，[spoiler]／[r18] 標記摺成「點擊顯示」。
// R18 沿用全站年齡確認 cookie：沒確認過先跳確認，確認後才展開（同時解鎖限制級封面）。

function LinkedText({ text }: { text: string }) {
  return (
    <>
      {splitUrls(text).map((part, index) =>
        part.url ? (
          <Link
            key={index}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(event) => event.stopPropagation()}
            sx={{ overflowWrap: "anywhere" }}
          >
            {part.text}
          </Link>
        ) : (
          <Fragment key={index}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

export function PostMarkerText({
  body,
  fontSize = 15,
}: {
  body: string;
  fontSize?: number;
}) {
  const ageConfirmed = useAgeConfirmed();
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [pendingR18, setPendingR18] = useState<number | null>(null);
  const reveal = (index: number) =>
    setRevealed((prev) => new Set(prev).add(index));

  function handleReveal(
    event: MouseEvent | KeyboardEvent,
    index: number,
    kind: PostMarkerKind,
  ) {
    // 卡片整張可點（進貼文頁），點標記只展開、不跳頁
    event.stopPropagation();
    event.preventDefault();
    if (kind === "r18" && !ageConfirmed) setPendingR18(index);
    else reveal(index);
  }

  return (
    <Box
      component="div"
      sx={{
        fontSize,
        lineHeight: 1.75,
        whiteSpace: "pre-line",
        overflowWrap: "anywhere",
      }}
    >
      {parsePostBody(body).map((segment, index) =>
        segment.type === "text" ? (
          <LinkedText key={index} text={segment.text} />
        ) : revealed.has(index) ? (
          <Box
            key={index}
            component="span"
            sx={{ px: 0.5, borderRadius: 0.75, bgcolor: "action.hover" }}
          >
            <LinkedText text={segment.text} />
          </Box>
        ) : (
          <Box
            key={index}
            component="span"
            role="button"
            tabIndex={0}
            aria-label={`顯示${POST_MARKER_LABEL[segment.type]}內容`}
            onClick={(event) => handleReveal(event, index, segment.type)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ")
                handleReveal(event, index, segment.type);
            }}
            sx={(theme) => {
              const color =
                segment.type === "r18"
                  ? theme.palette.error.main
                  : theme.palette.text.secondary;
              return {
                display: "inline",
                px: 0.75,
                py: 0.125,
                mx: 0.25,
                borderRadius: 0.75,
                border: `1px dashed ${alpha(color, 0.6)}`,
                bgcolor: alpha(color, 0.08),
                color,
                fontSize: "0.9em",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                "&:hover": { bgcolor: alpha(color, 0.16) },
              };
            }}
          >
            {segment.type === "r18" ? "🔞" : "🙈"}{" "}
            {POST_MARKER_LABEL[segment.type]}・點擊顯示
          </Box>
        ),
      )}
      {/* Dialog 走 portal，但 React 事件仍會冒泡到外層可點的貼文卡，這裡擋下來 */}
      <Box component="span" onClick={(event) => event.stopPropagation()}>
        <StorytellerDialog
          open={pendingR18 !== null}
          eyebrow="年齡確認"
          title="這段內容含限制級描寫"
          description="確認你已年滿 18 歲才會顯示。確認後，全站的限制級封面與 R18 標籤都會解鎖。"
          onClose={() => setPendingR18(null)}
          actions={
            <>
              <Button onClick={() => setPendingR18(null)}>先不要</Button>
              <Button
                color="error"
                variant="contained"
                onClick={() => {
                  setAgeConfirmed();
                  if (pendingR18 !== null) reveal(pendingR18);
                  setPendingR18(null);
                }}
              >
                我已滿 18 歲
              </Button>
            </>
          }
        />
      </Box>
    </Box>
  );
}
