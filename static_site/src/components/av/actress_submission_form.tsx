import { useState } from "react";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  ActressFieldKey,
  ActressFields,
} from "@/types/avActressSubmission.ts";
import { ACTRESS_CUP_PATTERN } from "@/data/avActressFields.ts";
import {
  changedActressFields,
  formatActressField,
} from "@/helpers/avActressFields.ts";
import { useDebouncedValue } from "@/helpers/useDebouncedValue.ts";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import { useAVActressSearch } from "@/apis/av/actress_search.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { ActressLinksEditor } from "@/components/av/actress_links_editor.tsx";
import { ActressInterestsInput } from "@/components/av/actress_interests_input.tsx";

type NumberKey =
  | "height"
  | "bust"
  | "waist"
  | "hips"
  | "birth_year"
  | "birth_month"
  | "birth_day";
type TextKey = "name" | "kana" | "photo" | "cup" | "blood" | "born_city";

/**
 * 女優上稿表單（新增／修改共用）。
 * 修改模式傳 base（目前資料）：改過的欄位標色並顯示原本的值；新增模式在姓名輸入後提醒同名女優
 */
export function ActressSubmissionForm({
  initial,
  base,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial: ActressFields;
  base?: ActressFields;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (fields: ActressFields) => void;
}) {
  const [fields, setFields] = useState(initial);
  const set = <K extends ActressFieldKey>(key: K, value: ActressFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));
  const changed = base ? changedActressFields(base, fields) : [];
  const cupInvalid = fields.cup !== "" && !ACTRESS_CUP_PATTERN.test(fields.cup);

  // 新增時查同名女優：如果是同一位，先提醒提交者改用「修改資料」
  const debouncedName = useDebouncedValue(fields.name.trim(), 400);
  const sameName = useAVActressSearch(
    { name: debouncedName, page: 1 },
    !base && debouncedName !== "",
  );
  // 修改模式也會讀到同一份搜尋快取，只有新增模式才提醒
  const existing = base
    ? undefined
    : sameName.data?.data?.data?.find((a) => a.name === debouncedName);

  // 修改模式：改過的欄位用 success 色並在下方顯示原本的值
  const changedProps = (key: ActressFieldKey) =>
    changed.includes(key)
      ? {
          color: "success" as const,
          focused: true,
          helperText: `原本：${formatActressField(base!, key) || "（未填）"}`,
        }
      : {};
  const text = (key: TextKey, label: string, extra = {}) => (
    <TextField
      key={key}
      fullWidth
      label={label}
      onChange={(e) =>
        set(key, key === "cup" ? e.target.value.toUpperCase() : e.target.value)
      }
      size="small"
      value={fields[key]}
      {...changedProps(key)}
      {...extra}
    />
  );
  const number = (key: NumberKey, label: string) => (
    <TextField
      key={key}
      fullWidth
      label={label}
      onChange={(e) => set(key, Math.max(parseInt(e.target.value, 10) || 0, 0))}
      size="small"
      slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
      type="number"
      value={fields[key] || ""}
      {...changedProps(key)}
    />
  );
  const section = (title: string, children: ReactNode) => (
    <Stack spacing={1.25}>
      <Typography color="text.secondary" fontWeight={700} variant="body2">
        {title}
      </Typography>
      {children}
    </Stack>
  );
  const row = (...children: ReactNode[]) => (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "repeat(2, minmax(0, 1fr))",
          md: `repeat(${children.length}, minmax(0, 1fr))`,
        },
      }}
    >
      {children}
    </Box>
  );

  return (
    <Stack
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(fields);
      }}
      spacing={2}
    >
      {base && <Alert severity="info">已修改 {changed.length} 個欄位</Alert>}
      {existing && (
        <Alert severity="warning">
          已有同名女優：
          <Link
            component={RouterLink}
            to={actressPagePath(existing.name, existing)}
          >
            {existing.name}
          </Link>
          。如果是同一位，請到該女優頁按「修改資料」。
        </Alert>
      )}
      <Paper
        variant="outlined"
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "200px minmax(0, 1fr)" },
          p: 2,
        }}
      >
        <Stack spacing={1.5} sx={{ alignItems: "center" }}>
          <ActressPhoto
            alt={fields.name}
            src={fields.photo}
            sx={{ borderRadius: 2, width: { xs: 140, md: "100%" } }}
          />
          {text("photo", "照片網址", { placeholder: "https://" })}
        </Stack>
        <Stack spacing={2.5}>
          {section(
            "基本資料",
            <>
              {row(
                text("name", "姓名", { required: true }),
                text("kana", "假名"),
              )}
              <ActressInterestsInput
                baseItems={base?.aliases}
                items={fields.aliases}
                label="別名（Enter 新增）"
                onChange={(v) => set("aliases", v)}
              />
            </>,
          )}
          {section(
            "身形",
            row(
              number("height", "身高（cm）"),
              number("bust", "B（cm）"),
              number("waist", "W（cm）"),
              number("hips", "H（cm）"),
            ),
          )}
          {section(
            "其他",
            <>
              {row(
                number("birth_year", "生日・年"),
                number("birth_month", "月"),
                number("birth_day", "日"),
                text("cup", "罩杯", {
                  error: cupInvalid,
                  placeholder: "例如 D、K",
                  ...(cupInvalid ? { helperText: "AAA、AA、A～Z" } : {}),
                }),
              )}
              {row(text("blood", "血型"), text("born_city", "出生地"))}
              <ActressInterestsInput
                baseItems={base?.interests}
                items={fields.interests}
                onChange={(v) => set("interests", v)}
              />
            </>,
          )}
          {section(
            "參考連結",
            <ActressLinksEditor
              baseUrls={base?.links.map((l) => l.url)}
              links={fields.links}
              onChange={(v) => set("links", v)}
            />,
          )}
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "flex-end" }}
          >
            <Button onClick={onCancel}>取消</Button>
            <Button
              disabled={
                submitting ||
                cupInvalid ||
                !fields.name.trim() ||
                (base && changed.length === 0)
              }
              startIcon={
                submitting ? (
                  <CircularProgress color="inherit" size={16} />
                ) : undefined
              }
              type="submit"
              variant="contained"
            >
              送出審核
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
}
