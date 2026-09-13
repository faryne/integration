import SellIcon from "@mui/icons-material/Sell";
import { Chip, Stack, type SxProps, type Theme } from "@mui/material";

export function StorytellerTagChips({
  tags,
  limit,
  sx,
}: {
  tags?: string[];
  limit?: number;
  sx?: SxProps<Theme>;
}) {
  if (!tags || tags.length === 0) {
    return null;
  }
  const visibleTags = limit ? tags.slice(0, limit) : tags;
  const hiddenCount = tags.length - visibleTags.length;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={sx}>
      {visibleTags.map((tag) => (
        <Chip
          key={tag}
          size="small"
          variant="outlined"
          icon={<SellIcon fontSize="small" />}
          label={`${tag}`}
        />
      ))}
      {hiddenCount > 0 && (
        <Chip size="small" variant="outlined" label={`+${hiddenCount}`} />
      )}
    </Stack>
  );
}
