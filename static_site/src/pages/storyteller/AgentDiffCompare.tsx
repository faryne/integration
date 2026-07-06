import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  useStorytellerAgentPromptVersion,
  useStorytellerAgents,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import { CustomDiffLegend } from "@/components/common/CustomDiffLegend.tsx";
import { CustomDiffSection } from "@/components/common/CustomDiffSection.tsx";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type { StorytellerAgentPromptVersion } from "@/types/storyteller.ts";

function buildAgentDiffSections(
  left: StorytellerAgentPromptVersion,
  right: StorytellerAgentPromptVersion,
) {
  return [
    {
      key: "name",
      title: "AI Agent 名稱",
      lines: buildCustomLineDiff(left.name, right.name),
    },
    {
      key: "provider",
      title: "AI 供應商",
      lines: buildCustomLineDiff(left.provider, right.provider),
    },
    {
      key: "model",
      title: "模型名稱",
      lines: buildCustomLineDiff(left.model_name, right.model_name),
    },
    {
      key: "prompt",
      title: "提示詞內容",
      lines: buildCustomLineDiff(left.default_prompt, right.default_prompt),
    },
  ];
}

export default function StorytellerAgentDiffCompare() {
  const { agentId, diffId1, diffId2 } = useParams();
  const editAgentId = agentId ? Number(agentId) : undefined;
  const { session, loading, login, submitting } = useAuth();
  const { data: agents = [], isLoading: agentsLoading } =
    useStorytellerAgents();
  const agent = agents.find((item) => item.id === editAgentId);
  const leftVersion = useStorytellerAgentPromptVersion(editAgentId, diffId1);
  const rightVersion = useStorytellerAgentPromptVersion(editAgentId, diffId2);
  const diffSections = useMemo(
    () =>
      leftVersion.data && rightVersion.data
        ? buildAgentDiffSections(leftVersion.data, rightVersion.data)
        : [],
    [leftVersion.data, rightVersion.data],
  );
  const changedCount = diffSections.reduce(
    (total, section) =>
      total + section.lines.filter((line) => line.state !== "same").length,
    0,
  );

  useTitle(agent ? `${agent.name} Prompt 版本比對 - Storyteller` : "Prompt 版本比對", {
    path:
      agentId && diffId1 && diffId2
        ? `/storyteller/my/agent/${agentId}/diff/${diffId1}/${diffId2}`
        : "",
    robots: "noindex, nofollow",
  });

  if (loading) {
    return (
      <StorytellerShell
        title="Prompt 版本差異比對"
        description="左右對照 AI Agent 設定與 Prompt 內容。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "AI Agent", to: "/storyteller/my/agent" },
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
        title="Prompt 版本差異比對"
        description="左右對照 AI Agent 設定與 Prompt 內容。"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "AI Agent", to: "/storyteller/my/agent" },
          { label: "版本比對" },
        ]}
      >
        <CustomLoginRequiredState
          description="登入後即可查看 AI Agent Prompt 編輯歷史比對。"
          onLogin={() => void login()}
          submitting={submitting}
        />
      </StorytellerShell>
    );
  }

  if (
    agentsLoading ||
    leftVersion.isLoading ||
    rightVersion.isLoading
  ) {
    return (
      <StorytellerShell
        title="Prompt 版本差異比對"
        breadcrumbs={[
          { label: "Storyteller", to: "/storyteller" },
          { label: "AI Agent", to: "/storyteller/my/agent" },
          { label: "版本比對" },
        ]}
      >
        <StorytellerLoading label="正在載入 Prompt 版本比對資料..." />
      </StorytellerShell>
    );
  }

  if (!agent || !leftVersion.data || !rightVersion.data) {
    return <ErrorPage code={404} />;
  }

  return (
    <StorytellerShell
      title="Prompt 版本差異比對"
      description="左右對照 AI Agent 設定與 Prompt 內容。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "AI Agent", to: "/storyteller/my/agent" },
        { label: agent.name, to: `/storyteller/my/agent/${agent.id}/edit` },
        { label: "版本比對" },
      ]}
      action={
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`${changedCount} 行差異`} color="warning" />
          <Button
            href={`/storyteller/my/agent/${agent.id}/edit`}
            startIcon={<ArrowBackIcon />}
            variant="outlined"
          >
            回 AI Agent
          </Button>
        </Stack>
      }
    >
      <Stack spacing={3}>
        <CustomDiffLegend />
        {diffSections.map((section) => (
          <CustomDiffSection
            key={section.key}
            title={section.title}
            lines={section.lines}
            leftMetadataLabels={[
              formatStorytellerDate(leftVersion.data.created_at),
            ]}
            rightMetadataLabels={[
              formatStorytellerDate(rightVersion.data.created_at),
            ]}
          />
        ))}
      </Stack>
    </StorytellerShell>
  );
}
