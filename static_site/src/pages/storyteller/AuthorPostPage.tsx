import { Button, Paper } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAuthorPost } from "@/apis/storyteller.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { AuthorPostCard } from "@/components/storyteller/timeline/AuthorPostCard.tsx";
import { CommentSection } from "@/components/storyteller/timeline/CommentSection.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { maskPostMarkers } from "@/helpers/postMarkers.ts";
import {
  steamloomCreatorPath,
  steamloomPath,
  steamloomPostPath,
  steamloomPostsPath,
} from "@/helpers/steamloom.ts";
import { steamloomCreatorSeo } from "@/helpers/steamloomCreatorSeo.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

// 作者動態單頁：貼文＋留言串。分享連結、通知連結都指這裡；只靠 postId 查，
// 網址裡的筆名過時（作者改過名）時換成目前的筆名，舊連結不會壞。
export default function StorytellerAuthorPostPage() {
  const { t } = useTranslation();
  const { username = "", postId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAuthorPost(postId);
  const [loginOpen, setLoginOpen] = useState(false);
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  } | null>(null);
  const notify = (message: string, severity: "success" | "error" = "success") =>
    setSnack({ message, severity });
  const penName = data?.post.author.pen_name ?? username;

  useEffect(() => {
    if (data && postId && data.post.author.pen_name !== username) {
      navigate(
        `${steamloomPostPath(data.post.author.pen_name, postId)}${location.hash}`,
        { replace: true },
      );
    }
  }, [data, postId, username, location.hash, navigate]);

  // 標題、描述跟後端社群預覽卡同一套格式（摘要先遮劇透／R18 標記）
  const seo = steamloomCreatorSeo(
    penName,
    "posts",
    data ? maskPostMarkers(data.post.body) : undefined,
  );
  useTitle(seo.title, {
    path: postId ? steamloomPostPath(penName, postId) : undefined,
    description: seo.description,
    type: "article",
    robots: isError ? "noindex, nofollow" : "index, follow",
  });

  const breadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: penName, to: steamloomCreatorPath(penName) },
    { label: t("web.community.tabs.posts"), to: steamloomPostsPath(penName) },
    { label: t("web.community.post") },
  ];

  if (isLoading) {
    return (
      <StorytellerShell title={t("web.community.authorPosts", { name: penName })} breadcrumbs={breadcrumbs}>
        <StorytellerLoading label={t("web.community.loadingPosts")} />
      </StorytellerShell>
    );
  }
  if (isError || !data) return <ErrorPage code={404} />;

  return (
    <StorytellerShell
      title={t("web.community.authorPosts", { name: penName })}
      breadcrumbs={breadcrumbs}
      action={
        <Button
          component={RouterLink}
          to={steamloomPostsPath(penName)}
          variant="outlined"
        >
          {t("web.community.backToPosts", { name: penName })}
        </Button>
      }
    >
      <LoginPromptDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        description={t("web.community.interactionLogin")}
      />
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
      <Paper
        variant="outlined"
        sx={{ borderRadius: 1, overflow: "hidden", maxWidth: 760, mx: "auto" }}
      >
        <AuthorPostCard
          post={data.post}
          detail
          onNotify={notify}
          onLoginRequired={
            data.comment_state === "login"
              ? () => setLoginOpen(true)
              : undefined
          }
        />
        <CommentSection
          detail={data}
          onNotify={notify}
          onLoginRequired={() => setLoginOpen(true)}
        />
      </Paper>
    </StorytellerShell>
  );
}
