import { Link as RouterLink } from "react-router-dom";
import { Box, Stack, Typography } from "@mui/material";

import {
  useJoyuActressAliasPhotos,
  useJoyuActressesByNames,
} from "@/apis/av/joyu.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { FollowButton } from "@/components/joyu/FollowButton.tsx";
import { actressBaseName, videoActressPath } from "@/helpers/avActressName.ts";
import type { Actress } from "@/types/av.ts";

/**
 * 一張出演女優卡：照片＋名字＋罩杯；女優資料對不到（新人還沒建檔、同名多位）時只顯示名字。
 * 用別名發片、本名對不到的，只補上照片（aliasPhoto），名字、罩杯、追蹤照舊是這個名義自己的
 */
function CastCard({
  credit,
  dmmId,
  actress,
  aliasPhoto,
}: {
  credit: string;
  dmmId?: string;
  actress?: Actress;
  aliasPhoto?: string;
}) {
  const name = actressBaseName(credit);
  return (
    <Box
      component={RouterLink}
      // 連結照舊用 DMM 女優 ID（同名分得開），規則見 videoActressPath
      to={videoActressPath(credit, dmmId)}
      sx={{
        alignItems: "center",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 10,
        color: "inherit",
        display: "flex",
        gap: 1.25,
        pl: 0.5,
        pr: 1,
        py: 0.5,
        textDecoration: "none",
        "&:hover": { borderColor: "primary.main" },
      }}
    >
      <ActressPhoto
        src={actress?.photo ?? aliasPhoto}
        alt={name}
        loading="lazy"
        sx={{
          width: 44,
          height: 44,
          aspectRatio: "1",
          borderRadius: "50%",
          objectPosition: "top",
        }}
      />
      <Box sx={{ textAlign: "left" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{name}</Typography>
        {actress?.cup && (
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>
            {actress.cup} Cup
          </Typography>
        )}
      </Box>
      {/* 對得到唯一一位女優才能追蹤（要存 domain:aid）；FollowButton 會擋掉點擊，不會跟著卡片跳頁 */}
      {actress && (
        <FollowButton
          kind="actress"
          label={name}
          value={`${actress.domain}:${actress.aid}`}
        />
      )}
    </Box>
  );
}

/**
 * 影片頁標題下方的出演女優卡（P2）：全部出演者都列出，點了直接進女優頁。
 * 女優資料用一支批次 API 一次查回來（合輯有十幾位出演者也只打一次）
 */
export function VideoCast({
  actresses,
  actressIds,
}: {
  actresses: string[];
  // 跟 actresses 同一個索引對應；舊影片沒有
  actressIds?: string[];
}) {
  // 先跟 ID 配對再濾掉空名字，索引才不會錯位
  const cast = actresses
    .map((credit, i) => ({
      credit: credit.trim(),
      dmmId: actressIds?.[i] || undefined,
    }))
    .filter((c) => c.credit);
  const profiles = useJoyuActressesByNames(cast.map((c) => c.credit));
  // 本名對不到的才用別名找照片；等本名的結果回來再查，才知道哪些對不到
  const unmatched = profiles.isSuccess
    ? cast.map((c) => c.credit).filter((credit) => !profiles.data?.[credit])
    : [];
  const aliasPhotos = useJoyuActressAliasPhotos(unmatched);
  if (!cast.length) return null;
  return (
    <Box sx={{ textAlign: "left" }}>
      <Typography color="text.secondary" sx={{ fontSize: 12, mb: 0.75 }}>
        出演女優
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1.25} useFlexGap>
        {cast.map((c) => (
          <CastCard
            key={c.credit}
            credit={c.credit}
            dmmId={c.dmmId}
            actress={profiles.data?.[c.credit]}
            aliasPhoto={aliasPhotos.data?.[c.credit]}
          />
        ))}
      </Stack>
    </Box>
  );
}
