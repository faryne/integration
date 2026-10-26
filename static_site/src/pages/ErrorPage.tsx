import { Box, Button, Container, Stack, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useContext } from "react";
import { galgamePath, isGalgameSite } from "@/helpers/galgame.ts";
import { isNekomaidSite, nekomaidPath } from "@/helpers/nekomaid.ts";
import { storytellerMascotSrc } from "@/helpers/storytellerMascot.ts";
import { isSteamLoomSite, steamloomPath } from "@/helpers/steamloom.ts";
import { StorytellerAppearanceContext } from "@/layouts/storytellerAppearanceMode.tsx";
import {
  errorPageContent,
  errorPageMascots,
  fallbackErrorContent,
  type ErrorPageSite,
} from "@/pages/errorPageContent.ts";

export interface ErrorPageProps {
  backUrl?: string;
  code: number;
  title?: string; // 蓋過依 code 決定的預設標題（例如同樣 503，影片搜尋額度用完要講清楚）
  message?: string;
  internalCode?: string;
  // 嵌在別的容器裡（例如工作台右欄，本身已經有自己的內距與有限寬度）時用——
  // 拿掉以整頁為前提設計的 70vh 置中高度跟 Container 自己的左右內距，不然
  // 兩層內距疊在一起、加上跟外層寬度不成比例的高度，看起來會很不對勁。
  compact?: boolean;
}

// SteamLoom 是完全獨立的產品，錯誤頁不套用主站的貓娘女僕人設，改用蒸汽織機的故障意象。
const steamloomErrorContent: Record<
  number,
  { title: string; message: string }
> = {
  400: {
    title: "齒輪咬合失敗",
    message:
      "這份設計圖的規格好像不太對，織機看不懂該怎麼運轉。請確認內容後再送一次。",
  },
  401: {
    title: "還沒有通行憑證",
    message: "織坊大門鎖著，還沒驗證身分無法進入。請先登入取得憑證。",
  },
  403: {
    title: "這道齒輪鎖住了",
    message:
      "這個房間目前上了鎖，暫時不能進去。若覺得不該被擋下，請再確認權限設定。",
  },
  404: {
    title: "找不到這台織機",
    message: "把整座工坊翻遍了，還是沒找到你要的頁面。先回首頁看看其他故事吧。",
  },
  500: {
    title: "鍋爐燒過頭了",
    message: "蒸汽鍋爐好像過熱當機。請稍後再試一次，或把狀況交給管理員檢查。",
  },
  503: {
    title: "工坊維護中",
    message: "師傅正在保養機件，服務暫時無法使用。請稍後再回來看看。",
  },
};

const steamloomFallbackErrorContent = {
  title: "齒輪卡住了",
  message: "織機這邊暫時處理不了這次的請求。請稍後再試一次，或先回首頁看看。",
};

// 獨立網域與主站巢狀路徑共用建置檔案，因此兩種入口都要辨識。
function getErrorPageSite(): ErrorPageSite {
  if (typeof window === "undefined") return "faryne";
  const { pathname } = window.location;
  if (
    isNekomaidSite() ||
    pathname === "/nekomaid" ||
    pathname.startsWith("/nekomaid/")
  )
    return "nekomaid";
  if (
    isGalgameSite() ||
    pathname === "/galgame" ||
    pathname.startsWith("/galgame/")
  )
    return "galgame";
  return "faryne";
}

export function ErrorPage({
  backUrl,
  code,
  title,
  message,
  internalCode,
  compact = false,
}: ErrorPageProps) {
  const storytellerAppearance = useContext(StorytellerAppearanceContext);
  const steamloom = isSteamLoomSite() || storytellerAppearance !== null;
  const site = getErrorPageSite();
  const errorContent = steamloom
    ? (steamloomErrorContent[code] ?? steamloomFallbackErrorContent)
    : (errorPageContent[site][code] ?? fallbackErrorContent[site]);
  const mascot = steamloom
    ? {
        src: storytellerMascotSrc(
          "error",
          storytellerAppearance?.appearance ?? "nocturne",
          "512",
        ),
        alt: "梭梭",
      }
    : errorPageMascots[site];
  const buttonHref =
    backUrl ??
    (steamloom
      ? steamloomPath()
      : site === "nekomaid"
        ? nekomaidPath()
        : site === "galgame"
          ? galgamePath()
          : "/");
  const ButtonIcon = backUrl ? ArrowBackIcon : HomeIcon;
  const buttonText = backUrl ? "回前頁" : "回首頁";

  return (
    <Container
      maxWidth="md"
      disableGutters={compact}
      sx={
        compact
          ? {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: { xs: "50vh", md: "60vh" },
              py: { xs: 3, md: 4 },
            }
          : {
              minHeight: "70vh",
              display: "flex",
              alignItems: "center",
              py: { xs: 6, md: 10 },
            }
      }
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 3, md: 4 }}
        alignItems="center"
        justifyContent="center"
        sx={compact ? { width: "auto" } : { width: "100%" }}
      >
        <Box
          component="img"
          src={mascot.src}
          alt={mascot.alt}
          sx={{
            width: compact ? { xs: 120, md: 160 } : { xs: 180, md: 260 },
            height: compact ? { xs: 120, md: 160 } : { xs: 180, md: 260 },
            objectFit: "contain",
            flexShrink: 0,
          }}
        />

        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
          <Typography
            component="h1"
            variant="h2"
            color="primary"
            sx={{ fontWeight: 800 }}
          >
            {code}
          </Typography>
          <Typography
            component="p"
            variant="h5"
            sx={{ mt: 1, fontWeight: 700 }}
          >
            {title ?? errorContent.title}
          </Typography>
          <Typography
            component="p"
            variant="body1"
            color="text.secondary"
            sx={{ mt: 2, maxWidth: 520 }}
          >
            {message ?? errorContent.message}
          </Typography>

          {internalCode ? (
            <Typography
              component="p"
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", mt: 2 }}
            >
              系統內部錯誤代碼：{internalCode}
            </Typography>
          ) : null}

          <Button
            component="a"
            href={buttonHref}
            variant="contained"
            startIcon={<ButtonIcon />}
            sx={{ mt: 3 }}
          >
            {buttonText}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
