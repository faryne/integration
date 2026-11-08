import { Link as RouterLink } from "react-router-dom";
import { Box, Chip, Paper, Skeleton, Stack, Typography } from "@mui/material";

import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import { actressTopicPath } from "@/helpers/avActressTopic.ts";
import { joyuPath } from "@/helpers/joyu.ts";

import { ErrorSnack } from "./ErrorSnack.tsx";
import { HomeSection } from "./HomeSection.tsx";
import { HOME_TOPIC_GROUPS } from "./homeTopicGroups.ts";

// 每個分組在首頁只放人數最多的幾個，完整清單在主題總覽頁
const TOPICS_PER_GROUP = 8;

/** 首頁「女優主題」：首頁那幾組各一張卡，列出人數最多的主題 */
export function TopicsSection() {
  const index = useActressTopicIndex();
  const groups = (index.data?.groups ?? []).filter((g) =>
    HOME_TOPIC_GROUPS.includes(g.key),
  );

  return (
    <HomeSection
      title="女優主題"
      moreTo={joyuPath("actress/topics")}
      moreLabel="全部主題"
    >
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        {index.isPending
          ? Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={120} />
            ))
          : groups.map((g) => (
              <Paper
                key={g.key}
                variant="outlined"
                sx={{ borderRadius: 3, p: 2 }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: 800, mb: 1 }}>
                  {g.label}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                  {[...g.topics]
                    .sort((a, b) => b.count - a.count)
                    .slice(0, TOPICS_PER_GROUP)
                    .map((t) => (
                      <Chip
                        key={t.slug}
                        clickable
                        component={RouterLink}
                        to={actressTopicPath(t.slug)}
                        label={`${t.label} ${t.count.toLocaleString()}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                </Stack>
              </Paper>
            ))}
      </Box>
      <ErrorSnack open={index.isError} message="主題資料讀取失敗，請稍後再試" />
    </HomeSection>
  );
}
