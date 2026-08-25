import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  useApplyStorytellerAgentProposal,
  useRejectStorytellerAgentProposal,
} from "@/apis/storyteller/agent.ts";
import { useRevertStorytellerStoryVersion } from "@/apis/storyteller/story.ts";
import { useRevertStorytellerLoreVersion } from "@/apis/storyteller/lore.ts";
import { StorytellerVersionCompareDialog } from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import type { StorytellerAgenticProposal } from "@/types/storyteller.ts";

const UPSERT_STORY_TOOL = "storyteller_upsert_story";
const UPSERT_LORE_TOOL = "storyteller_upsert_lore";

// 給前端顯示用的中文動作標籤，對照 Codex_UIUX設計提案.md 的建議：工具名稱不該
// 直接裸露給使用者看。之後新增工具時記得一併補這裡，沒對應到的就照原樣顯示
// tool_name，不會整個掛掉。
const PROPOSAL_ACTION_LABELS: Record<string, string> = {
  storyteller_upsert_story: "更新故事內容",
  storyteller_delete_story: "刪除故事",
  storyteller_move_story: "搬移故事",
  storyteller_revert_story: "回退故事版本",
  storyteller_upsert_lore: "更新設定集內容",
  storyteller_delete_lore: "刪除設定集",
  storyteller_move_lore: "搬移設定集",
  storyteller_revert_lore: "回退設定集版本",
  storyteller_delete_asset: "刪除資產",
  storyteller_move_asset: "搬移資產",
  storyteller_update_asset: "更新資產資訊",
};

function proposalActionLabel(toolName: string): string {
  return PROPOSAL_ACTION_LABELS[toolName] ?? toolName;
}

// 刪除／搬移／回退都是「一旦執行、沒有 diff 可以事先確認」的操作，比照
// Codex_UIUX設計提案.md 的「危險操作」建議，套用前多一層明確列出後果的 confirm。
function isDangerousProposal(toolName: string): boolean {
  return (
    toolName.includes("delete") ||
    toolName.includes("move") ||
    toolName.includes("revert")
  );
}

// pending／applied／rejected 是後端的真實狀態（見 StorytellerAgenticProposal）。
// 這則卡片可能屬於「這次對話 session 裡剛產生」的訊息——那種訊息存在
// StorytellerAgenticPanel 的 agenticMessages 這個純前端 state 裡，套用/否決
// 成功後呼叫的 onApplied 只會讓故事/設定集內容跟 TanStack Query 快取重新整理，
// 不會回頭改寫 agenticMessages 裡那則訊息的 proposal 物件——所以 proposal.status
// 這個 prop 在同一個 session 裡永遠不會自己變成 applied/rejected，只有等頁面
// 重新整理、改吃歷史訊息時才會是新的。因此套用/否決成功後要把本地狀態直接
// 定格在對應的終態，不能只是清空、賭 prop 之後會更新。
type LocalProposalStatus =
  | "applying"
  | "rejecting"
  | "applied"
  | "rejected"
  | "error"
  | null;

export interface StorytellerAgenticCurrentStory {
  title: string;
  summary: string;
  content: string;
  versionId: number | null;
  updatedAt: string;
}

export function StorytellerAgenticProposalCard({
  index,
  proposal,
  targetKind,
  projectPublicId,
  targetPublicId,
  currentStory,
  onApplied,
}: {
  index: number;
  proposal: StorytellerAgenticProposal;
  targetKind: "story" | "lore";
  projectPublicId?: string;
  targetPublicId?: string;
  currentStory: StorytellerAgenticCurrentStory;
  onApplied?: () => void;
}) {
  const [localStatus, setLocalStatus] = useState<LocalProposalStatus>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 套用當下的版本 id，讓「回復到套用前版本」按鈕知道要退回哪一版——不能等要
  // revert 時才去讀 currentStory.versionId，那時候父層多半已經因為套用成功
  // refetch 過，versionId 已經是套用「後」的了。這個只在當次 session 有效，
  // 重新整理頁面後（沒有經歷過「剛剛按下套用」那個當下）就不知道要退回哪一版，
  // 屬於預期內的限制。
  const [preApplyVersionId, setPreApplyVersionId] = useState<number | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  const status = localStatus ?? proposal.status;

  const apply = useApplyStorytellerAgentProposal(projectPublicId);
  const reject = useRejectStorytellerAgentProposal(projectPublicId);
  // Rules of Hooks 不能依 targetKind 條件呼叫其中一個——兩個 revert hook 都固定
  // 呼叫，未命中的那個因為沒真的被觸發 mutate 不會有副作用，下面依 targetKind
  // 只挑其中一個的 mutate/isPending 來用。
  const revertStory = useRevertStorytellerStoryVersion(
    projectPublicId,
    targetKind === "story" ? targetPublicId : undefined,
  );
  const revertLore = useRevertStorytellerLoreVersion(
    projectPublicId,
    targetKind === "lore" ? targetPublicId : undefined,
  );
  const revert = targetKind === "lore" ? revertLore : revertStory;

  const isUpsertStory =
    proposal.tool_name === UPSERT_STORY_TOOL ||
    proposal.tool_name === UPSERT_LORE_TOOL;
  const proposedTitle =
    typeof proposal.arguments.title === "string"
      ? proposal.arguments.title
      : currentStory.title;
  const proposedSummary =
    typeof proposal.arguments.summary === "string"
      ? proposal.arguments.summary
      : currentStory.summary;
  const proposedContent =
    typeof proposal.arguments.content === "string"
      ? proposal.arguments.content
      : "";

  function handleApply() {
    setPreApplyVersionId(currentStory.versionId);
    setLocalStatus("applying");
    setErrorMessage("");
    apply.mutate(proposal.public_id, {
      onSuccess: () => {
        setLocalStatus("applied");
        setDiffOpen(false);
        setConfirmOpen(false);
        onApplied?.();
      },
      onError: (err) => {
        setLocalStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "套用失敗");
      },
    });
  }

  function handleReject() {
    setLocalStatus("rejecting");
    setErrorMessage("");
    reject.mutate(proposal.public_id, {
      onSuccess: () => {
        setLocalStatus("rejected");
        onApplied?.();
      },
      onError: (err) => {
        setLocalStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "否決失敗");
      },
    });
  }

  function handleRevert() {
    if (preApplyVersionId == null) {
      return;
    }
    revert.mutate(preApplyVersionId, {
      onSuccess: () => {
        onApplied?.();
      },
    });
  }

  const dangerous = isDangerousProposal(proposal.tool_name);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.5, borderRadius: 1, bgcolor: "background.default" }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" fontWeight={800}>
            修改提案 #{index + 1}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={
              status === "applied"
                ? "success"
                : status === "error"
                  ? "error"
                  : status === "rejected"
                    ? "default"
                    : "warning"
            }
            label={
              status === "applied"
                ? "已套用"
                : status === "rejected"
                  ? "已否決"
                  : status === "applying"
                    ? "套用中"
                    : status === "rejecting"
                      ? "否決中"
                      : status === "error"
                        ? "操作失敗"
                        : "待確認"
            }
          />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          動作：{proposalActionLabel(proposal.tool_name)}
        </Typography>

        {errorMessage && (
          <Alert severity="error" variant="outlined">
            {errorMessage}
          </Alert>
        )}

        {(status === "pending" || status === "error") && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {isUpsertStory && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setDiffOpen(true)}
              >
                檢視 diff
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              color={dangerous ? "error" : "primary"}
              disabled={apply.isPending || reject.isPending}
              onClick={() => (dangerous ? setConfirmOpen(true) : handleApply())}
            >
              套用提案
            </Button>
            <Button
              size="small"
              disabled={apply.isPending || reject.isPending}
              onClick={handleReject}
            >
              否決
            </Button>
          </Stack>
        )}

        {status === "applied" && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {isUpsertStory && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => setDiffOpen(true)}
              >
                查看變更
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={preApplyVersionId == null || revert.isPending}
              onClick={handleRevert}
            >
              回復到套用前版本
            </Button>
          </Stack>
        )}
      </Stack>

      {isUpsertStory && (
        <StorytellerVersionCompareDialog
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          itemTitle={currentStory.title}
          leftVersion={{
            title: currentStory.title,
            summary: currentStory.summary,
            content: currentStory.content,
            source: "目前版本",
            createdAt: currentStory.updatedAt,
          }}
          rightVersion={{
            title: proposedTitle,
            summary: proposedSummary,
            content: proposedContent,
            source: "AI Agent 提案",
            createdAt: new Date().toISOString(),
          }}
        />
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>
          確認執行「{proposalActionLabel(proposal.tool_name)}」
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            這是無法先看 diff 確認內容的操作，套用後不一定能直接復原（部分操作可以透過編輯歷史退回）。確定要讓 AI Agent 執行嗎？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleApply}
            disabled={apply.isPending}
          >
            確認執行
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
