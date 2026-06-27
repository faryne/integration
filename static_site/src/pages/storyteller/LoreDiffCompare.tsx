import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerLoreVersion,
  useStorytellerLores,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

type DiffState = "same" | "changed" | "added" | "removed";

function buildLineDiff(left: string, right: string) {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const max = Math.max(leftLines.length, rightLines.length);
  return Array.from({ length: max }, (_, index) => {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    const state: DiffState =
      leftLine === rightLine
        ? "same"
        : !leftLine
          ? "added"
          : !rightLine
            ? "removed"
            : "changed";
    return { index: index + 1, left: leftLine, right: rightLine, state };
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
  title,
  createdAt,
  side,
  lines,
}: {
  title: string;
  createdAt: string;
  side: "left" | "right";
  lines: ReturnType<typeof buildLineDiff>;
}) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
      <Stack spacing={1} sx={{ p: 2, bgcolor: "background.default" }}>
        <Typography variant="h6" fontWeight={800}>
          {title}
        </Typography>
        <Chip size="small" label={formatStorytellerDate(createdAt)} />
      </Stack>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 0,
          overflowX: "auto",
          fontFamily:
            '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
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
            <Box
              component="span"
              sx={{ color: "text.secondary", userSelect: "none" }}
            >
              {line.index}
            </Box>
            <Box component="span">
              {side === "left" ? line.left : line.right || " "}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function StorytellerLoreDiffCompare() {
  const { id, loreId, diffId1, diffId2 } = useParams();
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
  const lines = useMemo(
    () =>
      leftVersion.data && rightVersion.data
        ? buildLineDiff(
            `${leftVersion.data.title}\n\n${leftVersion.data.content}`,
            `${rightVersion.data.title}\n\n${rightVersion.data.content}`,
          )
        : [],
    [leftVersion.data, rightVersion.data],
  );
  const changedCount = lines.filter((line) => line.state !== "same").length;

  useTitle(
    apiLore ? `${apiLore.title} 版本比對 - Storyteller` : "設定集版本比對",
    {
      path:
        id && loreId && diffId1 && diffId2
          ? `/storyteller/my/project/${id}/lore/${loreId}/diff/${diffId1}/${diffId2}`
          : "",
      robots: "noindex, nofollow",
    },
  );

  if (
    (!apiProject && projectsPending) ||
    (apiProject && !apiLore && loresPending) ||
    leftVersion.isLoading ||
    rightVersion.isLoading
  ) {
    return <StorytellerLoading label="正在載入設定集版本比對資料..." />;
  }

  if (!apiProject || !apiLore || !leftVersion.data || !rightVersion.data) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title="設定集版本差異比對"
      description="左右對照設定集標題與 Markdown 內容。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
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
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <DiffPane
            title={leftVersion.data.title}
            createdAt={leftVersion.data.created_at}
            side="left"
            lines={lines}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <DiffPane
            title={rightVersion.data.title}
            createdAt={rightVersion.data.created_at}
            side="right"
            lines={lines}
          />
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
