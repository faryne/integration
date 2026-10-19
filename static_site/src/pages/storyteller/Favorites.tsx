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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        aria-label={t("web.community.favoritesAria")}
      >
        <Tab value="stories" label={t("web.community.works")} />
        <Tab value="authors" label={t("web.community.authors")} />
      </Tabs>

      {isLoading ? (
        <StorytellerLoading
          label={
            tab === "stories" ? t("web.community.loadingFavoriteWorks") : t("web.community.loadingFavoriteAuthors")
          }
        />
      ) : isError ? (
        <Alert severity="error" variant="outlined">
          {t("web.community.favoritesFailed")}
        </Alert>
      ) : tab === "stories" ? (
        projects.length === 0 ? (
          <CustomEmptyState
            icon={<FavoriteIcon fontSize="large" />}
            title={t("web.community.noFollowedWorks")}
            description={t("web.community.noFollowedWorksDescription")}
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
          title={t("web.community.noFollowedAuthors")}
          description={t("web.community.noFollowedAuthorsDescription")}
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
  const { t } = useTranslation();
  const saveVisibility = useSaveFavoriteProjectVisibility(project.public_id);
  const hidden = project.favorite_hidden ?? false;

  return (
    <StorytellerProjectCard
      project={project}
      headerAction={
        <Tooltip title={hidden ? t("web.community.makePublic") : t("web.community.makePrivate")}>
          <span>
            <IconButton
              size="small"
              aria-label={hidden ? t("web.community.makePublic") : t("web.community.makePrivate")}
              disabled={saveVisibility.isPending}
              onClick={() =>
                saveVisibility.mutate(!hidden, {
                  onSuccess: () =>
                    onVisibilityChanged(hidden ? t("web.community.madePublic") : t("web.community.madePrivate")),
                  onError: () =>
                    onVisibilityChanged(t("web.community.projectVisibilityFailed"), "error"),
                })
              }
            >
              {hidden ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </IconButton>
          </span>
        </Tooltip>
      }
      extraChips={
        hidden && <Chip size="small" color="warning" label={t("web.community.hidden")} />
      }
      actions={
        <Button
          component={RouterLink}
          to={storytellerReaderPath(project)}
          variant="contained"
        >
          {t("web.community.startReading")}
        </Button>
      }
    />
  );
}
