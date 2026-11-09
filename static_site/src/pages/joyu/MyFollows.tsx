import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Box, Button, Chip, Skeleton, Stack, Typography } from "@mui/material";

import { useJoyuFeed, type FollowKind } from "@/apis/av/joyu_me.ts";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { useJoyuAuth } from "@/components/joyu/auth/JoyuAuthContext.ts";
import { FollowButton } from "@/components/joyu/FollowButton.tsx";
import { FollowSection } from "@/components/joyu/follows/FollowSection.tsx";
import {
  FOLLOW_KIND_LABELS,
  FOLLOW_KINDS,
  followItemLink,
} from "@/components/joyu/follows/followKinds.ts";
import { joyuPath } from "@/helpers/joyu.ts";
import { useTitle } from "@/helpers/title.tsx";

const DAYS = [7, 14, 30];

/**
 * joyu 我的追蹤（/me/follows）：「追蹤動態」和「管理追蹤」合成一頁。
 * 每個追蹤一區，列出最近 N 天的新片（後端依最新配信日排好）；區塊標題旁的愛心就是取消追蹤；
 * 這段期間沒有新片的收在下面（刪除帳號在個人資料頁）。類型、天數存在網址（?days=14&kind=tag）
 */
export function JoyuMyFollows() {
  useTitle("我的追蹤");
  const { user, loading } = useJoyuAuth();
  const [params, setParams] = useSearchParams();
  const days = DAYS.includes(Number(params.get("days")))
    ? Number(params.get("days"))
    : 14;
  const kind = (params.get("kind") ?? "") as FollowKind | "";
  const feed = useJoyuFeed(user?.uid, days);

  const setParam = (key: string, value?: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });

  const data = feed.data;
  const all = [...(data?.sections ?? []), ...(data?.quiet ?? [])];
  const kinds = FOLLOW_KINDS.filter((k) => all.some((f) => f.kind === k));
  const pick = <T extends { kind: FollowKind }>(items: T[]) =>
    kind ? items.filter((f) => f.kind === kind) : items;
  const sections = pick(data?.sections ?? []);
  const quiet = pick(data?.quiet ?? []);

  const empty = !loading && (!user || (data && all.length === 0));

  return (
    <AgeConfirmationGate
      description="joyu.fyi 包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      panelTitle="joyu.fyi 需要年齡確認"
    >
      <Stack spacing={3} sx={{ textAlign: "left" }}>
        <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
          我的追蹤
          {data && (
            <Box
              component="span"
              sx={{
                color: "text.secondary",
                fontSize: 13,
                fontWeight: 400,
                ml: 1,
              }}
            >
              {all.length} / 500
            </Box>
          )}
        </Typography>

        {empty ? (
          <Stack
            spacing={2}
            sx={{
              alignItems: "center",
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 3,
              py: 5,
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              還沒有追蹤任何女優或條件
            </Typography>
            <Button
              component={RouterLink}
              to={joyuPath("actress")}
              variant="contained"
            >
              去找女優
            </Button>
          </Stack>
        ) : (
          <>
            <Stack
              direction="row"
              flexWrap="wrap"
              gap={1}
              sx={{ justifyContent: "space-between" }}
              useFlexGap
            >
              <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                <Chip
                  clickable
                  color={kind ? "default" : "primary"}
                  label="全部"
                  onClick={() => setParam("kind")}
                  variant={kind ? "outlined" : "filled"}
                />
                {kinds.map((k) => (
                  <Chip
                    key={k}
                    clickable
                    color={kind === k ? "primary" : "default"}
                    label={`${FOLLOW_KIND_LABELS[k]} ${all.filter((f) => f.kind === k).length}`}
                    onClick={() => setParam("kind", k)}
                    variant={kind === k ? "filled" : "outlined"}
                  />
                ))}
              </Stack>
              <Stack direction="row" gap={0.75}>
                {DAYS.map((d) => (
                  <Chip
                    key={d}
                    clickable
                    color={days === d ? "primary" : "default"}
                    label={`${d} 天`}
                    onClick={() =>
                      setParam("days", d === 14 ? undefined : String(d))
                    }
                    variant={days === d ? "filled" : "outlined"}
                  />
                ))}
              </Stack>
            </Stack>

            {(loading || feed.isPending) && (
              <Skeleton height={280} variant="rounded" />
            )}
            {feed.isError && (
              <Typography color="error">
                追蹤資料讀取失敗，請稍後再試
              </Typography>
            )}
            {data &&
              sections.map((s) => (
                <FollowSection
                  key={`${s.kind}:${s.value}`}
                  section={s}
                  since={data.since}
                />
              ))}

            {quiet.length > 0 && (
              <Box
                sx={{
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 2,
                }}
              >
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 14, mb: 1.25 }}
                >
                  這段期間沒有新片：{quiet.length} 項
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
                  {quiet.map((f) => (
                    <Chip
                      key={`${f.kind}:${f.value}`}
                      clickable={!f.missing}
                      component={f.missing ? "div" : RouterLink}
                      label={
                        <Box
                          component="span"
                          sx={{
                            alignItems: "center",
                            display: "inline-flex",
                            gap: 0.5,
                          }}
                        >
                          <Box
                            component="span"
                            sx={{ color: "text.secondary", fontSize: 11 }}
                          >
                            {FOLLOW_KIND_LABELS[f.kind]}
                          </Box>
                          {f.missing ? "找不到資料" : f.label}
                          <FollowButton
                            kind={f.kind}
                            label={f.label}
                            value={f.value}
                          />
                        </Box>
                      }
                      size="small"
                      variant="outlined"
                      {...(f.missing ? {} : { to: followItemLink(f) })}
                    />
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </Stack>
    </AgeConfirmationGate>
  );
}
