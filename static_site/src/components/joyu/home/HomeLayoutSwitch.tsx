import { Stack, ToggleButton, ToggleButtonGroup } from "@mui/material";

import { ScoreRating } from "@/components/common/ScoreRating.tsx";

import { type HomeLayout, useHomeLayoutRating } from "./homeLayout.ts";

/**
 * 首頁右上角（手機在最下面）：這個版面的評分＋新版／原版切換。
 * 評分與切換都記成 GA 事件，不另外存後端
 */
export function HomeLayoutSwitch({
  layout,
  onChange,
}: {
  layout: HomeLayout;
  onChange: (next: HomeLayout) => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: "center", flexShrink: 0, justifyContent: "flex-end" }}
    >
      {/* key：切換版面時重新判斷新版面評過分沒 */}
      <LayoutRating key={layout} layout={layout} />
      <ToggleButtonGroup
        exclusive
        onChange={(_, v: HomeLayout | null) => v && onChange(v)}
        size="small"
        value={layout}
      >
        <ToggleButton sx={{ px: 1.25, py: 0.25 }} value="compact">
          新版
        </ToggleButton>
        <ToggleButton sx={{ px: 1.25, py: 0.25 }} value="classic">
          原版
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

/** 每個版面在同一台瀏覽器只問一次：評過就不渲染評分元件 */
function LayoutRating({ layout }: { layout: HomeLayout }) {
  const { rated, rate } = useHomeLayoutRating(layout);
  return rated ? null : <ScoreRating onScore={rate} titleText="這個版面幾分" />;
}
