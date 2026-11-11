import { Link as RouterLink } from "react-router-dom";
import { Box, Chip, Stack, Typography } from "@mui/material";

import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import { actressTopicPath } from "@/helpers/avActressTopic.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { JoyuSearchBox } from "@/components/joyu/JoyuSearchBox.tsx";
import { joyuInk } from "@/components/joyu/joyuTheme.ts";

import { HOME_TOPIC_GROUPS } from "./homeTopicGroups.ts";

// 主視覺下方的主題捷徑數量（首頁那幾組裡人數最多的幾個）
const HERO_TOPIC_COUNT = 6;

/**
 * 原版首頁的主視覺：統一搜尋框（名字、別名、番號）＋熱門主題捷徑（一屏版改由頁首提供，見 JoyuHeaderTopics）
 */
export function JoyuHero() {
  const index = useActressTopicIndex();
  const topics = (index.data?.groups ?? [])
    .filter((g) => HOME_TOPIC_GROUPS.includes(g.key))
    .flatMap((g) => g.topics)
    .sort((a, b) => b.count - a.count)
    .slice(0, HERO_TOPIC_COUNT);

  return (
    <Box
      sx={{
        background: joyuInk.hero,
        color: joyuInk.text,
        borderRadius: 3.5,
        px: { xs: 2, md: 3.5 },
        py: { xs: 2.75, md: 4 },
        textAlign: "left",
      }}
    >
      <Typography
        component="h1"
        sx={{ fontSize: { xs: 21, md: 26 }, fontWeight: 800, mb: 2 }}
      >
        找女優、查番號
      </Typography>
      <JoyuSearchBox variant="hero" />
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={0.75}
        sx={{ mt: 1.75 }}
        useFlexGap
      >
        {topics.map((t) => (
          <Chip
            key={t.slug}
            clickable
            component={RouterLink}
            to={actressTopicPath(t.slug)}
            label={t.label}
            size="small"
            sx={{
              bgcolor: "rgba(255,255,255,.1)",
              border: "1px solid rgba(255,255,255,.2)",
              color: joyuInk.text,
            }}
          />
        ))}
        <Chip
          clickable
          component={RouterLink}
          to={joyuPath("actress/topics")}
          label="全部主題 →"
          size="small"
          sx={{
            bgcolor: "rgba(255,255,255,.1)",
            border: "1px solid rgba(255,255,255,.2)",
            color: joyuInk.text,
          }}
        />
      </Stack>
    </Box>
  );
}
