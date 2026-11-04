import { useState } from "react";
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  VideoFieldKey,
  VideoFields,
  VideoTermKey,
} from "@/types/avVideoSubmission.ts";
import {
  VIDEO_DATE_PATTERN,
  VIDEO_FIELD_LABELS,
} from "@/data/avVideoFields.ts";
import {
  changedVideoFields,
  formatVideoField,
} from "@/helpers/avVideoFields.ts";
import { AvCoverImage } from "@/components/av/av_cover_image.tsx";
import { VideoTermAutocomplete } from "@/components/av/video_term_autocomplete.tsx";
import { LinksEditor } from "@/components/common/LinksEditor.tsx";

type TextKey = "title" | "maker_no" | "vod_date" | "publish_date";

/**
 * 影片修改表單：預填目前資料，改過的欄位標色並顯示原本的值。
 * 封面只顯示、不開放修改（只能來自 DMM）
 */
export function VideoSubmissionForm({
  base,
  thumb,
  submitting,
  onCancel,
  onSubmit,
}: {
  base: VideoFields;
  thumb: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (fields: VideoFields) => void;
}) {
  const [fields, setFields] = useState(base);
  const set = <K extends VideoFieldKey>(key: K, value: VideoFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));
  const changed = changedVideoFields(base, fields);
  const dateInvalid = (key: "vod_date" | "publish_date") =>
    fields[key].trim() !== "" && !VIDEO_DATE_PATTERN.test(fields[key].trim());
  const invalid =
    !fields.title.trim() ||
    dateInvalid("vod_date") ||
    dateInvalid("publish_date");

  // 改過的欄位用 success 色並在下方顯示原本的值
  const changedProps = (key: VideoFieldKey) =>
    changed.includes(key)
      ? {
          color: "success" as const,
          focused: true,
          helperText: `原本：${formatVideoField(base, key) || "（未填）"}`,
        }
      : {};
  const text = (key: TextKey, extra = {}) => (
    <TextField
      key={key}
      fullWidth
      label={VIDEO_FIELD_LABELS[key]}
      onChange={(e) => set(key, e.target.value)}
      size="small"
      value={fields[key]}
      {...changedProps(key)}
      {...extra}
    />
  );
  const date = (key: "vod_date" | "publish_date") =>
    text(key, {
      placeholder: "YYYY/MM/DD",
      ...(dateInvalid(key)
        ? { error: true, helperText: "格式：YYYY/MM/DD" }
        : {}),
    });
  const term = (key: VideoTermKey) => (
    <VideoTermAutocomplete
      key={key}
      baseItems={base[key]}
      field={key}
      // DMM 的類型是固定清單，標籤只能從現有選項選
      freeSolo={key !== "tags"}
      items={fields[key]}
      label={VIDEO_FIELD_LABELS[key]}
      onChange={(v) => set(key, v)}
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
  const row = (columns: number, ...children: ReactNode[]) => (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: columns > 2 ? "repeat(2, minmax(0, 1fr))" : "1fr",
          md: `repeat(${columns}, minmax(0, 1fr))`,
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
      <Alert severity="info">已修改 {changed.length} 個欄位</Alert>
      <Paper
        variant="outlined"
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "200px minmax(0, 1fr)" },
          p: 2,
        }}
      >
        <AvCoverImage
          alt={fields.title}
          src={thumb}
          sx={{
            alignSelf: "start",
            borderRadius: 2,
            justifySelf: "center",
            maxWidth: "100%",
            width: { xs: 140, md: "100%" },
          }}
        />
        <Stack spacing={2.5}>
          {section(
            "基本資料",
            <>
              {text("title", { multiline: true, minRows: 2, required: true })}
              {row(
                4,
                text("maker_no", { placeholder: "例如 MDVR-448" }),
                date("vod_date"),
                date("publish_date"),
                <TextField
                  key="duration"
                  fullWidth
                  label="片長（分鐘）"
                  onChange={(e) =>
                    set(
                      "duration",
                      Math.max(parseInt(e.target.value, 10) || 0, 0),
                    )
                  }
                  size="small"
                  slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
                  type="number"
                  value={fields.duration || ""}
                  {...changedProps("duration")}
                />,
              )}
            </>,
          )}
          {section(
            "出演與製作",
            <>
              {term("actresses")}
              {row(2, term("directors"), term("series"))}
              {row(2, term("makers"), term("labels"))}
              {term("tags")}
            </>,
          )}
          {section(
            "參考連結",
            <LinksEditor
              baseUrls={base.links.map((l) => l.url)}
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
              disabled={submitting || invalid || changed.length === 0}
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
