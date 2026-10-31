import { useState } from "react";
import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Box,
  Chip,
  Pagination,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type {
  ActressTopicFile,
  ActressTopicGroup,
  ActressTopicMember,
  ActressTopicSort,
  ActressTopicSummary,
} from "@/types/avActressTopic.ts";
import {
  useActressTopicFile,
  useActressTopicIndex,
} from "@/apis/av/actress_topic.ts";
import {
  actressTopicMemberPath,
  actressTopicPath,
  actressTopicSortLabel,
  actressTopicSorts,
  findActressTopic,
  sortActressTopicMembers,
  topicMonth,
} from "@/helpers/avActressTopic.ts";
import { actressCardGridSx } from "@/helpers/avActressDisplay.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ActressCard } from "@/components/av/actress_card.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

const PER_PAGE = 48;

/** 女優主題頁：/av/actress/topics/:slug?sort=&page=；排序與分頁都在前端做（主題檔案一次載完） */
export function AVActressTopic() {
  const { slug = "" } = useParams<{ slug: string }>();
  const index = useActressTopicIndex();
  const hit = findActressTopic(index.data, slug);
  const file = useActressTopicFile(hit?.topic.file);
  const [errorClosed, setErrorClosed] = useState(false);
  useTitle(hit ? `${hit.topic.label} - AV 女優主題` : "AV 女優主題");
  useBreadcrumbTail(hit?.topic.label);

  if (index.isSuccess && !hit) {
    return (
      <ErrorPage
        backUrl="/av/actress/topics"
        code={404}
        message="找不到這個主題，可能已經下架了。"
      />
    );
  }

  return (
    <AgeConfirmationGate
      description="AV 女優主題頁包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/av/actress/topics"
      panelTitle="AV 女優主題需要年齡確認"
    >
      {hit && file.data ? (
        <TopicContent file={file.data} group={hit.group} topic={hit.topic} />
      ) : (
        <Skeleton height={480} variant="rounded" />
      )}
      <CustomSnackbar
        message="主題資料讀取失敗，請稍後再試"
        onClose={() => setErrorClosed(true)}
        open={(index.isError || file.isError) && !errorClosed}
        severity="error"
      />
    </AgeConfirmationGate>
  );
}

function TopicContent({
  file,
  group,
  topic,
}: {
  file: ActressTopicFile;
  group: ActressTopicGroup;
  topic: ActressTopicSummary;
}) {
  // 排序與頁碼存在網址，可以直接分享；預設值不寫進網址
  const [params, setParams] = useSearchParams();
  const sorts = actressTopicSorts(file);
  const sort =
    sorts.find((s) => s === params.get("sort")) ??
    (sorts[0] as ActressTopicSort);
  const pages = Math.max(Math.ceil(file.actresses.length / PER_PAGE), 1);
  const page = Math.min(Math.max(Number(params.get("page")) || 1, 1), pages);
  const update = (next: { sort?: ActressTopicSort; page?: number }) => {
    const s = next.sort ?? sort;
    const p = next.page ?? 1;
    setParams({
      ...(s !== sorts[0] && { sort: s }),
      ...(p > 1 && { page: String(p) }),
    });
    window.scrollTo(0, 0);
  };
  const members = sortActressTopicMembers(file.actresses, sort).slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE,
  );
  // 依數量排序時才顯示名次
  const ranked = sort === "videos" || sort === "genre";

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        gap={1.5}
        sx={{ alignItems: { sm: "flex-end" }, justifyContent: "space-between" }}
      >
        <Box>
          <Typography component="h1" fontWeight={900} variant="h5">
            {topic.label}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {[group.label, topic.summary, `${topic.count.toLocaleString()} 位`]
              .filter(Boolean)
              .join("・")}
          </Typography>
        </Box>
        <ToggleButtonGroup
          exclusive
          onChange={(_, v: ActressTopicSort | null) => v && update({ sort: v })}
          size="small"
          sx={{ flexWrap: "wrap" }}
          value={sort}
        >
          {sorts.map((s) => (
            <ToggleButton key={s} value={s}>
              {actressTopicSortLabel(s, file)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {/* 同分組的其他主題，橫向捲動 */}
      <Stack direction="row" gap={0.75} sx={{ overflowX: "auto", pb: 0.5 }}>
        {group.topics.map((t) => (
          <Chip
            clickable={t.slug !== topic.slug}
            color={t.slug === topic.slug ? "primary" : "default"}
            component={RouterLink}
            key={t.slug}
            label={`${t.label} ${t.count.toLocaleString()}`}
            sx={{ flexShrink: 0 }}
            to={actressTopicPath(t.slug)}
            variant={t.slug === topic.slug ? "filled" : "outlined"}
          />
        ))}
      </Stack>

      <Box sx={actressCardGridSx(6)}>
        {members.map((m, i) => (
          <ActressCard
            key={`${m.domain}-${m.aid}`}
            name={m.name}
            photo={m.photo}
            rank={ranked ? (page - 1) * PER_PAGE + i + 1 : undefined}
            to={actressTopicMemberPath(m, topic.slug)}
          >
            <MemberStat file={file} member={m} sort={sort} />
          </ActressCard>
        ))}
      </Box>

      {pages > 1 && (
        <Pagination
          count={pages}
          onChange={(_, p) => update({ page: p })}
          page={page}
          shape="rounded"
          sx={{ alignSelf: "center" }}
          variant="outlined"
        />
      )}
    </Stack>
  );
}

/** 卡片上的數字：類型主題先寫該類型部數、新人先寫出道月，其他寫出演數與最近出演 */
function MemberStat({
  file,
  member: m,
  sort,
}: {
  file: ActressTopicFile;
  member: ActressTopicMember;
  sort: ActressTopicSort;
}) {
  const lines =
    file.genre_tag && sort !== "debut"
      ? [
          `${file.genre_tag} ${m.genre_count?.toLocaleString() ?? 0} 部`,
          `共 ${m.video_count.toLocaleString()} 部`,
          m.last_vod_date && `最近 ${topicMonth(m.last_vod_date)}`,
        ]
      : file.default_sort === "debut"
        ? [
            m.first_vod_date && `出道 ${topicMonth(m.first_vod_date)}`,
            `出演 ${m.video_count.toLocaleString()} 部`,
          ]
        : [
            `出演 ${m.video_count.toLocaleString()} 部`,
            m.last_vod_date && `最近 ${topicMonth(m.last_vod_date)}`,
          ];
  const [first, ...rest] = lines.filter(Boolean);
  return (
    <Typography color="text.secondary" component="div" variant="body2">
      <Box component="span" sx={{ color: "primary.main", fontWeight: 700 }}>
        {first}
      </Box>
      {rest.map((line) => (
        <Box component="div" key={String(line)}>
          {line}
        </Box>
      ))}
    </Typography>
  );
}
