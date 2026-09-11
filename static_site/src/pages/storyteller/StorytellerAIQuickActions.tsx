import { Button, Stack } from "@mui/material";

const AI_QUICK_ACTIONS = [
  ["改寫", "/rewrite "],
  ["擴寫", "/expand "],
  ["縮短", "/rewrite 請縮短內容，保留必要資訊。"],
  ["調整語氣", "/rewrite 請調整語氣："],
] as const;

export function StorytellerAIQuickActions({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {AI_QUICK_ACTIONS.map(([label, prompt]) => (
        <Button
          key={label}
          size="small"
          variant="outlined"
          onClick={() => onSelect(prompt)}
        >
          {label}
        </Button>
      ))}
    </Stack>
  );
}
