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
import { Link as RouterLink } from "react-router-dom";
import type { ActressLink } from "@/types/av.ts";
import { linkLabel } from "@/helpers/referenceLink.ts";
import type { SubmissionDiffSpec } from "@/helpers/submissionDiff.ts";
import { changedSubmissionFields } from "@/helpers/submissionDiff.ts";

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
 * now 有給時（提交後資料又被改過）多一欄「現在的值」
 */
export function SubmissionDiff<F, K extends keyof F>({
  spec,
  left,
  right,
  now,
  leftLabel,
  rightLabel = "提交的值",
  onlyChanged,
}: {
  spec: SubmissionDiffSpec<F, K>;
  left: F | null;
  right: F;
  now?: F | null;
  leftLabel: string;
  rightLabel?: string;
  onlyChanged: boolean;
}) {
  const changed = left ? changedSubmissionFields(spec, left, right) : spec.keys;
  const drifted = left && now ? changedSubmissionFields(spec, left, now) : [];
  const keys = onlyChanged
    ? spec.keys.filter((k) => changed.includes(k) || drifted.includes(k))
    : spec.keys;
  const value = (f: F, key: K): ReactNode => {
    const text = spec.format(f, key);
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
  };

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
              <TableRow key={String(key)}>
                <TableCell
                  sx={{
                    color: "text.secondary",
                    whiteSpace: "nowrap",
                    width: 110,
                  }}
                >
                  {spec.labels[key]}
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
                    : left && spec.listKeys.includes(key)
                      ? listDiff(spec, key, left[key], right[key])
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

type ListItem = string | ActressLink;

/** 陣列欄位：保留的照常顯示、新增的綠色、移除的紅色刪除線 */
function listDiff<F, K extends keyof F>(
  spec: SubmissionDiffSpec<F, K>,
  key: K,
  beforeValue: F[K],
  afterValue: F[K],
) {
  const id = (x: ListItem) => (typeof x === "string" ? x : x.url);
  const label = (x: ListItem) =>
    typeof x === "string" ? x : `${linkLabel(x)}｜${x.url}`;
  const before = beforeValue as ListItem[];
  const after = afterValue as ListItem[];
  const all = [
    ...before,
    ...after.filter((a) => !before.some((b) => id(b) === id(a))),
  ];
  return (
    <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
      {all.map((item) => {
        const removed = !after.some((a) => id(a) === id(item));
        const added = !before.some((b) => id(b) === id(item));
        const href =
          typeof item === "string" ? spec.itemHref?.(key, item) : undefined;
        const note =
          added && typeof item === "string"
            ? spec.itemNote?.(key, item)
            : undefined;
        return (
          <Stack
            direction="row"
            key={id(item)}
            spacing={0.5}
            sx={{ alignItems: "center", maxWidth: "100%" }}
          >
            <Chip
              color={added ? "success" : removed ? "error" : "default"}
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
              {...(href
                ? {
                    clickable: true,
                    component: RouterLink,
                    target: "_blank",
                    to: href,
                  }
                : {})}
            />
            {note && (
              <Chip color="info" label={note} size="small" variant="outlined" />
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}
