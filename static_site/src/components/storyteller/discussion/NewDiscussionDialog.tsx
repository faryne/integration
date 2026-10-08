import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { useState } from "react";
import { useDiscussionAction } from "@/apis/storyteller.ts";
import { SpeakAs } from "@/components/storyteller/comments/CommentBox.tsx";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { PostMarkerText } from "@/components/storyteller/timeline/PostMarkerText.tsx";
import { PostTextInput } from "@/components/storyteller/timeline/PostTextInput.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { postTextValid } from "@/helpers/postMarkers.ts";
import type { ReaderDiscussionContext } from "./discussionContext.ts";

type Notify = (message: string, severity?: "success" | "error") => void;

// 「關於」：閱讀頁、設定頁的 modal 開的已經確定錨點；只有討論分頁開的才讓人選
export type DiscussionAnchorChoice =
  | { kind: "fixed"; story?: string; lore?: string; label: string }
  | { kind: "pick" };

// 發起討論：標題＋內文（不統計字數，可用劇透／R18 標籤、可預覽），作者可切換作品署名身份。
export function NewDiscussionDialog({
  open,
  context,
  anchor,
  asOptions,
  onClose,
  onCreated,
  onNotify,
}: {
  open: boolean;
  context: ReaderDiscussionContext;
  anchor: DiscussionAnchorChoice;
  asOptions: string[];
  onClose: () => void;
  onCreated: (threadId: string) => void;
  onNotify: Notify;
}) {
  const action = useDiscussionAction(context.share);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [as, setAs] = useState(asOptions[0] ?? "");
  const [about, setAbout] = useState<"none" | "story" | "lore">("none");
  const [storyId, setStoryId] = useState(context.stories[0]?.id ?? "");
  const [loreId, setLoreId] = useState(context.lores[0]?.id ?? "");

  function submit() {
    const fixed = anchor.kind === "fixed" ? anchor : undefined;
    action
      .mutateAsync({
        type: "create",
        projectId: context.projectPublicId,
        input: {
          title,
          body,
          as,
          anchor_story: fixed
            ? fixed.story
            : about === "story"
              ? storyId
              : undefined,
          anchor_lore: fixed
            ? fixed.lore
            : about === "lore"
              ? loreId
              : undefined,
        },
      })
      .then((created) => {
        onNotify("已發起討論");
        setTitle("");
        setBody("");
        setPreview(false);
        onCreated(
          (created as { public_id?: string } | undefined)?.public_id ?? "",
        );
      })
      .catch((error) =>
        onNotify(apiErrorMessage(error, "發起失敗，請重試。"), "error"),
      );
  }

  return (
    <StorytellerDialog
      open={open}
      maxWidth="sm"
      title={anchor.kind === "fixed" ? `發起討論・${anchor.label}` : "發起討論"}
      onClose={onClose}
      actions={
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ width: 1 }}
        >
          <Box sx={{ flex: 1 }}>
            <SpeakAs
              options={asOptions}
              value={as}
              onChange={setAs}
              verb="發起"
            />
          </Box>
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="contained"
            disabled={action.isPending || !title.trim() || !postTextValid(body)}
            onClick={submit}
          >
            發起
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <TextField
          label="標題"
          size="small"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
        />
        {anchor.kind === "pick" && (
          <Stack spacing={1}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={about}
              onChange={(_, value) => value && setAbout(value)}
              aria-label="關於"
            >
              <ToggleButton value="none">不指定</ToggleButton>
              <ToggleButton value="story" disabled={!context.stories.length}>
                故事
              </ToggleButton>
              <ToggleButton value="lore" disabled={!context.lores.length}>
                設定
              </ToggleButton>
            </ToggleButtonGroup>
            {about === "story" && (
              <TextField
                select
                size="small"
                value={storyId}
                onChange={(event) => setStoryId(event.target.value)}
              >
                {context.stories.map((story) => (
                  <MenuItem key={story.id} value={story.id}>
                    {story.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            {about === "lore" && (
              <TextField
                select
                size="small"
                value={loreId}
                onChange={(event) => setLoreId(event.target.value)}
              >
                {context.lores.map((lore) => (
                  <MenuItem key={lore.id} value={lore.id}>
                    {lore.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        )}
        <PostTextInput
          value={body}
          onChange={setBody}
          placeholder=""
          minRows={5}
          extraTools={
            <Button
              size="small"
              variant={preview ? "contained" : "outlined"}
              color="inherit"
              onClick={() => setPreview((value) => !value)}
            >
              👁 預覽
            </Button>
          }
          footer={null}
        />
        {preview && body.trim() && (
          <Box
            sx={{
              p: 1.5,
              border: 1,
              borderStyle: "dashed",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <PostMarkerText body={body} />
          </Box>
        )}
      </Stack>
    </StorytellerDialog>
  );
}
