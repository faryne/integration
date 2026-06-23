import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerProjects,
  useStorytellerStoryVersion,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import {
  formatStorytellerDate,
  storytellerProjects,
  storytellerStories,
  storytellerStoryDiffs,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

type DiffState = "same" | "changed" | "added" | "removed";

interface CompareDiff {
  id: string;
  title: string;
  content: string;
  source: string;
  createdAt: string;
  words: number;
}

interface DiffLine {
  index: number;
  left: string;
  right: string;
  state: DiffState;
}

function buildLineDiff(left: string, right: string): DiffLine[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const max = Math.max(leftLines.length, rightLines.length);

  return Array.from({ length: max }, (_, index) => {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    let state: DiffState = "same";

    if (leftLine !== rightLine) {
      if (!leftLine) {
        state = "added";
      } else if (!rightLine) {
        state = "removed";
      } else {
        state = "changed";
      }
    }

    return {
      index: index + 1,
      left: leftLine,
      right: rightLine,
      state,
    };
  });
}

function lineSx(state: DiffState, side: "left" | "right") {
  if (state === "same") {
    return { bgcolor: "transparent" };
  }
  if (state === "added") {
    return side === "right"
      ? { bgcolor: "success.light", color: "success.contrastText" }
      : { bgcolor: "action.hover", color: "text.secondary" };
  }
  if (state === "removed") {
    return side === "left"
      ? { bgcolor: "error.light", color: "error.contrastText" }
      : { bgcolor: "action.hover", color: "text.secondary" };
  }
  return { bgcolor: "warning.light" };
}

function DiffPane({
  diff,
  side,
  lines,
}: {
  diff: CompareDiff;
  side: "left" | "right";
  lines: DiffLine[];
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
      <Stack spacing={1} sx={{ p: 2, bgcolor: "background.default" }}>
        <Typography variant="h6" fontWeight={800}>
          {diff.title}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={diff.source} />
          <Chip size="small" label={formatStorytellerDate(diff.createdAt)} />
          <Chip size="small" label={diff.id} />
        </Stack>
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 0,
          overflowX: "auto",
          fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontSize: 13,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {lines.map((line) => (
          <Box
            key={`${side}-${line.index}`}
            component="span"
            sx={{
              display: "grid",
              gridTemplateColumns: "48px minmax(0, 1fr)",
              px: 1.5,
              py: 0.25,
              ...lineSx(line.state, side),
            }}
          >
            <Box component="span" sx={{ color: "text.secondary", userSelect: "none" }}>
              {line.index}
            </Box>
            <Box component="span">{side === "left" ? line.left : line.right || " "}</Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function StorytellerStoryDiffCompare() {
  const { id, storyId, diffId1, diffId2 } = useParams();
  const { data: apiProjects = [], isPending: apiProjectsPending } =
    useStorytellerProjects();
  const apiProject = apiProjects.find((item) => item.public_id === id);
  const mockProject = storytellerProjects.find((item) => item.id === id);
  const project = apiProject
    ? {
        id: apiProject.public_id,
        name: apiProject.name,
      }
    : mockProject
      ? {
          id: mockProject.id,
          name: mockProject.name,
        }
      : undefined;
  const { data: apiStories = [], isPending: apiStoriesPending } =
    useStorytellerStories(apiProject?.public_id);
  const apiStory = apiStories.find((item) => item.public_id === storyId);
  const mockStory = storytellerStories.find(
    (item) => item.projectId === id && item.id === storyId,
  );
  const story = apiStory
    ? {
        id: apiStory.public_id,
        title: apiStory.title,
      }
    : mockStory
      ? {
          id: mockStory.id,
          title: mockStory.title,
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
  const leftMockDiff = storytellerStoryDiffs.find(
    (item) => item.storyId === storyId && item.id === diffId1,
  );
  const rightMockDiff = storytellerStoryDiffs.find(
    (item) => item.storyId === storyId && item.id === diffId2,
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
    : leftMockDiff;
  const rightDiff: CompareDiff | undefined = rightVersion.data
    ? {
        id: String(rightVersion.data.id),
        title: rightVersion.data.title,
        content: rightVersion.data.content,
        source: "手動編輯",
        createdAt: rightVersion.data.created_at,
        words: rightVersion.data.word_count,
      }
    : rightMockDiff;
  const lines = useMemo(
    () =>
      leftDiff && rightDiff
        ? buildLineDiff(
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
        ? `/storyteller/project/${id}/story/${storyId}/diff/${diffId1}/${diffId2}`
        : "",
    robots: "noindex, nofollow",
  });

  if (
    (!project && apiProjectsPending) ||
    (apiProject && !story && apiStoriesPending) ||
    leftVersion.isLoading ||
    rightVersion.isLoading
  ) {
    return (
      <Stack alignItems="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
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
        { label: "Storyteller", to: "/storyteller" },
        { label: "專案列表", to: "/storyteller/project" },
        { label: project.name, to: `/storyteller/project/${project.id}` },
        {
          label: story.title,
          to: `/storyteller/project/${project.id}/story/${story.id}`,
        },
        { label: "版本比對" },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${changedCount} 行差異`} color="warning" />
          <Button
            href={`/storyteller/project/${project.id}/story/${story.id}`}
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
          <DiffPane diff={leftDiff} side="left" lines={lines} />
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <DiffPane diff={rightDiff} side="right" lines={lines} />
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
