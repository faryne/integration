import { Box, Button, Collapse } from "@mui/material";
import { useState } from "react";
import { StorytellerMarkdown } from "@/pages/storyteller/StorytellerMarkdown.tsx";

// 作者自介：超過門檻就先收合，作者頁、追蹤卡片共用
const BIO_COLLAPSE_THRESHOLD = 160;

export function AuthorBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = bio.length > BIO_COLLAPSE_THRESHOLD;

  return (
    <Box>
      <Collapse in={expanded || !isLong} collapsedSize={64}>
        <Box sx={{ "& p": { mt: 0, mb: 1 }, "& p:last-child": { mb: 0 } }}>
          <StorytellerMarkdown>{bio}</StorytellerMarkdown>
        </Box>
      </Collapse>
      {isLong && (
        <Button
          size="small"
          onClick={() => setExpanded((value) => !value)}
          sx={{ mt: 0.5, minWidth: 0, px: 0 }}
        >
          {expanded ? "收合簡介" : "顯示完整簡介"}
        </Button>
      )}
    </Box>
  );
}
