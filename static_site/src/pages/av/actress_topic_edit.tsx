import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ActressTopicSaveRequest } from "@/types/avActressTopic.ts";
import {
  useActressTopicMutations,
  useActressTopicOptions,
  useAdminActressTopic,
} from "@/apis/av/actress_topic_admin.ts";
import {
  EMPTY_TOPIC,
  TOPIC_DEFAULT_SORT_LABELS,
  TOPIC_GROUP_LABELS,
} from "@/data/avActressTopicAdmin.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useTitle } from "@/helpers/title.tsx";
import { AdminGuard } from "@/components/common/AdminGuard.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { ActressTopicConditionForm } from "@/components/av/actress_topic_condition_form.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

const MANAGE_PATH = "/av/actress/topics/manage";

/** 新增／編輯自訂主題：/av/actress/topics/manage/new、/av/actress/topics/manage/:id */
export function AVActressTopicEdit() {
  const id = Number(useParams<{ id: string }>().id) || 0;
  const detail = useAdminActressTopic(id);
  useTitle(id ? "編輯女優主題" : "新增女優主題");
  useBreadcrumbTail(id ? (detail.data?.title ?? "編輯主題") : "新增主題");

  return (
    <AdminGuard>
      {id > 0 && detail.isError ? (
        <ErrorPage backUrl={MANAGE_PATH} code={404} message="找不到這個主題" />
      ) : id > 0 && !detail.data ? (
        <Skeleton height={480} variant="rounded" />
      ) : (
        // 換主題時用 key 重設表單
        <TopicForm initial={detail.data ?? EMPTY_TOPIC} id={id} key={id} />
      )}
    </AdminGuard>
  );
}

function TopicForm({
  id,
  initial,
}: {
  id: number;
  initial: ActressTopicSaveRequest;
}) {
  const navigate = useNavigate();
  const options = useActressTopicOptions();
  const { save, remove } = useActressTopicMutations();
  const [form, setForm] = useState<ActressTopicSaveRequest>({
    slug: initial.slug,
    title: initial.title,
    group_key: initial.group_key,
    default_sort: initial.default_sort,
    conditions: initial.conditions,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsErrorClosed, setOptionsErrorClosed] = useState(false);
  const optionsError = options.isError && !optionsErrorClosed;
  const set = (patch: Partial<ActressTopicSaveRequest>) =>
    setForm({ ...form, ...patch });
  const failed = (e: unknown) =>
    setError(apiErrorMessage(e, "操作失敗，請稍後再試"));
  // 儲存不會即時發佈，提示下一次排程的時間
  const done = (message: string) =>
    navigate(MANAGE_PATH, { state: { flash: message } });

  const submit = () => {
    // 沒選標籤的類型列直接丟掉
    const body = {
      ...form,
      conditions: {
        ...form.conditions,
        genres: form.conditions.genres?.filter((g) => g.tag),
      },
    };
    save.mutate(
      { id, body },
      {
        onSuccess: (item) =>
          done(`已儲存「${item.title}」，下一次每週排程（週四 04:30）會產生`),
        onError: failed,
      },
    );
  };

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Typography component="h1" fontWeight={900} variant="h5">
        {id ? "編輯主題" : "新增主題"}
      </Typography>
      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" },
        }}
      >
        <Paper sx={{ p: 2 }} variant="outlined">
          <Stack spacing={2}>
            <Typography color="text.secondary" fontWeight={700} variant="body2">
              基本資料
            </Typography>
            <TextField
              label="標題"
              onChange={(e) => set({ title: e.target.value })}
              size="small"
              value={form.title}
            />
            <TextField
              label="slug"
              onChange={(e) => set({ slug: e.target.value })}
              size="small"
              value={form.slug}
            />
            <TextField
              label="分組"
              onChange={(e) =>
                set({
                  group_key: e.target
                    .value as ActressTopicSaveRequest["group_key"],
                })
              }
              select
              size="small"
              value={form.group_key}
            >
              {Object.entries(TOPIC_GROUP_LABELS).map(([k, label]) => (
                <MenuItem key={k} value={k}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="預設排序"
              onChange={(e) =>
                set({
                  default_sort: e.target
                    .value as ActressTopicSaveRequest["default_sort"],
                })
              }
              select
              size="small"
              value={form.default_sort}
            >
              {Object.entries(TOPIC_DEFAULT_SORT_LABELS).map(([k, label]) => (
                <MenuItem key={k} value={k}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Paper>
        <Paper sx={{ p: 2 }} variant="outlined">
          <Typography
            color="text.secondary"
            fontWeight={700}
            sx={{ mb: 2 }}
            variant="body2"
          >
            條件
          </Typography>
          <ActressTopicConditionForm
            onChange={(conditions) => set({ conditions })}
            options={options.data}
            optionsLoading={options.isPending}
            value={form.conditions}
          />
        </Paper>
      </Box>
      <Stack direction="row" gap={1}>
        {id > 0 && (
          <Button
            color="error"
            onClick={() => setConfirmDelete(true)}
            variant="contained"
          >
            刪除
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={() => navigate(MANAGE_PATH)}>取消</Button>
        <Button
          disabled={save.isPending}
          onClick={submit}
          startIcon={
            save.isPending ? (
              <CircularProgress color="inherit" size={16} />
            ) : undefined
          }
          variant="contained"
        >
          儲存
        </Button>
      </Stack>

      <Dialog
        fullWidth
        maxWidth="xs"
        onClose={() => setConfirmDelete(false)}
        open={confirmDelete}
      >
        <DialogTitle>確定要刪除「{initial.title}」？</DialogTitle>
        <DialogContent>
          <Typography>
            下一次每週排程起，總覽頁就不會再出現這個主題，原本的網址會顯示找不到。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)}>取消</Button>
          <Button
            color="error"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(id, {
                onSuccess: () => done(`已刪除「${initial.title}」`),
                onError: failed,
              })
            }
            variant="contained"
          >
            刪除
          </Button>
        </DialogActions>
      </Dialog>
      <CustomSnackbar
        message={error ?? "自動完成的選項讀取失敗，請稍後再試"}
        onClose={() =>
          error !== null ? setError(null) : setOptionsErrorClosed(true)
        }
        open={error !== null || optionsError}
        severity="error"
      />
    </Stack>
  );
}
