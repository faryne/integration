import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useParams } from "react-router-dom";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import {
  usePublicStorytellerProject,
  usePublicStorytellerStoryVersions,
} from "@/apis/storyteller.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerWysiwygMarkdown } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { stripMarkerForDiffContent } from "@/pages/storyteller/wysiwygCore/parser.ts";

export default function StorytellerStoryVersionDiff() {
  const { projectPath, storyId, versionId } = useParams();
  const projectPublicId = projectPath?.split("-", 1)[0];
  const projectQuery = usePublicStorytellerProject(projectPath);
  const versionsQuery = usePublicStorytellerStoryVersions(
    projectPublicId,
    storyId,
  );

  const project = projectQuery.data;
  const story = project?.stories?.find((item) => item.public_id === storyId);
  const versions = versionsQuery.data ?? [];
  const targetIndex = versions.findIndex(
    (version) => String(version.id) === versionId,
  );
  const target = targetIndex >= 0 ? versions[targetIndex] : undefined;
  const previous = targetIndex >= 0 ? versions[targetIndex + 1] : undefined;
  const basePath = `/storyteller/story/${projectPath}`;

  useTitle(story ? `${story.title} 版本比較 - Storyteller` : "版本比較", {
    robots: "noindex, nofollow",
  });

  if (projectQuery.isLoading || versionsQuery.isLoading) {
    return (
      <StorytellerShell
        title="版本比較"
        breadcrumbs={[{ label: "Storyteller", to: "/storyteller" }]}
      >
        <StorytellerLoading label="正在載入版本比較..." />
      </StorytellerShell>
    );
  }

  if (!project || !story || !target) {
    return <ErrorPage code={404} />;
  }

  // 先把 marker/comment 屬性濾掉再比對——不然 marker id 沒變化但 comment 有異動的段落，
  // 或單純因為遷移補了新 id，都會被誤判成「內容變了」，畫面上也不該讓使用者看到內部語法。
  const diffLines = buildCustomLineDiff(
    stripMarkerForDiffContent(previous?.content ?? ""),
    stripMarkerForDiffContent(target.content),
  );
  const changedCount = diffLines.filter((line) => line.state !== "same").length;

  return (
    <StorytellerShell
      title="版本比較"
      description={`${story.title} 的版本比較，僅供查看內容差異，無法在此加入或移除書籤。`}
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: project.name, to: `/storyteller/story/${projectPath}` },
        { label: story.title, to: `${basePath}/${story.public_id}` },
        { label: "版本比較" },
      ]}
      action={
        <Button
          component={RouterLink}
          to={`${basePath}/${story.public_id}`}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
        >
          返回 {story.title}
        </Button>
      }
    >
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              {story.title}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1 }}
            >
              <Chip
                size="small"
                color={previous ? "warning" : "default"}
                label={
                  previous
                    ? `與 ${formatStorytellerDate(previous.created_at)} 的版本比較`
                    : "最初版本，無前一版可比較"
                }
              />
              {previous && (
                <Chip size="small" label={`${changedCount} 行差異`} />
              )}
            </Stack>
          </Box>
          <Divider />
          <Stack spacing={0.25}>
            {diffLines.map((line) => {
              if (line.state === "same") {
                if (!line.right.trim()) {
                  return <Box key={line.index} sx={{ height: 12 }} />;
                }
                return (
                  <Box
                    key={line.index}
                    sx={{ typography: "body1", lineHeight: 1.9 }}
                  >
                    <StorytellerWysiwygMarkdown>
                      {line.right}
                    </StorytellerWysiwygMarkdown>
                  </Box>
                );
              }
              return (
                <Box key={line.index} sx={{ py: 0.25 }}>
                  {line.state !== "added" && line.left.trim() && (
                    <Box
                      sx={{
                        bgcolor: "error.light",
                        color: "error.contrastText",
                        borderRadius: 1,
                        px: 1,
                        py: 0.25,
                        textDecoration: "line-through",
                        mb: 0.25,
                        "& *": { textDecoration: "line-through" },
                      }}
                    >
                      <StorytellerWysiwygMarkdown>
                        {line.left}
                      </StorytellerWysiwygMarkdown>
                    </Box>
                  )}
                  {line.state !== "removed" && line.right.trim() && (
                    <Box
                      sx={{
                        bgcolor: "success.light",
                        color: "success.contrastText",
                        borderRadius: 1,
                        px: 1,
                        py: 0.25,
                      }}
                    >
                      <StorytellerWysiwygMarkdown>
                        {line.right}
                      </StorytellerWysiwygMarkdown>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Paper>
    </StorytellerShell>
  );
}
