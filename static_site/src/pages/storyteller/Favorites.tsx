import FavoriteIcon from "@mui/icons-material/Favorite";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Alert,
  Button,
  Chip,
  Grid,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useFavoriteStorytellerAuthors,
  useFavoriteStorytellerProjects,
  useSaveFavoriteProjectVisibility,
} from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { storytellerReaderPath } from "@/data/storyteller.ts";
import { StorytellerFavoriteAuthorCard } from "@/pages/storyteller/StorytellerFavoriteAuthorCard.tsx";
import { StorytellerProjectCard } from "@/pages/storyteller/StorytellerProjectCard.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerProject } from "@/types/storyteller.ts";

// 「我的追蹤」的內容——掛在 /my 工作台殼底下（見 Home.tsx），登入狀態已經由
// Home.tsx 統一擋過，這裡不用再自己判斷 session。
export function StorytellerFavoritesContent() {
  const [tab, setTab] = useState<"stories" | "authors">("stories");
  const [visibilitySnack, setVisibilitySnack] = useState<{
    message: string;
    severity: "success" | "error";
  }>({ message: "", severity: "success" });
  const notifyVisibility = (
    message: string,
    severity: "success" | "error" = "success",
  ) => setVisibilitySnack({ message, severity });
  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
  } = useFavoriteStorytellerProjects();
  const {
    data: authors = [],
    isLoading: authorsLoading,
    isError: authorsError,
  } = useFavoriteStorytellerAuthors();
  const isLoading = tab === "stories" ? projectsLoading : authorsLoading;
  const isError = tab === "stories" ? projectsError : authorsError;

  return (
    <Stack spacing={2}>
      <Tabs
        value={tab}
        onChange={(_, value: "stories" | "authors") => setTab(value)}
        aria-label="追蹤分類"
      >
        <Tab value="stories" label="作品" />
        <Tab value="authors" label="作者" />
      </Tabs>

      {isLoading ? (
        <StorytellerLoading
          label={
            tab === "stories" ? "正在載入追蹤作品..." : "正在載入追蹤作者..."
          }
        />
      ) : isError ? (
        <Alert severity="error" variant="outlined">
          讀取追蹤清單失敗，請確認登入狀態後再試一次。
        </Alert>
      ) : tab === "stories" ? (
        projects.length === 0 ? (
          <CustomEmptyState
            icon={<FavoriteIcon fontSize="large" />}
            title="尚未追蹤作品"
            description="在作品閱讀頁按下追蹤後，會在此列出創作專案。"
          />
        ) : (
          <Grid container spacing={2}>
            {projects.map((project) => (
              <Grid key={project.public_id} size={{ xs: 12, md: 6, lg: 4 }}>
                <FavoriteProjectCard
                  project={project}
                  onVisibilityChanged={notifyVisibility}
                />
              </Grid>
            ))}
          </Grid>
        )
      ) : authors.length === 0 ? (
        <CustomEmptyState
          icon={<PersonIcon fontSize="large" />}
          title="尚未追蹤作者"
          description="在作品閱讀頁按下追蹤作者後，會在此列出作者。"
        />
      ) : (
        <Grid container spacing={2}>
          {/* 同一位作者可能本人與筆名各追蹤一次，key 要帶上追蹤身份 */}
          {authors.map((author) => (
            <Grid
              key={`${author.as ?? ""}:${author.pen_name}`}
              size={{ xs: 12, md: 6, lg: 4 }}
            >
              <StorytellerFavoriteAuthorCard
                author={author}
                canToggleVisibility
                unfollowAs={author.as}
                onNotify={notifyVisibility}
              />
            </Grid>
          ))}
        </Grid>
      )}
      <CustomSnackbar
        open={Boolean(visibilitySnack.message)}
        message={visibilitySnack.message}
        severity={visibilitySnack.severity}
        onClose={() =>
          setVisibilitySnack((current) => ({ ...current, message: "" }))
        }
      />
    </Stack>
  );
}

function FavoriteProjectCard({
  project,
  onVisibilityChanged,
}: {
  project: StorytellerProject;
  onVisibilityChanged: (
    message: string,
    severity?: "success" | "error",
  ) => void;
}) {
  const saveVisibility = useSaveFavoriteProjectVisibility(project.public_id);
  const hidden = project.favorite_hidden ?? false;

  return (
    <StorytellerProjectCard
      project={project}
      headerAction={
        <Tooltip title={hidden ? "設為公開" : "設為隱藏"}>
          <span>
            <IconButton
              size="small"
              aria-label={hidden ? "設為公開" : "設為隱藏"}
              disabled={saveVisibility.isPending}
              onClick={() =>
                saveVisibility.mutate(!hidden, {
                  onSuccess: () =>
                    onVisibilityChanged(hidden ? "已設為公開" : "已設為隱藏"),
                  onError: () =>
                    onVisibilityChanged("追蹤作品公開狀態更新失敗。", "error"),
                })
              }
            >
              {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          </span>
        </Tooltip>
      }
      extraChips={
        hidden && <Chip size="small" color="warning" label="對外隱藏中" />
      }
      actions={
        <Button
          component={RouterLink}
          to={storytellerReaderPath(project)}
          variant="contained"
        >
          開始閱讀
        </Button>
      }
    />
  );
}
