import { Stack, Tooltip } from "@mui/material";
import {
  storytellerPaletteMeta,
  type StorytellerPaletteName,
} from "@/data/storytellerTheme.ts";
import { useStorytellerPalette } from "@/layouts/storytellerPaletteMode.tsx";

// 照色相排成一圈色環的順序（黃銅→青銅→孔雀石→銅綠→鋼鐵→鈷藍→紫銅→紅銅），
// 無色相的墨黑／銀白放最後。
const paletteOrder: StorytellerPaletteName[] = [
  "brass",
  "bronze",
  "malachite",
  "verdigris",
  "steel",
  "cobalt",
  "violetCopper",
  "roseCopper",
  "inkBlack",
  "silver",
  "plainWhite",
];

/** 頁尾下方的色系切換器——同一套齒輪／鉚釘機構，只換色溫。 */
export function SteamPaletteSwitcher() {
  const { palette, setPalette } = useStorytellerPalette();
  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      justifyContent="center"
      sx={{ py: 2 }}
    >
      {paletteOrder.map((name) => {
        const meta = storytellerPaletteMeta[name];
        const isActive = palette === name;
        return (
          <Tooltip key={name} title={meta.label}>
            <Stack
              component="button"
              type="button"
              onClick={() => setPalette(name)}
              aria-label={`切換為${meta.label}色系`}
              aria-pressed={isActive}
              sx={{
                width: 22,
                height: 22,
                p: 0,
                border: "2px solid",
                borderColor: isActive ? "text.primary" : "divider",
                borderRadius: "50%",
                bgcolor: meta.swatch,
                cursor: "pointer",
                outlineOffset: 2,
                transform: isActive ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.15s ease, border-color 0.15s ease",
              }}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
