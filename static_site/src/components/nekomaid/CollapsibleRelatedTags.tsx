import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";

export function CollapsibleRelatedTags({ tags }: { tags: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const collapsedLimit = 12;
  const visibleTags = expanded ? tags : tags.slice(0, collapsedLimit);
  const canCollapse = tags.length > collapsedLimit;

  if (tags.length === 0) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
      <Stack spacing={1.5}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
        >
          <Box>
            <Typography fontWeight={900}>相關 tag</Typography>
            <Typography color="text.secondary" variant="body2">
              從目前搜尋結果整理出的可延伸搜尋條件。
            </Typography>
          </Box>
          {canCollapse && (
            <Button
              endIcon={
                <ExpandMoreIcon
                  sx={{
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 160ms ease",
                  }}
                />
              }
              onClick={() => setExpanded((prev) => !prev)}
              size="small"
              variant="text"
            >
              {expanded ? "收合" : `展開 ${tags.length} 個`}
            </Button>
          )}
        </Stack>

        <Box
          sx={{
            maxHeight: expanded ? "none" : 92,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {visibleTags.map((item) => (
              <Chip
                key={item}
                label={item}
                component={RouterLink}
                to={`/nekomaid?tag=${encodeURIComponent(item)}`}
                clickable
              />
            ))}
          </Stack>
          {!expanded && canCollapse && (
            <Box
              sx={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0), #fff)",
                bottom: 0,
                height: 28,
                left: 0,
                pointerEvents: "none",
                position: "absolute",
                right: 0,
              }}
            />
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
