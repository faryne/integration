import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import { Box, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { STORYTELLER_ASSISTANT_AVATAR_SRC } from "@/helpers/storytellerMascot.ts";

const DISCORD_INVITE_URL = "https://discord.gg/yqxjEx5kJ";

/** SteamLoom 共用品牌頁尾；compact 版本可放進固定高度的工作台外殼。 */
export function SteamLoomFooter({ compact = false }: { compact?: boolean }) {
  return (
    <Box
      component="footer"
      sx={{
        flexShrink: 0,
        borderTop: 1,
        borderColor: "divider",
        px: compact ? 1.5 : 0,
        py: compact ? 0.75 : 2,
        textAlign: "left",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={compact ? 0.5 : 2}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box
            component="img"
            src={STORYTELLER_ASSISTANT_AVATAR_SRC}
            alt="梭梭"
            sx={{
              width: compact ? 32 : 48,
              height: compact ? 32 : 48,
              flexShrink: 0,
              borderRadius: "50%",
              objectFit: "cover",
              bgcolor: "action.hover",
            }}
          />
          <Stack spacing={0.125} sx={{ minWidth: 0 }}>
            <Typography
              component={RouterLink}
              to={steamloomPath()}
              fontWeight={900}
              color="text.primary"
              sx={{ lineHeight: 1.25, textDecoration: "none" }}
            >
              {STORYTELLER_APP_NAME}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: compact ? { xs: "none", md: "block" } : "block",
                lineHeight: 1.45,
              }}
            >
              寫故事、整理設定，讓世界持續生長。
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction={compact ? "row" : "column"}
          spacing={compact ? 1.5 : 0.5}
          alignItems={compact ? "center" : "flex-start"}
        >
          <Link
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            color="text.secondary"
            underline="hover"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: compact ? 12 : 14,
              fontWeight: 700,
            }}
          >
            <ForumOutlinedIcon sx={{ fontSize: compact ? 16 : 18 }} />
            SteamLoom @ Discord
          </Link>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: compact ? { xs: "none", sm: "block" } : "block" }}
          >
            © {new Date().getFullYear()} Faryne ·{" "}
            <Link
              href="https://faryne.dev/"
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              underline="hover"
            >
              faryne.dev
            </Link>
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
