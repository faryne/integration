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
  TextField,
  Typography,
} from "@mui/material";
import {
  useApplyStorytellerAgentProposal,
  useMarkStorytellerAgentProposalApplied,
  usePreviewStorytellerAgentProposal,
  useRejectStorytellerAgentProposal,
  useResetStorytellerAgentProposal,
} from "@/apis/storyteller/agent.ts";
import { useRevertStorytellerStoryVersion } from "@/apis/storyteller/story.ts";
import { useRevertStorytellerLoreVersion } from "@/apis/storyteller/lore.ts";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import {
  StorytellerVersionCompareDialog,
  type StorytellerVersionCompareEntry,
} from "@/pages/storyteller/StorytellerVersionCompareDialog.tsx";
import type { StorytellerAgenticProposal } from "@/types/storyteller.ts";

const UPSERT_STORY_TOOL = "storyteller_upsert_story";
const UPSERT_LORE_TOOL = "storyteller_upsert_lore";

// 局部改內容的工具參數只有片段（search/replace、只帶部分欄位的 patch），前端拿不到
// 改完的全文，要打後端 preview API 算出來才能畫 diff。清單要跟後端
// proposalPreviewers（agent_proposal_preview.go）一致。
const PREVIEW_TOOLS = new Set([
  "storyteller_patch_story",
  "storyteller_patch_lore",
  "storyteller_search_replace_story",
  "storyteller_search_replace_lore",
]);

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
  storyteller_patch_story: "修改故事欄位",
  storyteller_patch_lore: "修改設定集欄位",
  storyteller_search_replace_story: "取代故事文字",
  storyteller_search_replace_lore: "取代設定集文字",
  storyteller_delete_lore: "刪除設定集",
  storyteller_move_lore: "搬移設定集",
  storyteller_revert_lore: "回退設定集版本",
  storyteller_delete_asset: "刪除資產",
  storyteller_move_asset: "搬移資產",
  storyteller_update_asset: "更新資產資訊",
};

export function proposalActionLabel(toolName: string): string {
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
  hasUnsavedChanges,
  onSaveBeforeApply,
  onRejectedWithFeedback,
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
  // 提案目標是目前這篇、編輯區又有未存檔變更時，先用這兩個確認＋存檔再套用，
  // 不然不管哪條套用路徑都會把還沒存的修改蓋掉、而且版本歷史裡找不回來。
  // onSaveBeforeApply 回傳存檔後的版本 id，失敗時是 null。
  hasUnsavedChanges?: () => boolean;
  onSaveBeforeApply?: () => Promise<number | null>;
  onRejectedWithFeedback?: (
    proposal: StorytellerAgenticProposal,
    feedback: string,
    index: number,
  ) => void;
}) {
  const [localStatus, setLocalStatus] = useState<LocalProposalStatus>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [savingBeforeApply, setSavingBeforeApply] = useState(false);
  // 局部改內容類提案的 diff 快照：左邊是按下「檢視 diff」當下的編輯區內容，右邊是
  // 後端算出的套用結果。套用後留著給「查看變更」用——那時候編輯區已經是套用後的
  // 內容，再重打 preview 會變成拿「改完的」再改一次（search_replace 多半變成沒差異），
  // 看不到真正的變更。
  const [previewDiff, setPreviewDiff] = useState<{
    left: StorytellerVersionCompareEntry;
    right: StorytellerVersionCompareEntry;
  } | null>(null);
  const [rejectFeedbackOpen, setRejectFeedbackOpen] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");
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
  const preview = usePreviewStorytellerAgentProposal(projectPublicId);
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
  const hasPreview = PREVIEW_TOOLS.has(proposal.tool_name);
  // 提案的目標 id 依工具不同放在不同參數名（story_public_id／lore_public_id）；
  // 工具種類要跟目前面板的 targetKind 對得上（故事面板裡的 lore 工具一定不是這篇），
  // 沒帶值代表 AI 要「建立一篇新的」，一律當作不是目前這篇。
  const proposalTargetPublicId =
    targetKind === "lore"
      ? proposal.arguments.lore_public_id
      : proposal.arguments.story_public_id;
  const targetsCurrentDoc =
    proposal.tool_name.includes(targetKind === "lore" ? "_lore" : "_story") &&
    typeof proposalTargetPublicId === "string" &&
    proposalTargetPublicId !== "" &&
    proposalTargetPublicId === targetPublicId;
  // 只有目標是目前這篇的 upsert、而且呼叫端真的有接 onApplyToEditor（目前只有
  // StoryEditor／LoreEditor 會接），才走「填進編輯區＋存檔」這條路；其餘情況（改
  // 別篇、新建、非 upsert 類工具）維持呼叫後端直接套用。
  const sameTargetUpsert =
    isUpsertStory && Boolean(onApplyToEditor) && targetsCurrentDoc;

  // 「檢視 diff」：upsert 參數本身就是全文，直接開；局部改內容類要先打 preview
  // 拿到套用後全文。每次都重算，因為編輯區內容可能在兩次檢視之間變了。
  function openDiff() {
    if (!hasPreview) {
      setDiffOpen(true);
      return;
    }
    setErrorMessage("");
    preview.mutate(
      {
        proposalPublicId: proposal.public_id,
        current: {
          title: currentStory.title,
          summary: currentStory.summary,
          content: currentStory.content,
        },
      },
      {
        onSuccess: (result) => {
          setPreviewDiff({
            left: {
              title: currentStory.title,
              summary: currentStory.summary,
              content: currentStory.content,
              source: "目前版本",
              createdAt: currentStory.updatedAt,
            },
            right: {
              ...result,
              source: "AI Agent 提案",
              createdAt: new Date().toISOString(),
            },
          });
          setDiffOpen(true);
        },
        onError: (err) =>
          setErrorMessage(resolveErrorMessage(err, "無法產生提案預覽")),
      },
    );
  }

  // 危險操作確認（或非危險操作直接按下套用）之後的下一關：目標是目前這篇、編輯區
  // 又有未存檔變更時，先跳「先存檔再套用」對話框，不然直接套用。
  function requestApply() {
    setConfirmOpen(false);
    if (targetsCurrentDoc && onSaveBeforeApply && hasUnsavedChanges?.()) {
      setUnsavedOpen(true);
      return;
    }
    handleApply(currentStory.versionId);
  }

  // 先把編輯區目前內容存成一個版本，再套用提案；存檔拿到的版本 id 就是「回復到
  // 套用前版本」要退回的目標，使用者沒存的修改因此也救得回來。
  async function handleSaveThenApply() {
    setSavingBeforeApply(true);
    const savedVersionId = await onSaveBeforeApply!();
    setSavingBeforeApply(false);
    setUnsavedOpen(false);
    if (savedVersionId == null) {
      setLocalStatus("error");
      setErrorMessage("存檔失敗，提案沒有套用。");
      return;
    }
    handleApply(savedVersionId);
  }

  function handleApply(preVersionId: number | null) {
    setPreApplyVersionId(preVersionId);
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

  function handleRejectCancel() {
    if (reject.isPending) {
      return;
    }
    setRejectFeedbackOpen(false);
    setRejectFeedback("");
  }

  function handleReject() {
    const feedback = rejectFeedback.trim();
    if (!feedback) {
      return;
    }
    setLocalStatus("rejecting");
    setErrorMessage("");
    reject.mutate(proposal.public_id, {
      onSuccess: () => {
        setLocalStatus("rejected");
        setRejectFeedbackOpen(false);
        setRejectFeedback("");
        onApplied?.();
        onRejectedWithFeedback?.(proposal, feedback, index);
      },
      onError: (err) => {
        setLocalStatus("error");
        setRejectFeedbackOpen(false);
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
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
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
            {(isUpsertStory || hasPreview) && (
              <Button
                size="small"
                variant="outlined"
                disabled={preview.isPending}
                onClick={openDiff}
              >
                {preview.isPending ? "計算中" : "檢視 diff"}
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              color={dangerous ? "error" : "primary"}
              disabled={
                apply.isPending || markApplied.isPending || reject.isPending
              }
              onClick={() =>
                dangerous ? setConfirmOpen(true) : requestApply()
              }
            >
              套用提案
            </Button>
            <Button
              size="small"
              disabled={
                apply.isPending || markApplied.isPending || reject.isPending
              }
              onClick={() => setRejectFeedbackOpen(true)}
            >
              否決
            </Button>
          </Stack>
        )}

        {status === "applied" && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {(isUpsertStory || previewDiff) && (
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
      {previewDiff && (
        <StorytellerVersionCompareDialog
          open={diffOpen}
          onClose={() => setDiffOpen(false)}
          itemTitle={previewDiff.left.title}
          leftVersion={previewDiff.left}
          rightVersion={previewDiff.right}
        />
      )}

      <StorytellerMascotDialog
        open={confirmOpen}
        state="danger"
        eyebrow="AI Agent 危險操作"
        title={`確認執行「${proposalActionLabel(proposal.tool_name)}」？`}
        description="這項操作無法先用 diff 確認內容，套用後不一定能直接復原（部分操作可以透過編輯歷史退回）。"
        onClose={() => setConfirmOpen(false)}
        actions={
          <>
            <Button onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button
              color="error"
              variant="contained"
              onClick={requestApply}
              disabled={apply.isPending}
            >
              確認執行
            </Button>
          </>
        }
      />

      <StorytellerMascotDialog
        open={unsavedOpen}
        state="neutral"
        eyebrow="AI Agent 套用提案"
        title="編輯區還有未存檔的變更"
        description="會先把目前內容存成一個版本，再套用提案。AI 的提案是根據先前存檔的內容寫的，套用後你剛才的修改可能被蓋過；需要的話可以用「回復到套用前版本」或編輯歷史找回。"
        onClose={() => !savingBeforeApply && setUnsavedOpen(false)}
        actions={
          <>
            <Button
              onClick={() => setUnsavedOpen(false)}
              disabled={savingBeforeApply}
            >
              取消
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSaveThenApply()}
              disabled={savingBeforeApply}
            >
              {savingBeforeApply ? "存檔中" : "先存檔再套用"}
            </Button>
          </>
        }
      />

      <Dialog
        open={rejectFeedbackOpen}
        onClose={handleRejectCancel}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>否決提案</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={4}
            value={rejectFeedback}
            onChange={(event) => setRejectFeedback(event.target.value)}
            placeholder="哪裡要改？也可以直接說「整段重寫」。"
            disabled={reject.isPending}
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRejectCancel} disabled={reject.isPending}>
            取消
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleReject}
            disabled={reject.isPending || rejectFeedback.trim() === ""}
          >
            {reject.isPending ? "送出中" : "送出並否決"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
