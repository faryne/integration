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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          onNotify(
            t("web.timeline.messages.publishedAs", { name: author.pen_name }),
          );
        },
        onError: (error) =>
          onNotify(
            apiErrorMessage(error, t("web.timeline.errors.publish")),
            "error",
          ),
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
            placeholder={t("web.timeline.composerPlaceholder")}
            extraTools={
              <>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => setPickerOpen(true)}
                >
                  📎 {t("web.timeline.attachWork")}
                </Button>
                <Button
                  size="small"
                  variant={preview ? "contained" : "outlined"}
                  color="inherit"
                  onClick={() => setPreview((value) => !value)}
                >
                  👁 {t("web.social.preview")}
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
                {t("web.timeline.publish")}
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
                  {t("web.timeline.emptyPreview")}
                </Typography>
              )}
              {attachment && (
                <PostAttachmentCard attachment={attachment.card} />
              )}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary">
            {/* 「以 某筆名 發佈」語序各語言不同，共用 SpeakAs 的前後綴 */}
            {t("web.social.speakAs.prefix", {
              verb: t("web.timeline.publish"),
            })}{" "}
            <b>{author.pen_name}</b>{" "}
            {t("web.social.speakAs.suffix", {
              verb: t("web.timeline.publish"),
            })}
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
  const { t } = useTranslation();
  const { data, isLoading } = useAttachableWorks(penName, open);
  return (
    <StorytellerDialog
      open={open}
      eyebrow={t("web.timeline.attachWork")}
      title={t("web.timeline.attachTitle")}
      onClose={onClose}
      actions={<Button onClick={onClose}>{t("web.common.cancel")}</Button>}
    >
      {isLoading ? (
        <Typography color="text.secondary">
          {t("web.common.loading")}
        </Typography>
      ) : (data ?? []).length === 0 ? (
        <Typography color="text.secondary">
          {t("web.timeline.noPublicWorks")}
        </Typography>
      ) : (
        <List dense sx={{ maxHeight: 420, overflow: "auto" }}>
          {(data ?? []).map((work) => (
            <Box key={work.project_public_id}>
              <ListSubheader disableSticky sx={{ lineHeight: 2.2, px: 1 }}>
                《{work.project_name}》
                {work.rating === "restricted" &&
                  `・${t("web.timeline.restricted")}`}
              </ListSubheader>
              <ListItemButton onClick={() => onPick(work)}>
                <ListItemText primary={t("web.timeline.wholeWork")} />
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
