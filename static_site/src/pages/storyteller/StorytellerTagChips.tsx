import SellIcon from "@mui/icons-material/Sell";
import { Chip, Stack, type SxProps, type Theme } from "@mui/material";

export function StorytellerTagChips({
  tags,
  sx,
}: {
  tags?: string[];
  sx?: SxProps<Theme>;
}) {
  if (!tags || tags.length === 0) {
    return null;
  }
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={sx}>
      {tags.map((tag) => (
        <Chip
          key={tag}
          size="small"
          variant="outlined"
          icon={<SellIcon fontSize="small" />}
          label={`${tag}`}
        />
      ))}
    </Stack>
  );
}
