import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerProjects,
  useStorytellerStoryVersion,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import { CustomDiffPane } from "@/components/common/CustomDiffPane.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

interface CompareDiff {
  id: string;
  title: string;
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
        content: leftVersion.data.content,
        source: "手動編輯",
        createdAt: leftVersion.data.created_at,
        words: leftVersion.data.word_count,
      }
    : undefined;
  const rightDiff: CompareDiff | undefined = rightVersion.data
    ? {
        id: String(rightVersion.data.id),
        title: rightVersion.data.title,
        content: rightVersion.data.content,
        source: "手動編輯",
        createdAt: rightVersion.data.created_at,
        words: rightVersion.data.word_count,
      }
    : undefined;
  const lines = useMemo(
    () =>
      leftDiff && rightDiff
        ? buildCustomLineDiff(
            `${leftDiff.title}\n\n${leftDiff.content}`,
            `${rightDiff.title}\n\n${rightDiff.content}`,
          )
        : [],
    [leftDiff, rightDiff],
  );
  const changedCount = lines.filter((line) => line.state !== "same").length;

  useTitle(story ? `${story.title} 版本比對 - Storyteller` : "版本比對", {
    path:
      id && storyId && diffId1 && diffId2
        ? `/storyteller/my/project/${id}/story/${storyId}/diff/${diffId1}/${diffId2}`
        : "",
    robots: "noindex, nofollow",
  });

  if (loading) {
    return (
      <StorytellerShell
        title="版本差異比對"
        description="左右對照故事標題與 Markdown 內容，並標示新增、移除與變更行。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
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
        title="版本差異比對"
        description="左右對照故事標題與 Markdown 內容，並標示新增、移除與變更行。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
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
    return <StorytellerLoading label="正在載入版本比對資料..." />;
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
        { label: "Storyteller", to: "/storyteller" },
        { label: "故事專案", to: "/storyteller/my/project" },
        { label: project.name, to: `/storyteller/my/project/${project.id}` },
        {
          label: story.title,
          to: `/storyteller/my/project/${project.id}/story/${story.id}`,
        },
        { label: "版本比對" },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${changedCount} 行差異`} color="warning" />
          <Button
            href={`/storyteller/my/project/${project.id}/story/${story.id}`}
            variant="outlined"
            startIcon={<ArrowBackIcon />}
          >
            返回編輯歷史
          </Button>
        </Stack>
      }
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <CustomDiffPane
            title={leftDiff.title}
            metadataLabels={[
              leftDiff.source,
              formatStorytellerDate(leftDiff.createdAt),
            ]}
            side="left"
            lines={lines}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <CustomDiffPane
            title={rightDiff.title}
            metadataLabels={[
              rightDiff.source,
              formatStorytellerDate(rightDiff.createdAt),
            ]}
            side="right"
            lines={lines}
          />
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
