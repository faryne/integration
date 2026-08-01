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
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { StorytellerWysiwygMarkdown } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import { renderFootnoteNote } from "@/pages/storyteller/wysiwygCore/footnoteRender.tsx";
import {
  extractFootnoteNotesForDiff,
  parseMarkdownToParagraphs,
  stripMarkerForDiffContent,
} from "@/pages/storyteller/wysiwygCore/parser.ts";

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
  const basePath = steamloomPath(`work/${projectPath}/story`);

  useTitle(
    story ? `${story.title} 版本比較 - ${STORYTELLER_APP_NAME}` : "版本比較",
    {
      robots: "noindex, nofollow",
    },
  );

  if (projectQuery.isLoading || versionsQuery.isLoading) {
    return (
      <StorytellerShell
        title="版本比較"
        breadcrumbs={[{ label: STORYTELLER_APP_NAME, to: steamloomPath() }]}
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

  // 逐行預先算好左右兩欄各自「這一行在目前這串連續有序清單裡排第幾個」——儲存內容裡
  // 每個有序清單項目的前綴永遠是固定的 "1. "，真正編號交給渲染端的原生 <ol> 接續處理，
  // 但這裡是逐行各自呼叫一次 StorytellerWysiwygMarkdown（每個實例天生只有一個 <li>），
  // 瀏覽器沒辦法跨實例接續，所以要自己算好傳進去，用 <ol start={N}> 補回視覺上的連續
  // 編號（見 StorytellerWysiwygMarkdown 的 orderedListStart 說明，跟 Reader.tsx 的
  // StoryContentLines 同一套修法）。左右兩欄是各自獨立的內容流：state 為 same 的行代表
  // 兩欄內容目前一致，計數器要同步往前，遇到空行也要同步歸零；只有單邊有內容的行
  // （added/removed，或 changed 裡剛好某一邊 trim 後是空的），只推進那一邊，另一邊維持
  // 不變——因為那一版的清單其實沒有中斷，只是這一行沒有被顯示在該欄。用一般 for 迴圈
  // 直接在函式作用域裡累加，不透過 .map() 的 callback 閉包改外層變數（React Compiler
  // 的靜態分析會把這種寫法當成不安全的 render 期間 mutation 擋下來）。
  const leftOrderedListStarts: number[] = [];
  const rightOrderedListStarts: number[] = [];
  let leftListRun = 0;
  let rightListRun = 0;
  for (const line of diffLines) {
    if (line.state === "same") {
      if (!line.right.trim()) {
        leftListRun = 0;
        rightListRun = 0;
      } else {
        const isNumber =
          parseMarkdownToParagraphs(line.right)[0].blockKind === "number";
        leftListRun = isNumber ? leftListRun + 1 : 0;
        rightListRun = isNumber ? rightListRun + 1 : 0;
      }
    } else {
      if (line.left.trim()) {
        leftListRun =
          parseMarkdownToParagraphs(line.left)[0].blockKind === "number"
            ? leftListRun + 1
            : 0;
      }
      if (line.right.trim()) {
        rightListRun =
          parseMarkdownToParagraphs(line.right)[0].blockKind === "number"
            ? rightListRun + 1
            : 0;
      }
    }
    leftOrderedListStarts.push(leftListRun);
    rightOrderedListStarts.push(rightListRun);
  }

  // 腳注拆成獨立區塊比對，不跟著本文那一行進入上面的 diffLines——閱讀頁把腳注放在故事
  // 尾端渲染，diff 也比照辦理。兩邊都沒有腳注時就不顯示這個區塊。
  const previousFootnotes = extractFootnoteNotesForDiff(
    previous?.content ?? "",
  );
  const targetFootnotes = extractFootnoteNotesForDiff(target.content);
  const footnoteDiffLines = buildCustomLineDiff(
    previousFootnotes.join("\n"),
    targetFootnotes.join("\n"),
  );
  const hasFootnotes =
    previousFootnotes.length > 0 || targetFootnotes.length > 0;

  return (
    <StorytellerShell
      title="版本比較"
      description={`${story.title} 的版本比較，僅供查看內容差異，無法在此加入或移除書籤。`}
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        {
          label: project.name,
          to: steamloomPath(`work/${projectPath}/stories`),
        },
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
            {diffLines.map((line, i) => {
              if (line.state === "same") {
                if (!line.right.trim()) {
                  return <Box key={line.index} sx={{ height: 12 }} />;
                }
                return (
                  <Box
                    key={line.index}
                    sx={{ typography: "body1", lineHeight: 1.9 }}
                  >
                    <StorytellerWysiwygMarkdown
                      orderedListStart={rightOrderedListStarts[i] || undefined}
                    >
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
                      <StorytellerWysiwygMarkdown
                        orderedListStart={leftOrderedListStarts[i] || undefined}
                      >
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
                      <StorytellerWysiwygMarkdown
                        orderedListStart={
                          rightOrderedListStarts[i] || undefined
                        }
                      >
                        {line.right}
                      </StorytellerWysiwygMarkdown>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Stack>

          {hasFootnotes && (
            <>
              <Divider />
              <Typography variant="subtitle1" fontWeight={700}>
                腳注
              </Typography>
              <Stack spacing={0.25}>
                {footnoteDiffLines.map((line) => {
                  if (line.state === "same") {
                    if (!line.right.trim()) {
                      return <Box key={line.index} sx={{ height: 12 }} />;
                    }
                    return (
                      <Box
                        key={line.index}
                        sx={{ typography: "body2", lineHeight: 1.9 }}
                      >
                        {renderFootnoteNote(line.right)}
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
                          {renderFootnoteNote(line.left)}
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
                          {renderFootnoteNote(line.right)}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}
        </Stack>
      </Paper>
    </StorytellerShell>
  );
}
