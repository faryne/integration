import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useStorytellerAgentPromptVersions,
  useSaveStorytellerAgent,
  useStorytellerAgents,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { CustomLoginRequiredState } from "@/components/common/CustomLoginRequiredState.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import {
  StoryEditHistory,
  type StoryEditHistoryItem,
} from "@/pages/storyteller/StoryEditHistory.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";
import {
  StorytellerVersionCompareDialog,
  type StorytellerVersionCompareEntry,
} from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import type {
  StorytellerAgentPromptVersion,
  StorytellerAgentRequest,
} from "@/types/storyteller.ts";

function agentVersionToCompareEntry(
  version: StorytellerAgentPromptVersion,
): StorytellerVersionCompareEntry {
  return {
    title: version.name,
    content: version.default_prompt,
    contentLabel: "Prompt 內容",
    includeFootnotes: false,
    source: "Skill",
    createdAt: version.created_at,
  };
}

export interface StorytellerNewAgentProps {
  embedded?: boolean;
}

export default function StorytellerNewAgent({
  embedded = false,
}: StorytellerNewAgentProps = {}) {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const { session, loading: authLoading, login, submitting } = useAuth();
  const editAgentId = agentId ? Number(agentId) : undefined;
  const isEdit = Number.isFinite(editAgentId);
  const {
    data: agents = [],
    isLoading: agentsLoading,
    isFetching: agentsFetching,
  } = useStorytellerAgents();
  const agent = agents.find((item) => item.id === editAgentId);
  const { data: promptVersions = [], isLoading: promptVersionsLoading } =
    useStorytellerAgentPromptVersions(editAgentId);
  const saveAgent = useSaveStorytellerAgent();
  const [tab, setTab] = useState("settings");
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  // provider／model_name／provider_apikey_id 已經跟 Agent 人設剝離（AI 助理面板
  // 改用 key／model chip 讓使用者每次呼叫時自行指定），這裡不再收集，固定送空值
  // ——欄位仍留在後端 schema 上（沒有 migration），純粹是這個表單不再填。
  const [input, setInput] = useState<StorytellerAgentRequest>({
    name: "",
    provider: "",
    model_name: "",
    provider_apikey_id: null,
    default_prompt: "",
  });

  useEffect(() => {
    if (!agent) {
      return;
    }
    setInput({
      name: agent.name,
      provider: agent.provider,
      model_name: agent.model_name,
      provider_apikey_id: agent.provider_apikey_id,
      default_prompt: agent.default_prompt,
    });
  }, [agent]);

  const agentHistoryItems: StoryEditHistoryItem[] = promptVersions.map(
    (version) => ({
      id: String(version.id),
      title: `${version.name} / ${version.model_name}`,
      source: version.provider,
      createdAt: version.created_at,
      words: Array.from(version.default_prompt ?? "").length,
    }),
  );
  const leftCompareVersion = promptVersions.find(
    (version) => String(version.id) === leftVersionId,
  );
  const rightCompareVersion = promptVersions.find(
    (version) => String(version.id) === rightVersionId,
  );

  useTitle(`${isEdit ? "編輯" : "建立"} ${STORYTELLER_APP_NAME} Skill`, {
    path: isEdit
      ? steamloomPath(`my/agent/${agentId}/edit`)
      : steamloomPath("my/agent/new"),
    robots: "noindex, nofollow",
  });

  const newAgentShellBreadcrumbs = [
    { label: STORYTELLER_APP_NAME, to: steamloomPath() },
    { label: "我的工作台", to: steamloomPath("my") },
    { label: "Skill", to: steamloomPath("my/agent") },
  ];

  // embedded（帳號工作台）模式下不重複套用一層 StorytellerShell 的頂欄跟麵包屑——
  // Home.tsx 外面已經有 WorkspaceChrome＋側邊欄提供同樣的定位資訊，這裡只需要
  // plain 顯示內容本身。
  function renderFrame(
    title: string,
    breadcrumbs: Array<{ label: string; to?: string }>,
    children: ReactNode,
  ) {
    return (
      <StorytellerShell
        title={title}
        breadcrumbs={embedded ? [] : breadcrumbs}
        plain={embedded}
        hideHeading={embedded}
      >
        {children}
      </StorytellerShell>
    );
  }

  if (authLoading) {
    return renderFrame(
      isEdit ? "編輯 Skill" : "建立 Skill",
      newAgentShellBreadcrumbs,
      <Stack alignItems="center" sx={{ py: 8 }}>
        <Typography color="text.secondary">正在確認登入狀態...</Typography>
      </Stack>,
    );
  }

  if (!session) {
    return renderFrame(
      isEdit ? "編輯 Skill" : "建立 Skill",
      newAgentShellBreadcrumbs,
      <CustomLoginRequiredState
        description={
          isEdit ? "登入後即可編輯這個 Skill。" : "登入後即可建立 Skill。"
        }
        onLogin={() => void login()}
        submitting={submitting}
      />,
    );
  }

  if (isEdit && !agent && (agentsLoading || agentsFetching)) {
    return renderFrame(
      "編輯 Skill",
      [...newAgentShellBreadcrumbs, { label: "編輯 Skill" }],
      <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
        <CircularProgress size={28} />
        <Typography color="text.secondary">正在載入 Skill 設定...</Typography>
      </Stack>,
    );
  }

  if (isEdit && !agent) {
    return (
      <ErrorPage
        code={404}
        compact={embedded}
        backUrl={embedded ? steamloomPath("my/agent") : undefined}
      />
    );
  }

  return (
    <StorytellerShell
      title={isEdit ? "編輯 Skill" : "建立 Skill"}
      breadcrumbs={
        embedded
          ? []
          : [
              { label: STORYTELLER_APP_NAME, to: steamloomPath() },
              { label: "我的工作台", to: steamloomPath("my") },
              { label: "Skill", to: steamloomPath("my/agent") },
              { label: isEdit ? "編輯 Skill" : "建立 Skill" },
            ]
      }
      plain={embedded}
      hideHeading={embedded}
    >
      <StorytellerVersionCompareDialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        itemTitle={agent?.name ?? "Skill"}
        leftVersion={
          leftCompareVersion
            ? agentVersionToCompareEntry(leftCompareVersion)
            : null
        }
        rightVersion={
          rightCompareVersion
            ? agentVersionToCompareEntry(rightCompareVersion)
            : null
        }
      />
      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        {isEdit && (
          <>
            <Tabs value={tab} onChange={(_, value) => setTab(value)}>
              <Tab value="settings" label="設定" />
              <Tab value="history" label="編輯歷史" />
            </Tabs>
            <Divider />
          </>
        )}
        {tab === "history" && isEdit ? (
          <Stack sx={{ p: { xs: 2, md: 3 } }}>
            <StoryEditHistory
              items={agentHistoryItems}
              loading={promptVersionsLoading}
              leftVersionId={leftVersionId}
              rightVersionId={rightVersionId}
              onCompare={() => setCompareDialogOpen(true)}
              onLeftVersionChange={setLeftVersionId}
              onRightVersionChange={setRightVersionId}
              isRightVersionDisabled={(versionId) =>
                Boolean(
                  leftVersionId && Number(versionId) <= Number(leftVersionId),
                )
              }
              newItemMessage="建立或更新 Skill 後才會產生 Prompt 編輯歷史。"
              helperMessage="請依序選擇要比對的新舊 Prompt 版本後再按下「比對選取版本」。"
            />
          </Stack>
        ) : (
          <Stack
            component="form"
            spacing={3}
            sx={{ p: { xs: 2, md: 3 } }}
            onSubmit={(event) => {
              event.preventDefault();
              saveAgent.mutate(
                { id: editAgentId, input },
                {
                  onSuccess: () => {
                    navigate(steamloomPath("my/agent"));
                  },
                },
              );
            }}
          >
            {saveAgent.isError && (
              <Alert severity="error" variant="outlined">
                {isEdit ? "更新" : "建立"} Skill
                失敗，請確認登入狀態與欄位內容。
              </Alert>
            )}
            <Alert severity="warning" variant="outlined">
              AI 供應商／模型／API Key 不在這裡設定——改成在「AI
              助理」對話框下方隨時切換要用哪把金鑰、哪個模型。記得先到
              「金鑰管理」建立至少一把 API Key，這個 Skill 才能真的搭配
              使用；同一個 Skill（人設）可以搭配任何一把已建立的金鑰。
            </Alert>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  required
                  fullWidth
                  label="Skill 名稱"
                  placeholder="例如：Plot Doctor"
                  value={input.name}
                  onChange={(event) =>
                    setInput((value) => ({
                      ...value,
                      name: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={5}
                  maxRows={12}
                  label="Skill 預設 prompt"
                  placeholder="描述此 Skill 適合做什麼，例如續寫、改寫、世界觀校對或章節節奏分析。"
                  value={input.default_prompt}
                  onChange={(event) =>
                    setInput((value) => ({
                      ...value,
                      default_prompt: event.target.value,
                    }))
                  }
                />
              </Grid>
            </Grid>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button href={steamloomPath("my/agent")} variant="text">
                返回列表
              </Button>
              <Button
                type="submit"
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={saveAgent.isPending}
              >
                {saveAgent.isPending
                  ? isEdit
                    ? "更新中"
                    : "建立中"
                  : isEdit
                    ? "更新 Skill"
                    : "建立 Skill"}
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
    </StorytellerShell>
  );
}
