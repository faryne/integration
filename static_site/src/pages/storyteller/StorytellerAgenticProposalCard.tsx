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
  useMarkStorytellerAgentProposalApplied,
  useRejectStorytellerAgentProposal,
  useResetStorytellerAgentProposal,
} from "@/apis/storyteller/agent.ts";
import { useRevertStorytellerStoryVersion } from "@/apis/storyteller/story.ts";
import { useRevertStorytellerLoreVersion } from "@/apis/storyteller/lore.ts";
import { StorytellerVersionCompareDialog } from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import type { StorytellerAgenticProposal } from "@/types/storyteller.ts";

const UPSERT_STORY_TOOL = "storyteller_upsert_story";
const UPSERT_LORE_TOOL = "storyteller_upsert_lore";

function resolveErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    return data.message || fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

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
  // 「回復到套用前版本」成功後手動打回這個值——後端也把提案退回 pending 了，
  // 但那次 query 失效觸發的 refetch 還沒回來之前，這裡先手動同步，畫面才不會
  // 在「已套用」（舊 props）跟「待確認」之間閃一下。
  | "pending"
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
  onApplyToEditor,
}: {
  index: number;
  proposal: StorytellerAgenticProposal;
  targetKind: "story" | "lore";
  projectPublicId?: string;
  targetPublicId?: string;
  currentStory: StorytellerAgenticCurrentStory;
  onApplied?: () => void;
  // 提案目標剛好是目前這篇時才會用到——把提案欄位填進編輯區、存一次檔。
  // 目標是別篇或新建（見下面 sameTargetUpsert 判斷）就沒有編輯區可以填，
  // 維持呼叫後端直接套用的舊行為。
  onApplyToEditor?: (proposal: StorytellerAgenticProposal) => Promise<void>;
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
  // 「回復到套用前版本」只該讓使用者按一次——按過一次之後目前內容已經是退回
  // 前一版了，再按第二次只是把同一個版本重複套用，沒有意義還可能誤導使用者
  // 以為在往更早的版本繼續退。這個狀態只在當次 session 有效，跟 preApplyVersionId
  // 一樣重新整理後就消失，屬於預期內的限制。
  const [hasReverted, setHasReverted] = useState(false);

  const status = localStatus ?? proposal.status;

  const apply = useApplyStorytellerAgentProposal(projectPublicId);
  const markApplied = useMarkStorytellerAgentProposalApplied(projectPublicId);
  const resetProposal = useResetStorytellerAgentProposal(projectPublicId);
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
  // 提案的目標 id 依工具不同放在不同參數名（story_public_id／lore_public_id）；
  // 沒帶值代表 AI 要「建立一篇新的」，跟目前開著哪篇無關，一律當作不是同一個
  // 目標。只有目標剛好等於目前打開的這篇、而且呼叫端真的有接 onApplyToEditor
  // （目前只有 StoryEditor／LoreEditor 會接），才走「填進編輯區＋存檔」這條路；
  // 其餘情況（改別篇、新建、非 upsert 類工具）維持呼叫後端直接套用。
  const proposalTargetPublicId =
    proposal.tool_name === UPSERT_STORY_TOOL
      ? proposal.arguments.story_public_id
      : proposal.tool_name === UPSERT_LORE_TOOL
        ? proposal.arguments.lore_public_id
        : undefined;
  const sameTargetUpsert =
    isUpsertStory &&
    Boolean(onApplyToEditor) &&
    typeof proposalTargetPublicId === "string" &&
    proposalTargetPublicId !== "" &&
    proposalTargetPublicId === targetPublicId;

  function handleApply() {
    setPreApplyVersionId(currentStory.versionId);
    setLocalStatus("applying");
    setErrorMessage("");
    if (sameTargetUpsert) {
      onApplyToEditor!(proposal)
        .then(() => {
          markApplied.mutate(proposal.public_id, {
            onSuccess: () => {
              setLocalStatus("applied");
              setDiffOpen(false);
              setConfirmOpen(false);
            },
            onError: (err) => {
              // 內容其實已經填進編輯區、也存檔成功了，只差提案狀態沒收尾——
              // 不能整個回報「套用失敗」讓使用者誤以為要重按，錯誤訊息講清楚
              // 差在哪，卡片留在「操作失敗」讓使用者知道下次重整這張卡片可能
              // 還是待確認、但編輯區內容不用擔心。
              setLocalStatus("error");
              setErrorMessage(
                `內容已存檔，但標記提案狀態失敗：${resolveErrorMessage(err, "原因不明")}`,
              );
            },
          });
        })
        .catch((err) => {
          setLocalStatus("error");
          setErrorMessage(resolveErrorMessage(err, "套用失敗"));
        });
      return;
    }
    apply.mutate(proposal.public_id, {
      onSuccess: () => {
        setLocalStatus("applied");
        setDiffOpen(false);
        setConfirmOpen(false);
        onApplied?.();
      },
      onError: (err) => {
        setLocalStatus("error");
        setErrorMessage(resolveErrorMessage(err, "套用失敗"));
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
        setErrorMessage(resolveErrorMessage(err, "否決失敗"));
      },
    });
  }

  function handleRevert() {
    if (preApplyVersionId == null || hasReverted) {
      return;
    }
    revert.mutate(preApplyVersionId, {
      onSuccess: () => {
        setHasReverted(true);
        // 內容退回去了，這筆提案代表的「已套用」決定也要一起撤銷，不然使用者
        // 會卡在只剩「查看變更」可以按、沒辦法重新套用或改成否決的死路——見
        // ResetAgentProposalToPending 的說明。
        resetProposal.mutate(proposal.public_id, {
          onSuccess: () => {
            setLocalStatus("pending");
            setPreApplyVersionId(null);
            setHasReverted(false);
            setErrorMessage("");
            onApplied?.();
          },
          onError: (err) => {
            // 內容確實已經退回去了，只是提案狀態沒能一起退回 pending——不影響
            // 故事/設定集本身，但這張卡片會停在「已回復到套用前版本」鎖死的
            // 狀態，講清楚差在哪，不要讓使用者以為內容也沒退成功。
            setErrorMessage(
              `內容已回復，但提案狀態退回待確認失敗：${resolveErrorMessage(err, "原因不明")}`,
            );
            onApplied?.();
          },
        });
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
              disabled={apply.isPending || markApplied.isPending || reject.isPending}
              onClick={() => (dangerous ? setConfirmOpen(true) : handleApply())}
            >
              套用提案
            </Button>
            <Button
              size="small"
              disabled={apply.isPending || markApplied.isPending || reject.isPending}
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
            {preApplyVersionId != null && (
              <Button
                size="small"
                variant="outlined"
                color="error"
                disabled={revert.isPending || hasReverted}
                onClick={handleRevert}
              >
                {hasReverted ? "已回復到套用前版本" : "回復到套用前版本"}
              </Button>
            )}
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
