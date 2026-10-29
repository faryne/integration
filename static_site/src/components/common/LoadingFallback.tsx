import { Box, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { isGalgameSite } from "@/helpers/galgame.ts";
import { MASCOT_ASSET_CDN_BASE } from "@/helpers/mascotAssets.ts";
import { isNekomaidSite } from "@/helpers/nekomaid.ts";
import {
  STORYTELLER_ASSISTANT_THINKING_GIF_SRC,
  storytellerMascotSrc,
} from "@/helpers/storytellerMascot.ts";
import { isSteamLoomSite } from "@/helpers/steamloom.ts";

type LoadingSite = "faryne" | "nekomaid" | "galgame" | "steamloom";
type MainSite = Exclude<LoadingSite, "steamloom">;

const loadingContent: Record<
  MainSite,
  {
    gif: string;
    still: string;
    alt: string;
    title: string;
    description: string;
    background: string;
    titleColor: string;
    descriptionColor: string;
  }
> = {
  faryne: {
    gif: `${MASCOT_ASSET_CDN_BASE}/loading-page/faryne-walk-v1.gif`,
    still: `${MASCOT_ASSET_CDN_BASE}/loading-page/faryne-walk-v1-still.png`,
    alt: "大姐抱著 MBP 優雅步行",
    title: "正在整理頁面",
    description: "稍等一下，馬上帶你過去。",
    background: "linear-gradient(#f8fbff, #fff 55%, #f6f7fb)",
    titleColor: "#263348",
    descriptionColor: "#536273",
  },
  nekomaid: {
    gif: `${MASCOT_ASSET_CDN_BASE}/loading-page/nekomaid-trot-v1.gif`,
    still: `${MASCOT_ASSET_CDN_BASE}/loading-page/nekomaid-trot-v1-still.png`,
    alt: "二姐抱著文件像貓咪般小碎步",
    title: "正在搬運資料",
    description: "再跑幾步就送到了喵。",
    background: "linear-gradient(#fff8f9, #fff 55%, #fff6f8)",
    titleColor: "#382834",
    descriptionColor: "#6e5c68",
  },
  galgame: {
    gif: `${MASCOT_ASSET_CDN_BASE}/loading-page/galgame-run-v1.gif`,
    still: `${MASCOT_ASSET_CDN_BASE}/loading-page/galgame-run-v1-still.png`,
    alt: "三姐跨步、抬膝與騰空奔跑",
    title: "正在尋找影片",
    description: "再等一下，馬上把畫面帶過來。",
    background: "linear-gradient(#f7fbff, #fff 55%, #f1f7ff)",
    titleColor: "#1b2944",
    descriptionColor: "#4c607a",
  },
};

// 同一份前端建置同時服務獨立網域與主站巢狀路徑，Loading 圖須跟路由一起切換。
function getLoadingSite(): LoadingSite {
  if (typeof window === "undefined") return "faryne";
  const path = window.location.pathname;
  if (
    isSteamLoomSite() ||
    path === "/storyteller" ||
    path.startsWith("/storyteller/")
  )
    return "steamloom";
  if (isNekomaidSite() || path === "/nekomaid" || path.startsWith("/nekomaid/"))
    return "nekomaid";
  if (isGalgameSite() || path === "/galgame" || path.startsWith("/galgame/"))
    return "galgame";
  return "faryne";
}

// 頂層 Suspense fallback 早於各站 ThemeProvider 渲染，配色直接使用對應網站色碼。
export function LoadingFallback() {
  const { t } = useTranslation();
  const site = getLoadingSite();
  const content =
    site === "steamloom"
      ? {
          gif: STORYTELLER_ASSISTANT_THINKING_GIF_SRC,
          still: storytellerMascotSrc("thinking", "nocturne", "256"),
          alt: t("web.loadingPage.steamloom.alt"),
          title: t("web.loadingPage.steamloom.title"),
          description: t("web.loadingPage.steamloom.description"),
          background: "linear-gradient(#16110d, #241b14 48%, #16110d)",
          titleColor: "#e6bd76",
          descriptionColor: "#c9974f",
        }
      : loadingContent[site];

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 3,
        background: content.background,
      }}
    >
      <Stack
        alignItems="center"
        sx={{ width: "min(100%, 360px)", textAlign: "center" }}
      >
        <Box
          component="img"
          src={content.gif}
          alt={content.alt}
          sx={{
            width: 210,
            height: 210,
            objectFit: "contain",
            "@media (prefers-reduced-motion: reduce)": { display: "none" },
          }}
        />
        <Box
          component="img"
          src={content.still}
          alt={content.alt}
          sx={{
            display: "none",
            width: 210,
            height: 210,
            objectFit: "contain",
            "@media (prefers-reduced-motion: reduce)": { display: "block" },
          }}
        />
        <Typography
          component="p"
          variant="h6"
          sx={{ mt: 0.25, fontWeight: 800, color: content.titleColor }}
        >
          {content.title}
        </Typography>
        <Typography
          component="p"
          variant="body2"
          sx={{ mt: 0.5, color: content.descriptionColor }}
        >
          {content.description}
        </Typography>
      </Stack>
    </Box>
  );
}
