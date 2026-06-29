import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, Chip, Grid, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerLoreVersion,
  useStorytellerLores,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import { CustomDiffPane } from "@/components/common/CustomDiffPane.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerLoreDiffCompare() {
  const { id, loreId, diffId1, diffId2 } = useParams();
  const { session, loading, login, submitting } = useAuth();
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
        ? buildCustomLineDiff(
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

  if (loading) {
    return (
      <StorytellerShell
        title="設定集版本差異比對"
        description="左右對照設定集標題與 Markdown 內容。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
          { label: "版本比對" },
        ]}
      >
        <Stack alignItems="center" sx={{ py: 8 }}>
          <Typography color="text.secondary">正在確認登入狀態...</Typography>
        </Stack>
      </StorytellerShell>
    );
  }

  if (!session) {
    return (
      <StorytellerShell
        title="設定集版本差異比對"
        description="左右對照設定集標題與 Markdown 內容。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "故事專案", to: "/storyteller/my/project" },
          { label: "版本比對" },
        ]}
      >
        <CustomLoginRequiredState
          description="登入後即可查看設定集編輯歷史比對。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

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
          <CustomDiffPane
            title={leftVersion.data.title}
            metadataLabels={[formatStorytellerDate(leftVersion.data.created_at)]}
            side="left"
            lines={lines}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <CustomDiffPane
            title={rightVersion.data.title}
            metadataLabels={[
              formatStorytellerDate(rightVersion.data.created_at),
            ]}
            side="right"
            lines={lines}
          />
        </Grid>
      </Grid>
    </StorytellerShell>
  );
}
