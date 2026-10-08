import PersonIcon from "@mui/icons-material/Person";
import {
  Avatar,
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useAttachableWorks, useTimelineAction } from "@/apis/storyteller.ts";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { postTextValid } from "@/helpers/postMarkers.ts";
import type { StorytellerAuthorIdentity } from "@/types/storyteller.ts";
import {
  AUTHOR_POST_MAX_LENGTH,
  type AttachableWork,
  type AuthorPostAttachment,
} from "@/types/storytellerTimeline.ts";
import { PostAttachmentCard } from "./PostAttachmentCard.tsx";
import { PostMarkerText } from "./PostMarkerText.tsx";
import { PostTextInput } from "./PostTextInput.tsx";

type Notify = (message: string, severity?: "success" | "error") => void;

// 作者頁「動態」分頁最上方的發文框，只有擁有者看得到。發文身份＝這個頁面的身份。
// 不能編輯已發佈的動態，所以提供預覽：跟發佈後一樣是「文字＋作品卡」，預覽時不另外顯示可移除的卡。
export function AuthorPostComposer({
  author,
  onNotify,
}: {
  author: StorytellerAuthorIdentity;
  onNotify: Notify;
}) {
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attachment, setAttachment] = useState<{
    project: string;
    story?: string;
    card: AuthorPostAttachment;
  } | null>(null);
  const action = useTimelineAction();

  function publish() {
    action.mutate(
      {
        type: "create-post",
        penName: author.pen_name,
        input: {
          body,
          attach_project_public_id: attachment?.project,
          attach_story_public_id: attachment?.story,
        },
      },
      {
        onSuccess: () => {
          setBody("");
          setAttachment(null);
          setPreview(false);
          onNotify(`已以 ${author.pen_name} 發佈`);
        },
        onError: (error) =>
          onNotify(apiErrorMessage(error, "發佈失敗，請重試。"), "error"),
      },
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Avatar src={author.avatar_url} alt={author.pen_name}>
          <PersonIcon />
        </Avatar>
        <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
          <PostTextInput
            value={body}
            onChange={setBody}
            maxLength={AUTHOR_POST_MAX_LENGTH}
            placeholder="想說點什麼？公告、近況、創作碎念都可以"
            extraTools={
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => setPickerOpen(true)}
                >
                  📎 附上作品
                </Button>
                <Button
                  size="small"
                  variant={preview ? "contained" : "outlined"}
                  color="inherit"
                  onClick={() => setPreview((value) => !value)}
                >
                  👁 預覽
                </Button>
              </>
            }
            footer={
              <Button
                variant="contained"
                disabled={
                  !postTextValid(body, AUTHOR_POST_MAX_LENGTH) ||
                  action.isPending
                }
                onClick={publish}
              >
                發佈
              </Button>
            }
          />
          {attachment && !preview && (
            <PostAttachmentCard
              attachment={attachment.card}
              onRemove={() => setAttachment(null)}
            />
          )}
          {preview && (
            <Box
              sx={{
                p: 1.5,
                border: 1,
                borderStyle: "dashed",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              {body.trim() ? (
                <PostMarkerText body={body} />
              ) : (
                <Typography variant="body2" color="text.disabled">
                  （沒有內容）
                </Typography>
              )}
              {attachment && (
                <PostAttachmentCard attachment={attachment.card} />
              )}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">
            以 <b>{author.pen_name}</b> 發佈
          </Typography>
        </Stack>
      </Stack>
      <AttachWorkDialog
        open={pickerOpen}
        penName={author.pen_name}
        onClose={() => setPickerOpen(false)}
        onPick={(work, story) => {
          setAttachment({
            project: work.project_public_id,
            story: story?.public_id,
            card: {
              project_public_id: work.project_public_id,
              project_name: work.project_name,
              rating: work.rating,
              story_public_id: story?.public_id,
              story_title: story?.title,
              volume_title: story?.volume_title,
            },
          });
          setPickerOpen(false);
        }}
      />
    </Paper>
  );
}

// 作品卡候選：只列這個身份署名、目前公開的作品；可以附整部作品或某一話
function AttachWorkDialog({
  open,
  penName,
  onClose,
  onPick,
}: {
  open: boolean;
  penName: string;
  onClose: () => void;
  onPick: (
    work: AttachableWork,
    story?: AttachableWork["stories"][number],
  ) => void;
}) {
  const { data, isLoading } = useAttachableWorks(penName, open);
  return (
    <StorytellerDialog
      open={open}
      eyebrow="附上作品"
      title="選一部作品或其中一話"
      onClose={onClose}
      actions={<Button onClick={onClose}>取消</Button>}
    >
      {isLoading ? (
        <Typography color="text.secondary">載入中…</Typography>
      ) : (data ?? []).length === 0 ? (
        <Typography color="text.secondary">
          這個身份目前沒有公開的作品。
        </Typography>
      ) : (
        <List dense sx={{ maxHeight: 420, overflow: "auto" }}>
          {(data ?? []).map((work) => (
            <Box key={work.project_public_id}>
              <ListSubheader disableSticky sx={{ lineHeight: 2.2, px: 1 }}>
                《{work.project_name}》
                {work.rating === "restricted" && "・限制級"}
              </ListSubheader>
              <ListItemButton onClick={() => onPick(work)}>
                <ListItemText primary="整部作品（作品首頁）" />
              </ListItemButton>
              {work.stories.map((story) => (
                <ListItemButton
                  key={story.public_id}
                  onClick={() => onPick(work, story)}
                  sx={{ pl: 3 }}
                >
                  <ListItemText
                    primary={story.title}
                    secondary={story.volume_title}
                    primaryTypographyProps={{ noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </Box>
          ))}
        </List>
      )}
    </StorytellerDialog>
  );
}
