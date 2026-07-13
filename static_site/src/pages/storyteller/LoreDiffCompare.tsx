import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerLoreVersion,
  useStorytellerLores,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import { CustomDiffLegend } from "@/components/common/CustomDiffLegend.tsx";
import { CustomDiffSection } from "@/components/common/CustomDiffSection.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import {
  extractFootnoteNotesForDiff,
  stripMarkerForDiffContent,
} from "@/pages/storyteller/wysiwygCore/parser.ts";

export default function StorytellerLoreDiffCompare() {
  const { id, loreId, diffId1, diffId2 } = useParams();
  const { session, loading, login, submitting } = useAuth();
  const { data: apiProjects = [], isPending: projectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const { data: apiLores = [], isPending: loresPending } = useStorytellerLores(
    apiProject?.public_id,
  );
  const apiLore = apiLores.find((item) => item.public_id === loreId);
  const leftVersion = useStorytellerLoreVersion(
    apiProject?.public_id,
    apiLore?.public_id,
    diffId1,
  );
  const rightVersion = useStorytellerLoreVersion(
    apiProject?.public_id,
    apiLore?.public_id,
    diffId2,
  );
  const diffSections = useMemo(
    () =>
      leftVersion.data && rightVersion.data
        ? [
            {
              key: "title",
              title: "標題",
              lines: buildCustomLineDiff(
                leftVersion.data.title,
                rightVersion.data.title,
              ),
            },
            {
              key: "content",
              title: "內容",
              // 濾掉 marker/align/comment 屬性再比對，理由同 StoryDiffCompare.tsx：
              // 這個頁面是純文字 diff，不濾掉的話使用者會直接看到 `⟦uuid⟧...⟦/uuid⟧`
              // 這種內部語法，且無關的屬性異動會被誤判成內容變更。
              lines: buildCustomLineDiff(
                stripMarkerForDiffContent(leftVersion.data.content),
                stripMarkerForDiffContent(rightVersion.data.content),
              ),
            },
            {
              key: "footnotes",
              title: "腳注",
              // 理由同 StoryDiffCompare.tsx：腳注拆成獨立區塊比對，不跟著本文那一行進入
              // 上面的「內容」diff。
              lines: buildCustomLineDiff(
                extractFootnoteNotesForDiff(leftVersion.data.content).join(
                  "\n",
                ),
                extractFootnoteNotesForDiff(rightVersion.data.content).join(
                  "\n",
                ),
              ),
            },
          ]
        : [],
    [leftVersion.data, rightVersion.data],
  );
  const changedCount = diffSections.reduce(
    (total, section) =>
      total + section.lines.filter((line) => line.state !== "same").length,
    0,
  );

  useTitle(
    apiLore
      ? `${apiLore.title} 版本比對 - ${STORYTELLER_APP_NAME}`
      : "設定集版本比對",
    {
      path:
        id && loreId && diffId1 && diffId2
          ? `/storyteller/my/project/${id}/lore/${loreId}/diff/${diffId1}/${diffId2}`
          : "",
      robots: "noindex, nofollow",
    },
  );

  if (loading) {
    return (
      <StorytellerShell
        title="設定集版本差異比對"
        description="左右對照設定集標題與 Markdown 內容。"
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: "/storyteller" },
          { label: "我的工作台", to: "/storyteller/my" },
          { label: "故事專案", to: "/storyteller/my/project" },
          { label: "版本比對" },
        ]}
      >
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell
        title="設定集版本差異比對"
        description="左右對照設定集標題與 Markdown 內容。"
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: "/storyteller" },
          { label: "我的工作台", to: "/storyteller/my" },
          { label: "故事專案", to: "/storyteller/my/project" },
          { label: "版本比對" },
        ]}
      >
        <CustomLoginRequiredState
          description="登入後即可查看設定集編輯歷史比對。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (
    (!apiProject && projectsPending) ||
    (apiProject && !apiLore && loresPending) ||
    leftVersion.isLoading ||
    rightVersion.isLoading
  ) {
    return (
      <StorytellerShell
        title="設定集版本差異比對"
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: "/storyteller" },
          { label: "我的工作台", to: "/storyteller/my" },
          { label: "故事專案", to: "/storyteller/my/project" },
          { label: "版本比對" },
        ]}
      >
        <StorytellerLoading label="正在載入設定集版本比對資料..." />
      </StorytellerShell>
    );
  }

  if (!apiProject || !apiLore || !leftVersion.data || !rightVersion.data) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title="設定集版本差異比對"
      description="左右對照設定集標題與 Markdown 內容。"
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: "/storyteller" },
        { label: "我的工作台", to: "/storyteller/my" },
        { label: "故事專案", to: "/storyteller/my/project" },
        {
          label: apiProject.name,
          to: `/storyteller/my/project/${apiProject.public_id}`,
        },
        {
          label: apiLore.title,
          to: `/storyteller/my/project/${apiProject.public_id}/lore/${apiLore.public_id}`,
        },
        { label: "版本比對" },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${changedCount} 行差異`} color="warning" />
          <Button
            href={`/storyteller/my/project/${apiProject.public_id}/lore/${apiLore.public_id}`}
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            回設定集
          </Button>
        </Stack>
      }
    >
      <Stack spacing={3}>
        <CustomDiffLegend />
        {diffSections.map((section) => (
          <CustomDiffSection
            key={section.key}
            title={section.title}
            lines={section.lines}
            leftTitle="舊版本"
            rightTitle="新版本"
            leftMetadataLabels={[
              formatStorytellerDate(leftVersion.data.created_at),
            ]}
            rightMetadataLabels={[
              formatStorytellerDate(rightVersion.data.created_at),
            ]}
          />
        ))}
      </Stack>
    </StorytellerShell>
  );
}
