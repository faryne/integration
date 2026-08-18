import CelebrationIcon from "@mui/icons-material/Celebration";
import { Stack, Tooltip } from "@mui/material";
import {
  storytellerSeasonalThemes,
  type StorytellerSeasonId,
} from "@/data/storytellerSeasonalTheme.ts";
import { useStorytellerSeason } from "@/layouts/storytellerSeasonalMode.tsx";

// "none" 不需要獨立按鈕——每個節慶按鈕本身就是「點一下切換 active/inactive」
// 的 toggle，再點一次已啟用的節慶就是關掉（回到 none），不需要另外一顆「關閉」
// 按鈕。目前只有 1 個示範節慶（中秋節），之後加新節慶只是加資料，這裡不用改。
const seasonOrder: StorytellerSeasonId[] = Object.keys(
  storytellerSeasonalThemes,
).filter(
  (id): id is StorytellerSeasonId => id !== "none",
) as StorytellerSeasonId[];

/** 頁尾下方的節慶主題開關——跟 SteamPaletteSwitcher 同一排，只影響裝飾性強調
 * 色，不影響色系本身（兩者疊加：base 色系 + 節慶 overlay）。 */
export function SteamSeasonalSwitcher() {
  const { season, setSeason } = useStorytellerSeason();
  if (seasonOrder.length === 0) {
    return null;
  }
  return (
    <Stack
      direction="row"
      spacing={1}
      flexWrap="wrap"
      useFlexGap
      justifyContent="center"
      sx={{ pb: 2 }}
    >
      {seasonOrder.map((id) => {
        const theme = storytellerSeasonalThemes[id];
        const isActive = season === id;
        return (
          <Tooltip
            key={id}
            title={
              isActive
                ? `關閉「${theme.label}」主題`
                : `切換為「${theme.label}」主題`
            }
          >
            <Stack
              component="button"
              type="button"
              onClick={() => setSeason(isActive ? "none" : id)}
              aria-label={
                isActive ? `關閉${theme.label}主題` : `切換為${theme.label}主題`
              }
              aria-pressed={isActive}
              direction="row"
              alignItems="center"
              spacing={0.5}
              sx={{
                px: 1.25,
                py: 0.5,
                border: "1px solid",
                borderColor: isActive ? "primary.main" : "divider",
                borderRadius: 999,
                bgcolor: isActive ? "action.selected" : "transparent",
                color: isActive ? "primary.main" : "text.secondary",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
                transition:
                  "background-color 0.15s ease, border-color 0.15s ease",
              }}
            >
              <CelebrationIcon fontSize="inherit" />
              <span>{theme.label}</span>
            </Stack>
          </Tooltip>
        );
      })}
    </Stack>
  );
}
