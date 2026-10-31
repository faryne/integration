import type { ReactNode } from "react";
import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  alpha,
} from "@mui/material";
import type { Theme } from "@mui/material";
import type {
  ActressFieldKey,
  ActressFields,
} from "@/types/avActressSubmission.ts";
import {
  ACTRESS_FIELD_KEYS,
  ACTRESS_FIELD_LABELS,
} from "@/data/avActressFields.ts";
import {
  changedActressFields,
  formatActressField,
  linkLabel,
} from "@/helpers/avActressFields.ts";

// 舊值淡紅、新值淡綠、提交後被改過的現值淡黃（深淺色模式都用主色加透明度）
const tint = (palette: "error" | "success" | "warning") => ({
  bgcolor: (t: Theme) => alpha(t.palette[palette].main, 0.1),
  color: `${palette}.main`,
});
const cellColor = {
  old: tint("error"),
  new: { ...tint("success"), fontWeight: 700 },
  now: tint("warning"),
};

/**
 * 審核用的欄位比對表：目前（或提交時）的值 → 提交的新值。
 * now 有給時（提交後資料又被改過）多一欄「現在的值」；興趣與參考連結逐項標出新增／移除
 */
export function ActressSubmissionDiff({
  left,
  right,
  now,
  leftLabel,
  rightLabel = "提交的值",
  onlyChanged,
}: {
  left: ActressFields | null;
  right: ActressFields;
  now?: ActressFields | null;
  leftLabel: string;
  rightLabel?: string;
  onlyChanged: boolean;
}) {
  const changed = left ? changedActressFields(left, right) : ACTRESS_FIELD_KEYS;
  const drifted = left && now ? changedActressFields(left, now) : [];
  const keys = onlyChanged
    ? ACTRESS_FIELD_KEYS.filter(
        (k) => changed.includes(k) || drifted.includes(k),
      )
    : ACTRESS_FIELD_KEYS;

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>欄位</TableCell>
            {left && <TableCell>{leftLabel}</TableCell>}
            {drifted.length > 0 && <TableCell>現在的值</TableCell>}
            <TableCell>{rightLabel}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {keys.map((key) => {
            const isChanged = changed.includes(key);
            return (
              <TableRow key={key}>
                <TableCell
                  sx={{
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                    width: 110,
                  }}
                >
                  {ACTRESS_FIELD_LABELS[key]}
                </TableCell>
                {left && (
                  <TableCell
                    sx={isChanged ? cellColor.old : { color: "text.secondary" }}
                  >
                    {value(left, key)}
                  </TableCell>
                )}
                {drifted.length > 0 && (
                  <TableCell
                    sx={
                      drifted.includes(key)
                        ? cellColor.now
                        : { color: "text.secondary" }
                    }
                  >
                    {value(now!, key)}
                  </TableCell>
                )}
                <TableCell
                  sx={isChanged ? cellColor.new : { color: "text.secondary" }}
                >
                  {!isChanged
                    ? "—"
                    : left &&
                        (key === "links" ||
                          key === "interests" ||
                          key === "aliases")
                      ? listDiff(left, right, key)
                      : value(right, key)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}

function value(f: ActressFields, key: ActressFieldKey): ReactNode {
  const text = formatActressField(f, key);
  if (!text)
    return (
      <Box component="span" sx={{ color: "text.disabled" }}>
        （未填）
      </Box>
    );
  return (
    <Box
      component="span"
      sx={{ whiteSpace: "pre-line", wordBreak: "break-all" }}
    >
      {text}
    </Box>
  );
}

/** 別名／興趣／參考連結：保留的照常顯示、新增的綠色、移除的紅色刪除線 */
function listDiff(
  left: ActressFields,
  right: ActressFields,
  key: "links" | "interests" | "aliases",
) {
  const id = (x: string | { url: string }) =>
    typeof x === "string" ? x : x.url;
  const label = (x: string | { url: string; title: string }) =>
    typeof x === "string" ? x : `${linkLabel(x)}｜${x.url}`;
  const before = left[key] as (string | { url: string; title: string })[];
  const after = right[key] as (string | { url: string; title: string })[];
  const all = [
    ...before,
    ...after.filter((a) => !before.some((b) => id(b) === id(a))),
  ];
  return (
    <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
      {all.map((item) => {
        const removed = !after.some((a) => id(a) === id(item));
        const added = !before.some((b) => id(b) === id(item));
        return (
          <Chip
            color={added ? "success" : removed ? "error" : "default"}
            key={id(item)}
            label={label(item)}
            size="small"
            sx={{
              height: "auto",
              maxWidth: "100%",
              py: 0.25,
              textDecoration: removed ? "line-through" : "none",
              "& .MuiChip-label": {
                whiteSpace: "normal",
                wordBreak: "break-all",
              },
            }}
            variant={added || removed ? "filled" : "outlined"}
          />
        );
      })}
    </Stack>
  );
}
