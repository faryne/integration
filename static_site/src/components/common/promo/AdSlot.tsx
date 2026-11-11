import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

import { HousePromo } from "./HousePromo.tsx";
import {
  type AdProvider,
  type HouseSource,
  PROMO_SIZES,
  type PromoSize,
} from "./types.ts";

// 廣告放進去後等多久檢查「真的有長出東西」；沒長出來（cosmetic filter 藏掉、沒填單）就當被擋
const FILL_CHECK_MS = 3000;

// 每次開站隨機一個起點；同一頁各版位用 slot 錯開，換頁用路徑錯開，推廣內容才不會一直是同一張
const SEED = Math.floor(Math.random() * 1_000_000);
const hash = (s: string) =>
  [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);

type Status = "loading" | "loaded" | "blocked";

/**
 * 版位：先佔好固定高度，載入外部廣告；廣告被擋或沒填單時改放站內推廣（不顯示「廣告」、不要求關 adblock）。
 * provider 沒給＝不載廣告直接放站內推廣；推廣內容讀完是空的就整格收起。
 * slot：同一頁第幾個版位，用來錯開推廣內容；size：固定尺寸（例：PC 側欄放 300×100），不給就依斷點自動選
 */
export function AdSlot({
  size: fixed,
  ...props
}: SlotProps & { size?: PromoSize }) {
  const theme = useTheme();
  const auto: PromoSize = useMediaQuery(theme.breakpoints.up("md"))
    ? "desktop"
    : "mobile";
  const size = fixed ?? auto;
  // 跨過斷點（轉橫、拉視窗）時整格重來，換成另一個尺寸的廣告
  return <SlotBody key={size} size={size} {...props} />;
}

interface SlotProps {
  provider?: AdProvider;
  useHouse: HouseSource;
  slot?: number;
}

function SlotBody({
  provider,
  useHouse,
  slot = 0,
  size,
}: SlotProps & { size: PromoSize }) {
  const { width, height } = PROMO_SIZES[size];
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(
    provider ? "loading" : "blocked",
  );
  const items = useHouse();
  const { pathname } = useLocation();

  useEffect(() => {
    const el = container.current;
    if (!provider || !el) return;
    let alive = true;
    const settle = (s: Status) => alive && setStatus(s);
    provider.load(el, size).catch(() => settle("blocked"));
    // 時間到還沒有可見的內容（iframe 被藏、高度 0、沒填單）一律當被擋
    const timer = window.setTimeout(
      () =>
        settle(
          [...el.children].some((c) => (c as HTMLElement).offsetHeight > 0)
            ? "loaded"
            : "blocked",
        ),
      FILL_CHECK_MS,
    );
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [provider, size]);

  // 被擋了而推廣內容讀完是空的（讀取失敗也是）：整格收起
  if (status === "blocked" && items?.length === 0) return null;
  const item = items?.length
    ? items[(SEED + hash(pathname) + slot) % items.length]
    : undefined;

  return (
    // 置中：放在 Stack 裡時 spacing 會把 margin 蓋成 0，所以 mx 之外再加 alignSelf
    <Box sx={{ alignSelf: "center", maxWidth: "100%", mx: "auto", width }}>
      {/* 「廣告」標示只在真的放外部廣告時出現；被擋時保留高度不顯示，版面不跳 */}
      <Typography
        sx={{
          color: "text.disabled",
          fontSize: 10,
          lineHeight: "16px",
          textAlign: "left",
          visibility: status === "blocked" ? "hidden" : "visible",
        }}
      >
        廣告
      </Typography>
      <Box
        sx={{
          // 等廣告、或被擋了但推廣內容還在讀：灰底佔位
          bgcolor:
            status === "loaded" || (status === "blocked" && item)
              ? undefined
              : "action.hover",
          borderRadius: 1.5,
          height,
          overflow: "hidden",
        }}
      >
        <Box
          ref={container}
          sx={{
            display: status === "blocked" ? "none" : "flex",
            height: "100%",
            justifyContent: "center",
          }}
        />
        {status === "blocked" && item && <HousePromo item={item} size={size} />}
      </Box>
    </Box>
  );
}
