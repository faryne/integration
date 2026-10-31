import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import type { ActressTopicAdminItem } from "@/types/avActressTopic.ts";
import {
  useActressTopicMutations,
  useAdminActressTopics,
} from "@/apis/av/actress_topic_admin.ts";
import { TOPIC_GROUP_LABELS } from "@/data/avActressTopicAdmin.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { useBreadcrumbTail } from "@/helpers/breadcrumbTail.ts";
import { useFlashMessage } from "@/helpers/flashMessage.ts";
import { useTitle } from "@/helpers/title.tsx";
import { avAdminTopicPath } from "@/helpers/avActressAdmin.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";

/** 女優主題管理：/av/actress/admin/topics，只列自訂主題（特輯、身材），內建主題不能編輯；權限由後台 layout 檢查 */
export function AVActressTopicManage() {
  useTitle("AV 女優主題管理");
  useBreadcrumbTail("管理主題");
  const flash = useFlashMessage();
  return (
    <>
      <TopicList />
      <CustomSnackbar
        message={flash.message ?? ""}
        onClose={flash.close}
        open={flash.message !== null}
      />
    </>
  );
}

function TopicList() {
  const navigate = useNavigate();
  const list = useAdminActressTopics();
  const { setEnabled, sort } = useActressTopicMutations();
  const [error, setError] = useState<string | null>(null);
  const [listErrorClosed, setListErrorClosed] = useState(false);
  const listError = list.isError && !listErrorClosed;
  const failed = (e: unknown) =>
    setError(apiErrorMessage(e, "操作失敗，請稍後再試"));
  const rows = list.data ?? [];

  // 同分組內上下移一格，送出整個分組的新順序
  const move = (item: ActressTopicAdminItem, step: -1 | 1) => {
    const ids = rows
      .filter((r) => r.group_key === item.group_key)
      .map((r) => r.id);
    const i = ids.indexOf(item.id);
    if (i + step < 0 || i + step >= ids.length) return;
    [ids[i], ids[i + step]] = [ids[i + step], ids[i]];
    sort.mutate(ids, { onError: failed });
  };

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography component="h1" fontWeight={900} variant="h5">
          管理主題
        </Typography>
        <Button
          component={RouterLink}
          startIcon={<AddIcon />}
          to={avAdminTopicPath("new")}
          variant="contained"
        >
          新增主題
        </Button>
      </Stack>
      <Paper sx={{ overflowX: "auto" }} variant="outlined">
        {list.isPending ? (
          <Skeleton height={320} sx={{ m: 2 }} variant="rounded" />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 72 }} />
                <TableCell>主題</TableCell>
                <TableCell>分組</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  條件
                </TableCell>
                <TableCell>上次產生</TableCell>
                <TableCell>啟用</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((item, i) => {
                const prev = rows[i - 1]?.group_key === item.group_key;
                const next = rows[i + 1]?.group_key === item.group_key;
                return (
                  <TableRow
                    hover
                    key={item.id}
                    onClick={() => navigate(avAdminTopicPath(item.id))}
                    sx={{
                      cursor: "pointer",
                      opacity: item.is_enabled ? 1 : 0.55,
                    }}
                  >
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      <IconButton
                        aria-label="上移"
                        disabled={!prev || sort.isPending}
                        onClick={() => move(item, -1)}
                        size="small"
                      >
                        <ArrowUpwardIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        aria-label="下移"
                        disabled={!next || sort.isPending}
                        onClick={() => move(item, 1)}
                        size="small"
                      >
                        <ArrowDownwardIcon fontSize="inherit" />
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ fontWeight: 700 }}
                        to={avAdminTopicPath(item.id)}
                      >
                        {item.title}
                      </Link>
                      <Typography
                        color="text.secondary"
                        variant="caption"
                        sx={{ display: "block" }}
                      >
                        {item.slug}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {TOPIC_GROUP_LABELS[item.group_key]}
                    </TableCell>
                    <TableCell
                      sx={{ display: { xs: "none", md: "table-cell" } }}
                    >
                      {item.summary}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {item.last_count === null ? (
                        <Chip color="warning" label="尚未產生" size="small" />
                      ) : (
                        <>
                          {item.last_count.toLocaleString()} 位
                          <Box
                            component="div"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.75rem",
                            }}
                          >
                            {item.last_generated_at
                              ?.slice(0, 10)
                              .replaceAll("-", "/")}
                          </Box>
                        </>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={item.is_enabled}
                        disabled={setEnabled.isPending}
                        onChange={(e) =>
                          setEnabled.mutate(
                            { id: item.id, enabled: e.target.checked },
                            { onError: failed },
                          )
                        }
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
      <CustomSnackbar
        message={error ?? "主題列表讀取失敗，請稍後再試"}
        onClose={() =>
          error !== null ? setError(null) : setListErrorClosed(true)
        }
        open={error !== null || listError}
        severity="error"
      />
    </Stack>
  );
}
