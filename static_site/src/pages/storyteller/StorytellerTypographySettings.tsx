import { Button, ButtonGroup, Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  TYPOGRAPHY_FONT_SIZES,
  type StorytellerTypographyPreferences,
  type TypographyFontFamily,
  type TypographyLineHeight,
  type TypographyMeasure,
} from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";

function SettingButtons<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <ButtonGroup size="small" variant="outlined">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "contained" : "outlined"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

/**
 * 閱讀頁「閱讀設定」與編輯區「文字設定」共用的面板，只有寫到哪個 storage key 不同（由呼叫端的 hook 決定）。
 * 編輯區寬度由工作台版面決定，所以用 showMeasure 關掉頁面寬度那一列。
 */
export function StorytellerTypographySettings({
  preferences,
  onChange,
  showMeasure = true,
  caption,
}: {
  preferences: StorytellerTypographyPreferences;
  onChange: (patch: Partial<StorytellerTypographyPreferences>) => void;
  showMeasure?: boolean;
  caption: string;
}) {
  const { t } = useTranslation();
  const sizeIndex = TYPOGRAPHY_FONT_SIZES.indexOf(preferences.fontSize);
  const stepSize = (delta: number) =>
    onChange({ fontSize: TYPOGRAPHY_FONT_SIZES[sizeIndex + delta] });

  return (
    <Stack spacing={1.5}>
      <SettingRow label={t("writer:editor.typography.fontSize")}>
        <ButtonGroup size="small" variant="outlined">
          <Button
            aria-label={t("writer:editor.typography.decreaseFontSize")}
            disabled={sizeIndex <= 0}
            onClick={() => stepSize(-1)}
          >
            A−
          </Button>
          <Button disabled sx={{ minWidth: 42 }}>
            {preferences.fontSize}
          </Button>
          <Button
            aria-label={t("writer:editor.typography.increaseFontSize")}
            disabled={sizeIndex >= TYPOGRAPHY_FONT_SIZES.length - 1}
            onClick={() => stepSize(1)}
          >
            A＋
          </Button>
        </ButtonGroup>
      </SettingRow>
      <Divider />
      <SettingRow label={t("writer:editor.typography.fontFamily")}>
        <SettingButtons
          value={preferences.fontFamily}
          options={(["system", "sans", "serif"] as const).map((value) => ({
            label: t(`writer:editor.typography.fontFamilies.${value}`),
            value: value as TypographyFontFamily,
          }))}
          onChange={(fontFamily) => onChange({ fontFamily })}
        />
      </SettingRow>
      <SettingRow label={t("writer:editor.typography.lineHeight")}>
        <SettingButtons
          value={preferences.lineHeight}
          options={([
            ["tight", 1.7], ["normal", 1.95], ["wide", 2.2],
          ] as const).map(([key, value]) => ({
            label: t(`writer:editor.typography.spacing.${key}`),
            value: value as TypographyLineHeight,
          }))}
          onChange={(lineHeight) => onChange({ lineHeight })}
        />
      </SettingRow>
      {showMeasure && (
        <SettingRow label={t("writer:editor.typography.measure")}>
          <SettingButtons
            value={preferences.measure}
            options={([
              ["narrow", 640], ["normal", 720], ["wide", 820],
            ] as const).map(([key, value]) => ({
              label: t(`writer:editor.typography.width.${key}`),
              value: value as TypographyMeasure,
            }))}
            onChange={(measure) => onChange({ measure })}
          />
        </SettingRow>
      )}
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>
    </Stack>
  );
}
