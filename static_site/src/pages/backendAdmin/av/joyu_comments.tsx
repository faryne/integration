import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import {
  useJoyuAdminActions,
  useJoyuAdminBans,
  useJoyuAdminComments,
  type JoyuAdminComment,
  type JoyuAdminTab,
} from "@/apis/av/joyu_admin.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { SITE_BRANDING } from "@/data/siteBranding.ts";
import { formatSubmissionTime } from "@/helpers/avActressSubmission.ts";

const TABS: { value: JoyuAdminTab | "bans"; label: string }[] = [
  { value: "reported", label: "被檢舉的" },
  { value: "latest", label: "最新的" },
  { value: "bans", label: "封鎖名單" },
];
const REASON_LABELS: Record<string, string> = {
  spam: "垃圾訊息",
  harass: "騷擾",
  privacy: "個資",
  other: "其他",
};
// 封鎖期限：0 是永久
const BAN_DAYS = [
  { value: 1, label: "1 天" },
  { value: 7, label: "7 天" },
  { value: 0, label: "永久" },
];

// 留言所在的 joyu 頁面：影片直接連；女優頁網址要名字，這裡只有 domain:aid，就不連
const targetLink = (c: JoyuAdminComment) =>
  c.target_type === "video"
    ? `${SITE_BRANDING.joyu.origin}/video/${c.target_key.toUpperCase()}`
    : undefined;

type BanDraft = { ban_type: "uid" | "ip"; value: string };

/**
 * joyu 討論版留言管理：/backend_admin/av/comments?tab=&page=（分頁籤與頁碼存在網址）。
 * 可以刪除留言（前台留「此留言已被管理員刪除」）、封鎖 uid 或 IP、解除封鎖；權限由後台 layout 與後端檢查
 */
export function JoyuAdminComments() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ??
    "reported") as JoyuAdminTab | "bans";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const comments = useJoyuAdminComments(
    tab === "bans" ? "reported" : tab,
    page,
  );
  const bans = useJoyuAdminBans(tab === "bans");
  const actions = useJoyuAdminActions();
  const [confirmDelete, setConfirmDelete] = useState<JoyuAdminComment>();
  const [banDraft, setBanDraft] = useState<BanDraft>();
  const [banDays, setBanDays] = useState(7);
  const [banReason, setBanReason] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMessage({ text: ok, ok: true });
    } catch {
      setMessage({ text: "操作失敗，請稍後再試", ok: false });
    }
  };
  const rows = comments.data?.data ?? [];

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Typography component="h1" sx={{ fontSize: 22, fontWeight: 800 }}>
        joyu 留言
      </Typography>
      <Tabs
        onChange={(_, v: string) =>
          setParams(v === "reported" ? {} : { tab: v })
        }
        value={tab}
      >
        {TABS.map((t) => (
          <Tab key={t.value} label={t.label} value={t.value} />
        ))}
      </Tabs>

      {tab === "bans" ? (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>類型</TableCell>
                <TableCell>值</TableCell>
                <TableCell>原因</TableCell>
                <TableCell>到期</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(bans.data ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.ban_type === "ip" ? "IP" : "uid"}</TableCell>
                  <TableCell
                    sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
                  >
                    {b.value}
                  </TableCell>
                  <TableCell>{b.reason}</TableCell>
                  <TableCell>
                    {b.expires_at ? formatSubmissionTime(b.expires_at) : "永久"}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      onClick={() =>
                        void run(
                          () => actions.lift.mutateAsync(b.id),
                          "已解除封鎖",
                        )
                      }
                      size="small"
                    >
                      解除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {bans.isSuccess && bans.data.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              沒有封鎖中的對象
            </Typography>
          )}
        </Paper>
      ) : (
        <>
          {comments.isPending && <Skeleton height={240} variant="rounded" />}
          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: "40%" }}>留言</TableCell>
                  <TableCell>位置</TableCell>
                  <TableCell>留言者</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>檢舉</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id} sx={{ opacity: c.is_deleted ? 0.5 : 1 }}>
                    <TableCell
                      sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                    >
                      {c.parent_id > 0 && (
                        <Chip label="回覆" size="small" sx={{ mr: 0.5 }} />
                      )}
                      {c.is_deleted && (
                        <Chip label="已刪除" size="small" sx={{ mr: 0.5 }} />
                      )}
                      {c.body}
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: 12, mt: 0.5 }}
                      >
                        {formatSubmissionTime(c.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {targetLink(c) ? (
                        <Link
                          href={targetLink(c)}
                          rel="noopener"
                          target="_blank"
                        >
                          {c.target_key}
                        </Link>
                      ) : (
                        `${c.target_type}:${c.target_key}`
                      )}
                    </TableCell>
                    <TableCell>
                      {c.author_name}
                      <Typography color="text.secondary" sx={{ fontSize: 11 }}>
                        {c.is_anonymous ? "匿名" : "Google"}・
                        <Box component="span" sx={{ fontFamily: "monospace" }}>
                          {c.firebase_uid.slice(0, 10)}…
                        </Box>
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                      {c.ip}
                    </TableCell>
                    <TableCell>
                      {c.report_count > 0 && (
                        <>
                          {c.report_count}
                          <Typography
                            color="text.secondary"
                            sx={{ fontSize: 11 }}
                          >
                            {Object.entries(c.reasons ?? {})
                              .map(([r, n]) => `${REASON_LABELS[r] ?? r} ${n}`)
                              .join("、")}
                          </Typography>
                        </>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {!c.is_deleted && (
                        <Button
                          color="error"
                          onClick={() => setConfirmDelete(c)}
                          size="small"
                        >
                          刪除
                        </Button>
                      )}
                      <Button
                        onClick={() =>
                          setBanDraft({
                            ban_type: "uid",
                            value: c.firebase_uid,
                          })
                        }
                        size="small"
                      >
                        封鎖 uid
                      </Button>
                      {c.ip && (
                        <Button
                          onClick={() =>
                            setBanDraft({ ban_type: "ip", value: c.ip })
                          }
                          size="small"
                        >
                          封鎖 IP
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {comments.isSuccess && rows.length === 0 && (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                沒有留言
              </Typography>
            )}
          </Paper>
          {(comments.data?.last_page ?? 0) > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Pagination
                count={comments.data?.last_page}
                onChange={(_, p) =>
                  setParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.set("page", String(p));
                    return next;
                  })
                }
                page={page}
              />
            </Box>
          )}
        </>
      )}

      <Dialog
        onClose={() => setConfirmDelete(undefined)}
        open={!!confirmDelete}
      >
        <DialogTitle>刪除這則留言？</DialogTitle>
        <DialogContent>
          前台會改顯示「此留言已被管理員刪除」，底下的回覆照常顯示。
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(undefined)}>取消</Button>
          <Button
            color="error"
            onClick={() => {
              // 不要寫成 confirmDelete!.id：React Compiler 會把它當成依賴、在 render 時就讀，沒選留言時會直接爆掉
              if (!confirmDelete) return;
              const { id } = confirmDelete;
              setConfirmDelete(undefined);
              void run(
                () => actions.deleteComment.mutateAsync(id),
                "已刪除留言",
              );
            }}
            variant="contained"
          >
            刪除
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog onClose={() => setBanDraft(undefined)} open={!!banDraft}>
        <DialogTitle>
          封鎖{banDraft?.ban_type === "ip" ? " IP" : " uid"}？
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ minWidth: 320, pt: 1 }}>
            <Typography
              sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
            >
              {banDraft?.value}
            </Typography>
            <TextField
              label="期限"
              onChange={(e) => setBanDays(Number(e.target.value))}
              select
              size="small"
              value={banDays}
            >
              {BAN_DAYS.map((d) => (
                <MenuItem key={d.value} value={d.value}>
                  {d.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="原因"
              onChange={(e) => setBanReason(e.target.value)}
              size="small"
              value={banReason}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDraft(undefined)}>取消</Button>
          <Button
            color="error"
            onClick={() => {
              if (!banDraft) return;
              const draft = banDraft;
              setBanDraft(undefined);
              setBanReason("");
              void run(
                () =>
                  actions.ban.mutateAsync({
                    ...draft,
                    days: banDays,
                    reason: banReason,
                  }),
                "已封鎖",
              );
            }}
            variant="contained"
          >
            封鎖
          </Button>
        </DialogActions>
      </Dialog>
      <CustomSnackbar
        message={message?.text ?? ""}
        onClose={() => setMessage(undefined)}
        open={!!message}
        severity={message?.ok ? "success" : "error"}
      />
    </Stack>
  );
}
