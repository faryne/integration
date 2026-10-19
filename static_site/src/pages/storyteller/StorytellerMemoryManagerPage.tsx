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
import { useTranslation } from "react-i18next";
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
import { StorytellerFilterChips } from "@/components/storyteller/StorytellerFilterChips.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { StorytellerMemoryEditorDialog } from "@/pages/storyteller/StorytellerMemoryEditorDialog.tsx";
import { MemoryCard } from "@/pages/storyteller/StorytellerMemoryManagerComponents.tsx";
import { useStorytellerMemoryUI } from "@/pages/storyteller/storytellerMemoryUI.ts";
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
  const { t } = useTranslation();
  const memoryUI = useStorytellerMemoryUI();
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
      Object.entries(memoryUI.scopeLabels).filter(
        ([value]) =>
          !contextKind || value === "project" || value === contextKind,
      ),
    [contextKind, memoryUI.scopeLabels],
  );

  useEffect(() => {
    if (memories.isError) {
      setErrorMessage(memoryUI.errorMessage(memories.error));
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
          setErrorMessage(memoryUI.errorMessage(error)),
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
            {t("writer:memory.title")}
          </Typography>
        </Stack>
        <Typography
          component="h1"
          variant="h4"
          fontWeight={900}
          sx={{ mt: 0.5 }}
        >
          {t("writer:memory.manager")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.75 }}>
          {t("writer:memory.description")}
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
              {t("writer:memory.allProject")}
            </Button>
          }
        >
          {t("writer:memory.showingOnly", {
            kind: contextName
              ? `「${contextName}」`
              : t(
                  `writer:memory.${contextKind === "story" ? "story" : "lore"}`,
                ),
          })}
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
              {t("writer:memory.all")}
            </Button>
          }
        >
          {t("writer:memory.searchOnly")}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <StorytellerFilterChips
            label={t("writer:memory.scope")}
            value={scopeType}
            onChange={(value) => {
              setScopeType(value as StorytellerAssistantMemoryScope | "");
              setPage(1);
            }}
            options={scopeOptions}
          />
          <StorytellerFilterChips
            label={t("writer:memory.type")}
            value={kind}
            onChange={(value) => {
              setKind(value as StorytellerAssistantMemoryKind | "");
              setPage(1);
            }}
            options={Object.entries(memoryUI.kindLabels)}
            optionDescriptions={memoryUI.kindDescriptions}
          />
          <StorytellerFilterChips
            label={t("writer:memory.pinned")}
            value={pinned}
            onChange={(value) => {
              setPinned(value as "" | "true" | "false");
              setPage(1);
            }}
            options={[
              ["true", t("writer:memory.pinnedYes")],
              ["false", t("writer:memory.pinnedNo")],
            ]}
          />
          {tag && (
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ width: 64 }}
              >
                {t("writer:memory.tags")}
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
        <Alert severity="error">{t("writer:memory.loadFailed")}</Alert>
      ) : (memories.data?.memories.length ?? 0) === 0 ? (
        <Alert severity="info">{t("writer:memory.empty")}</Alert>
      ) : (
        <Stack spacing={1.25}>
          <Typography variant="body2" color="text.secondary">
            {t("writer:memory.count", {
              count: memories.data?.total_count ?? 0,
            })}
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
                setErrorMessage(memoryUI.errorMessage(error)),
            },
          );
        }}
      />
      <StorytellerMascotDialog
        open={Boolean(deleting)}
        state="danger"
        eyebrow={t("writer:memory.delete")}
        title={t("writer:memory.deleteTitle")}
        description={deleting?.memory_name || deleting?.content.slice(0, 80)}
        onClose={() => !deleteMemory.isPending && setDeleting(null)}
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>
              {t("writer:common.cancel")}
            </Button>
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
                    setErrorMessage(memoryUI.errorMessage(error)),
                });
              }}
            >
              {t("writer:memory.confirmDelete")}
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
