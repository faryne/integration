import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Stack, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

import type { JoyuActressSummary } from "@/apis/av/joyu.ts";
import { ActressLinks } from "@/components/av/actress_links.tsx";
import { ActressNames } from "@/components/av/actress_names.tsx";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { ActressTopicChip } from "@/components/av/actress_topic_chip.tsx";
import {
  actressAge,
  formatActressBirth,
  formatActressMeasurements,
} from "@/helpers/avActressDisplay.ts";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import type { Actress } from "@/types/av.ts";

/** 一格基本資料：上面小字標籤、下面內容；內容是空的整格不顯示（手動上稿的女優常常只有部分資料） */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <Box>
      <Typography color="text.secondary" sx={{ fontSize: 12 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: { xs: 13, md: 14 } }}>{children}</Typography>
    </Box>
  );
}

/**
 * 女優頁頂端（P2）：照片＋名字、讀音、別名、基本資料（生日／身高／三圍／出道與作品數）、主題、參考連結、修改資料。
 * 作品數與出道年來自 /opendata/av/actress/summary，還沒讀到時那一格先不顯示
 */
export function ActressProfileHeader({
  actress,
  pageName,
  summary,
}: {
  actress: Actress;
  pageName: string;
  summary?: JoyuActressSummary;
}) {
  const birth = formatActressBirth(actress);
  const age = actressAge(actress);
  const debutYear = summary?.first.slice(0, 4);
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 1.5, md: 3 },
        gridTemplateColumns: { xs: "110px 1fr", md: "200px 1fr" },
        textAlign: "left",
      }}
    >
      <ActressPhoto
        alt={actress.name}
        src={actress.photo}
        sx={{
          borderRadius: 3,
          width: "100%",
          aspectRatio: "3 / 4",
          objectPosition: "top",
        }}
      />
      <Stack spacing={1.25} sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          flexWrap="wrap"
          gap={1.25}
          sx={{ alignItems: "center" }}
          useFlexGap
        >
          <Typography
            component="h1"
            sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 800 }}
          >
            {actress.name}
          </Typography>
          {/* 資料有誤或缺漏時送修改單，管理者核准後才更新 */}
          <Button
            component={RouterLink}
            size="small"
            startIcon={<EditOutlinedIcon />}
            to={actressPagePath(actress.name, actress, "/edit")}
            variant="outlined"
          >
            修改資料
          </Button>
        </Stack>
        {actress.kana && (
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            {actress.kana}
          </Typography>
        )}
        <ActressNames actress={actress} current={pageName} />
        <Box
          sx={{
            display: "grid",
            gap: { xs: "4px 12px", md: "6px 28px" },
            gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, auto)" },
            justifyContent: "start",
          }}
        >
          <Fact label="生日">
            {birth && `${birth}${age !== undefined ? `（${age} 歲）` : ""}`}
          </Fact>
          <Fact label="身高">
            {actress.height > 0 && `${actress.height} cm`}
          </Fact>
          <Fact label="三圍">{formatActressMeasurements(actress)}</Fact>
          <Fact label="出道">
            {summary &&
              summary.count > 0 &&
              `${debutYear} 年・作品 ${summary.count.toLocaleString()} 部`}
          </Fact>
        </Box>
        <ActressTopicChip />
        <ActressLinks links={actress.links} />
      </Stack>
    </Box>
  );
}
