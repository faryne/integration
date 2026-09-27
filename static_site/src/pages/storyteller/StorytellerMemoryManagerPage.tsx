import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Pagination,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useDeleteStorytellerAssistantMemory,
  useManageStorytellerAssistantMemory,
  useStorytellerAssistantMemoryManagement,
} from "@/apis/storyteller/agent.ts";
import {
  useStorytellerLores,
  useStorytellerStories,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { StorytellerMemoryEditorDialog } from "@/pages/storyteller/StorytellerMemoryEditorDialog.tsx";
import {
  MemoryCard,
  MemoryFilterChips,
} from "@/pages/storyteller/StorytellerMemoryManagerComponents.tsx";
import {
  storytellerMemoryErrorMessage,
  storytellerMemoryKindDescriptions,
  storytellerMemoryKindLabels,
  storytellerMemoryScopeLabels,
} from "@/pages/storyteller/storytellerMemoryUI.ts";
import type {
  StorytellerAssistantMemory,
  StorytellerAssistantMemoryKind,
  StorytellerAssistantMemoryScope,
} from "@/types/storyteller.ts";

const pageSize = 20;

export function StorytellerMemoryManagerPage({
  projectPublicId,
}: {
  projectPublicId?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const contextKindValue = searchParams.get("context");
  const contextKind =
    contextKindValue === "story" || contextKindValue === "lore"
      ? contextKindValue
      : undefined;
  const contextPublicId = contextKind
    ? (searchParams.get("target") ?? undefined)
    : undefined;
  const contextStories = useStorytellerStories(
    contextKind === "story" ? projectPublicId : undefined,
  );
  const contextLores = useStorytellerLores(
    contextKind === "lore" ? projectPublicId : undefined,
  );
  // 顯示 DB 中已儲存的名稱，不沿用編輯器裡可能尚未儲存的標題。
  const contextName =
    contextKind === "story"
      ? contextStories.data?.find(
          (story) => story.public_id === contextPublicId,
        )?.title
      : contextLores.data?.find((lore) => lore.public_id === contextPublicId)
          ?.title;
  const memoryPublicId = searchParams.get("memory") ?? undefined;
  const [scopeType, setScopeType] = useState<
    StorytellerAssistantMemoryScope | ""
  >("");
  const [kind, setKind] = useState<StorytellerAssistantMemoryKind | "">("");
  const [pinned, setPinned] = useState<"" | "true" | "false">("");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<StorytellerAssistantMemory | null>(
    null,
  );
  const [deleting, setDeleting] = useState<StorytellerAssistantMemory | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setPage(1);
    setScopeType((value) =>
      contextKind && value !== "" && value !== "project" ? contextKind : value,
    );
  }, [contextKind, contextPublicId]);

  const memories = useStorytellerAssistantMemoryManagement(projectPublicId, {
    scopeType,
    kind,
    pinned,
    tag,
    memoryPublicId,
    targetKind: contextKind,
    targetPublicId: contextPublicId,
    page,
    pageSize,
  });
  const updateMemory = useManageStorytellerAssistantMemory(projectPublicId);
  const deleteMemory = useDeleteStorytellerAssistantMemory();
  const totalPages = Math.max(
    1,
    Math.ceil((memories.data?.total_count ?? 0) / pageSize),
  );
  const editingTarget = useMemo(
    () => resolveMemoryTarget(editing, contextKind, contextPublicId),
    [contextKind, contextPublicId, editing],
  );
  const scopeOptions = useMemo(
    () =>
      Object.entries(storytellerMemoryScopeLabels).filter(
        ([value]) =>
          !contextKind || value === "project" || value === contextKind,
      ),
    [contextKind],
  );

  useEffect(() => {
    if (memories.isError) {
      setErrorMessage(storytellerMemoryErrorMessage(memories.error));
    }
  }, [memories.error, memories.isError]);

  function updateRow(memory: StorytellerAssistantMemory, isPinned: boolean) {
    const target = resolveMemoryTarget(memory, contextKind, contextPublicId);
    updateMemory.mutate(
      {
        publicId: memory.public_id,
        targetKind: target.kind,
        targetPublicId: target.publicId,
        input: {
          memory_name: memory.memory_name ?? "",
          scope_type: memory.scope_type,
          kind: memory.kind,
          tags: memory.tags ?? [],
          content: memory.content,
          priority: memory.priority,
          is_pinned: isPinned,
        },
      },
      {
        onError: (error) =>
          setErrorMessage(storytellerMemoryErrorMessage(error)),
      },
    );
  }

  return (
    <Stack
      spacing={2.5}
      sx={{ maxWidth: 1120, mx: "auto", p: { xs: 2, md: 4 } }}
    >
      <Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <PsychologyAltOutlinedIcon color="primary" />
          <Typography variant="overline" color="primary.main" fontWeight={800}>
            梭梭的記憶
          </Typography>
        </Stack>
        <Typography
          component="h1"
          variant="h4"
          fontWeight={900}
          sx={{ mt: 0.5 }}
        >
          記憶管理
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          使用工作台搜尋定位內容，或在這裡篩選並整理梭梭的長期記憶。
        </Typography>
      </Box>

      {contextKind && contextPublicId && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setSearchParams({});
                setPage(1);
              }}
            >
              查看專案全部
            </Button>
          }
        >
          目前只顯示
          {contextName
            ? `「${contextName}」`
            : `指定${contextKind === "story" ? "故事" : "設定"}`}
          會讀到的專案與專屬記憶。
        </Alert>
      )}

      {memoryPublicId && (
        <Alert
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setSearchParams({});
                setPage(1);
              }}
            >
              查看全部記憶
            </Button>
          }
        >
          目前顯示從工作台搜尋開啟的記憶。
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <MemoryFilterChips
            label="適用範圍"
            value={scopeType}
            onChange={(value) => {
              setScopeType(value as StorytellerAssistantMemoryScope | "");
              setPage(1);
            }}
            options={scopeOptions}
          />
          <MemoryFilterChips
            label="類型"
            value={kind}
            onChange={(value) => {
              setKind(value as StorytellerAssistantMemoryKind | "");
              setPage(1);
            }}
            options={Object.entries(storytellerMemoryKindLabels)}
            optionDescriptions={storytellerMemoryKindDescriptions}
          />
          <MemoryFilterChips
            label="釘選狀態"
            value={pinned}
            onChange={(value) => {
              setPinned(value as "" | "true" | "false");
              setPage(1);
            }}
            options={[
              ["true", "已釘選"],
              ["false", "未釘選"],
            ]}
          />
          {tag && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ width: 64 }}
              >
                標籤
              </Typography>
              <Chip label={tag} color="primary" onDelete={() => setTag("")} />
            </Stack>
          )}
        </Stack>
      </Paper>

      {memories.isLoading ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress size={32} />
        </Stack>
      ) : memories.isError ? (
        <Alert severity="error">記憶載入失敗，請稍後再試。</Alert>
      ) : (memories.data?.memories.length ?? 0) === 0 ? (
        <Alert severity="info">沒有符合目前條件的記憶。</Alert>
      ) : (
        <Stack spacing={1.25}>
          <Typography variant="body2" color="text.secondary">
            共 {memories.data?.total_count ?? 0} 筆記憶
          </Typography>
          {memories.data?.memories.map((memory) => (
            <MemoryCard
              key={memory.public_id}
              memory={memory}
              mutating={updateMemory.isPending}
              onTogglePinned={() => updateRow(memory, !memory.is_pinned)}
              onEdit={() => setEditing(memory)}
              onDelete={() => setDeleting(memory)}
              onTagClick={(value) => {
                setTag(value);
                setPage(1);
              }}
            />
          ))}
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={Math.min(page, totalPages)}
              onChange={(_, value) => setPage(value)}
              sx={{ alignSelf: "center", pt: 2 }}
            />
          )}
        </Stack>
      )}

      <StorytellerMemoryEditorDialog
        memory={editing}
        targetKind={editingTarget.kind}
        saving={updateMemory.isPending}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (!editing) return;
          updateMemory.mutate(
            {
              publicId: editing.public_id,
              input,
              targetKind: editingTarget.kind,
              targetPublicId: editingTarget.publicId,
            },
            {
              onSuccess: () => setEditing(null),
              onError: (error) =>
                setErrorMessage(storytellerMemoryErrorMessage(error)),
            },
          );
        }}
      />
      <StorytellerMascotDialog
        open={Boolean(deleting)}
        state="danger"
        eyebrow="刪除記憶"
        title="確定要讓梭梭忘記這件事？"
        description={deleting?.memory_name || deleting?.content.slice(0, 80)}
        onClose={() => !deleteMemory.isPending && setDeleting(null)}
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>取消</Button>
            <Button
              color="error"
              variant="contained"
              disabled={deleteMemory.isPending}
              onClick={() => {
                if (!deleting) return;
                deleteMemory.mutate(deleting.public_id, {
                  onSuccess: () => {
                    if (
                      (memories.data?.memories.length ?? 0) === 1 &&
                      page > 1
                    ) {
                      setPage((value) => value - 1);
                    }
                    setDeleting(null);
                  },
                  onError: (error) =>
                    setErrorMessage(storytellerMemoryErrorMessage(error)),
                });
              }}
            >
              確認刪除
            </Button>
          </>
        }
      />
      <CustomSnackbar
        open={Boolean(errorMessage)}
        message={errorMessage}
        severity="error"
        onClose={() => setErrorMessage("")}
      />
    </Stack>
  );
}

function resolveMemoryTarget(
  memory: StorytellerAssistantMemory | null,
  contextKind?: "story" | "lore",
  contextPublicId?: string,
): { kind?: "story" | "lore"; publicId?: string } {
  if (memory?.scope_type === "story" || memory?.scope_type === "lore") {
    return { kind: memory.scope_type, publicId: memory.target_public_id };
  }
  return { kind: contextKind, publicId: contextPublicId };
}
