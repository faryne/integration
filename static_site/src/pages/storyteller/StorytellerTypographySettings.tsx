import { Button, ButtonGroup, Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import {
  TYPOGRAPHY_FONT_SIZES,
  type StorytellerTypographyPreferences,
  type TypographyFontFamily,
  type TypographyLineHeight,
  type TypographyMeasure,
} from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";

const LINE_HEIGHTS: Array<{ label: string; value: TypographyLineHeight }> = [
  { label: "緊", value: 1.7 },
  { label: "適中", value: 1.95 },
  { label: "寬", value: 2.2 },
];
const MEASURES: Array<{ label: string; value: TypographyMeasure }> = [
  { label: "窄", value: 640 },
  { label: "適中", value: 720 },
  { label: "寬", value: 820 },
];
const FONT_FAMILIES: Array<{ label: string; value: TypographyFontFamily }> = [
  { label: "系統", value: "system" },
  { label: "黑體", value: "sans" },
  { label: "明體", value: "serif" },
];

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
  const sizeIndex = TYPOGRAPHY_FONT_SIZES.indexOf(preferences.fontSize);
  const stepSize = (delta: number) =>
    onChange({ fontSize: TYPOGRAPHY_FONT_SIZES[sizeIndex + delta] });

  return (
    <Stack spacing={1.5}>
      <SettingRow label="字體大小">
        <ButtonGroup size="small" variant="outlined">
          <Button
            aria-label="縮小字體"
            disabled={sizeIndex <= 0}
            onClick={() => stepSize(-1)}
          >
            A−
          </Button>
          <Button disabled sx={{ minWidth: 42 }}>
            {preferences.fontSize}
          </Button>
          <Button
            aria-label="放大字體"
            disabled={sizeIndex >= TYPOGRAPHY_FONT_SIZES.length - 1}
            onClick={() => stepSize(1)}
          >
            A＋
          </Button>
        </ButtonGroup>
      </SettingRow>
      <Divider />
      <SettingRow label="字體">
        <SettingButtons
          value={preferences.fontFamily}
          options={FONT_FAMILIES}
          onChange={(fontFamily) => onChange({ fontFamily })}
        />
      </SettingRow>
      <SettingRow label="行距">
        <SettingButtons
          value={preferences.lineHeight}
          options={LINE_HEIGHTS}
          onChange={(lineHeight) => onChange({ lineHeight })}
        />
      </SettingRow>
      {showMeasure && (
        <SettingRow label="頁面寬度">
          <SettingButtons
            value={preferences.measure}
            options={MEASURES}
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
