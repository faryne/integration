import { Box } from "@mui/material";
import { MASCOT_ASSET_CDN_BASE } from "@/helpers/mascotAssets.ts";

// 由左至右依姊妹排行排列；圖片統一鏡像成向左前進，讓大姐位於隊伍前方。
const mascots = [
  {
    name: "faryne.dev 大姐",
    title: "Faryne 的實驗室",
    href: "https://faryne.dev/",
    image: "faryne-eldest-sd.png",
  },
  {
    name: "neko.maid.tw 二姐",
    title: "難以名狀的抓圖器",
    href: "https://neko.maid.tw/",
    image: "neko-second-sd.png",
  },
  {
    name: "galgame.tv 三姐",
    title: "Galgame TV",
    href: "https://galgame.tv/",
    image: "galgame-third-sd.png",
  },
  {
    name: "SteamLoom 梭梭",
    title: "SteamLoom",
    href: "https://steamloom.works/",
    image: "suosuo-youngest-sd.png",
  },
] as const;

/** Footer 的四姊妹入口：桌面版在站名下方，行動版在站名右側。 */
export function FooterMascotLinks() {
  return (
    <Box
      component="nav"
      aria-label="姊妹網站"
      sx={{ display: "flex", alignItems: "flex-end", flexShrink: 0 }}
    >
      {mascots.map(({ name, title, href, image }, index) => (
        <Box
          key={href}
          component="a"
          href={href}
          target={index === 0 ? undefined : "_blank"}
          rel={index === 0 ? undefined : "noopener noreferrer"}
          aria-label={`前往 ${name}`}
          title={`${title} — ${href}`}
          sx={{
            display: "block",
            width: { xs: "clamp(38px, 12vw, 58px)", md: 62 },
            height: { xs: "clamp(38px, 12vw, 58px)", md: 62 },
            flexShrink: 0,
            ml: index === 0 ? 0 : { xs: -0.75, md: -1.25 },
            position: "relative",
            zIndex: mascots.length - index,
            borderRadius: 1,
            outlineOffset: 2,
            transition: "transform 160ms ease",
            "&:hover, &:focus-visible": { transform: "translateY(-3px)" },
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          <Box
            component="img"
            src={`${MASCOT_ASSET_CDN_BASE}/footer-sd/${image}`}
            alt=""
            loading="lazy"
            decoding="async"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: "scaleX(-1)",
            }}
          />
        </Box>
      ))}
    </Box>
  );
}
