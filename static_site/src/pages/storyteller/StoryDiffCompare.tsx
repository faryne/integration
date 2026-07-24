import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerProjects,
  useStorytellerStoryVersion,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import { CustomDiffLegend } from "@/components/common/CustomDiffLegend.tsx";
import { CustomDiffSection } from "@/components/common/CustomDiffSection.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
  storytellerVersionSourceLabel,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
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

interface CompareDiff {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  createdAt: string;
  words: number;
}

export default function StorytellerStoryDiffCompare() {
  const { id, storyId, diffId1, diffId2 } = useParams();
  const { session, loading, login, submitting } = useAuth();
  const { data: apiProjects = [], isPending: apiProjectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const project = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
      }
    : undefined;
  const { data: apiStories = [], isPending: apiStoriesPending } =
    useStorytellerStories(apiProject?.public_id);
  const apiStory = apiStories.find((item) => item.public_id === storyId);
  const story = apiStory
    ? {
        id: apiStory.public_id,
        title: apiStory.title,
      }
    : undefined;
  const leftVersion = useStorytellerStoryVersion(
    apiProject?.public_id,
    apiStory?.public_id,
    diffId1,
  );
  const rightVersion = useStorytellerStoryVersion(
    apiProject?.public_id,
    apiStory?.public_id,
    diffId2,
  );
  const leftDiff: CompareDiff | undefined = leftVersion.data
    ? {
        id: String(leftVersion.data.id),
        title: leftVersion.data.title,
        summary: leftVersion.data.summary,
        content: leftVersion.data.content,
        source: storytellerVersionSourceLabel(leftVersion.data.source),
        createdAt: leftVersion.data.created_at,
        words: leftVersion.data.word_count,
      }
    : undefined;
  const rightDiff: CompareDiff | undefined = rightVersion.data
    ? {
        id: String(rightVersion.data.id),
        title: rightVersion.data.title,
        summary: rightVersion.data.summary,
        content: rightVersion.data.content,
        source: storytellerVersionSourceLabel(rightVersion.data.source),
        createdAt: rightVersion.data.created_at,
        words: rightVersion.data.word_count,
      }
    : undefined;
  const diffSections = useMemo(
    () =>
      leftDiff && rightDiff
        ? [
            {
              key: "title",
              title: "標題",
              lines: buildCustomLineDiff(leftDiff.title, rightDiff.title),
            },
            {
              key: "summary",
              title: "摘要",
              lines: buildCustomLineDiff(leftDiff.summary, rightDiff.summary),
            },
            {
              key: "content",
              title: "內容",
              // 濾掉 marker/align/comment 屬性再比對，理由同 StoryVersionDiff.tsx：
              // 這個頁面是純文字 diff（不會經過我們的解析器渲染），不濾掉的話使用者會直接
              // 在畫面上看到 `⟦uuid⟧...⟦/uuid⟧` 這種內部語法，且無關的屬性異動會被誤判成內容變更。
              lines: buildCustomLineDiff(
                stripMarkerForDiffContent(leftDiff.content),
                stripMarkerForDiffContent(rightDiff.content),
              ),
            },
            {
              key: "footnotes",
              title: "腳注",
              // 閱讀頁把腳注放在故事尾端渲染，這裡也把腳注拆成獨立區塊比對，不是讓腳注
              // 內文跟著本文那一行進入上面的「內容」diff（腳注內文本來就活在行內 marker
              // 的屬性值裡，不是段落可見文字的一部分）。
              lines: buildCustomLineDiff(
                extractFootnoteNotesForDiff(leftDiff.content).join("\n"),
                extractFootnoteNotesForDiff(rightDiff.content).join("\n"),
              ),
            },
          ]
        : [],
    [leftDiff, rightDiff],
  );
  const changedCount = diffSections.reduce(
    (total, section) =>
      total + section.lines.filter((line) => line.state !== "same").length,
    0,
  );

  useTitle(
    story ? `${story.title} 版本比對 - ${STORYTELLER_APP_NAME}` : "版本比對",
    {
      path:
        id && storyId && diffId1 && diffId2
          ? steamloomPath(
              `my/project/${id}/story/${storyId}/diff/${diffId1}/${diffId2}`,
            )
          : "",
      robots: "noindex, nofollow",
    },
  );

  if (loading) {
    return (
      <StorytellerShell
        title="版本差異比對"
        description="左右對照故事標題與 Markdown 內容，並標示新增、移除與變更行。"
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: steamloomPath() },
          { label: "我的工作台", to: steamloomPath("my") },
          { label: "故事專案", to: steamloomPath("my/project") },
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
        title="版本差異比對"
        description="左右對照故事標題與 Markdown 內容，並標示新增、移除與變更行。"
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: steamloomPath() },
          { label: "我的工作台", to: steamloomPath("my") },
          { label: "故事專案", to: steamloomPath("my/project") },
          { label: "版本比對" },
        ]}
      >
        <CustomLoginRequiredState
          description="登入後即可查看故事編輯歷史比對。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (
    (!project && apiProjectsPending) ||
    (apiProject && !story && apiStoriesPending) ||
    leftVersion.isLoading ||
    rightVersion.isLoading
  ) {
    return (
      <StorytellerShell
        title="版本差異比對"
        breadcrumbs={[
          { label: STORYTELLER_APP_NAME, to: steamloomPath() },
          { label: "我的工作台", to: steamloomPath("my") },
          { label: "故事專案", to: steamloomPath("my/project") },
          { label: "版本比對" },
        ]}
      >
        <StorytellerLoading label="正在載入版本比對資料..." />
      </StorytellerShell>
    );
  }

  if (
    !project ||
    !story ||
    !leftDiff ||
    !rightDiff ||
    new Date(leftDiff.createdAt) >= new Date(rightDiff.createdAt)
  ) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title="版本差異比對"
      description="左右對照故事標題與 Markdown 內容，並標示新增、移除與變更行。"
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: "我的工作台", to: steamloomPath("my") },
        { label: "故事專案", to: steamloomPath("my/project") },
        {
          label: project.name,
          to: steamloomPath(`my/project/${project.id}`),
        },
        {
          label: "故事",
          to: steamloomPath(`my/project/${project.id}/stories`),
        },
        {
          label: story.title,
          to: steamloomPath(`my/project/${project.id}/story/${story.id}`),
        },
        { label: "版本比對" },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${changedCount} 行差異`} color="warning" />
          <Button
            href={steamloomPath(`my/project/${project.id}/story/${story.id}`)}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
          >
            返回編輯歷史
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
              leftDiff.source,
              formatStorytellerDate(leftDiff.createdAt),
            ]}
            rightMetadataLabels={[
              rightDiff.source,
              formatStorytellerDate(rightDiff.createdAt),
            ]}
          />
        ))}
      </Stack>
    </StorytellerShell>
  );
}
