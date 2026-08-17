import type { Components, Theme } from "@mui/material/styles";

import { STORYTELLER_CSS_VARIABLE_NAMES } from "./storytellerSemanticTheme";

const v = (key: keyof typeof STORYTELLER_CSS_VARIABLE_NAMES) =>
  `var(${STORYTELLER_CSS_VARIABLE_NAMES[key]})`;

/**
 * Phase B（視覺主題規劃）第一批：Dialog／Menu／Tooltip／Button／IconButton 的
 * MUI `components` override，直接吃 Phase A 曝露的 `--storyteller-*` CSS
 * variable，不需要跟著 `theme`／`[mode, palette]` 重新產生——CSS var 在
 * paint 當下才解析，切色系/切深淺模式時這裡完全不用動，`GlobalStyles`
 * 更新 `:root` 上的變數值就會自動反映。
 *
 * 視覺方向（跟規劃文件一致）：低調工業感，不要浮誇蒸汽龐克。重點是邊框／
 * surface 層次／hover-focus 狀態一致，不是到處加裝飾。
 *
 * 第二批（TextField／Tabs／Drawer）與後續（Select／Autocomplete／Switch／
 * Radio／Checkbox／Snackbar／Alert／Divider／Chip）都已補上，Phase B 清單
 * 全數完成，見規劃文件 checklist。
 */
export function storytellerComponentOverrides(): Components<Theme> {
  return {
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: v("surfaceOverlay"),
          backgroundImage: "none",
          border: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: v("surfaceOverlay"),
          backgroundImage: "none",
          border: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          "&:hover": { backgroundColor: v("surfaceRaised") },
          "&.Mui-selected": { backgroundColor: v("selection") },
          "&.Mui-selected:hover": { backgroundColor: v("selection") },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: v("surfaceOverlay"),
          backgroundImage: "none",
          border: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: `1px solid ${v("borderSubtle")}`,
          padding: "12px 24px",
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: v("surfaceOverlay"),
          color: v("textPrimary"),
          border: `1px solid ${v("borderSubtle")}`,
          borderRadius: 4,
          fontSize: "0.75rem",
          padding: "4px 8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
        },
        arrow: {
          color: v("surfaceOverlay"),
          "&::before": {
            border: `1px solid ${v("borderSubtle")}`,
          },
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          // a11y：focus-visible 外框不能被拿掉，只能換色——瀏覽器預設藍色跟
          // storyteller 色盤不搭，換成 focusRing token，其餘 focus trap／
          // keyboard 行為完全不動（MuiButtonBase 是 Button/IconButton 共用的
          // 底層，這裡改一次兩邊都吃到，不用分別寫）。
          "&.Mui-focusVisible": {
            outline: `2px solid ${v("focusRing")}`,
            outlineOffset: 2,
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: v("borderSubtle"),
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: v("borderStrong"),
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: v("accentMain"),
            borderWidth: 2,
          },
          "&.Mui-error .MuiOutlinedInput-notchedOutline": {
            borderColor: v("danger"),
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: v("textMuted"),
          "&.Mui-focused": { color: v("accentMain") },
          "&.Mui-error": { color: v("danger") },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          color: v("textMuted"),
          "&.Mui-error": { color: v("danger") },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: v("accentMain"),
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: v("textMuted"),
          "&.Mui-selected": { color: v("textPrimary") },
          "&.Mui-focusVisible": {
            outline: `2px solid ${v("focusRing")}`,
            outlineOffset: -2,
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: v("surfaceOverlay"),
          backgroundImage: "none",
          border: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: { color: v("textMuted") },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          backgroundColor: v("surfaceOverlay"),
          backgroundImage: "none",
          border: `1px solid ${v("borderSubtle")}`,
        },
        option: {
          '&[aria-selected="true"]': { backgroundColor: v("selection") },
          "&:hover": { backgroundColor: v("surfaceRaised") },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        track: { backgroundColor: v("borderStrong") },
        thumb: { backgroundColor: v("textMuted") },
        switchBase: {
          "&.Mui-checked": {
            color: v("accentMain"),
            "& + .MuiSwitch-track": { backgroundColor: v("accentMain") },
          },
        },
      },
    },
    MuiRadio: {
      styleOverrides: {
        root: {
          color: v("textMuted"),
          "&.Mui-checked": { color: v("accentMain") },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: v("textMuted"),
          "&.Mui-checked": { color: v("accentMain") },
        },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          backgroundColor: v("surfaceOverlay"),
          color: v("textPrimary"),
          border: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          backgroundColor: v("surfaceRaised"),
          border: `1px solid ${v("borderSubtle")}`,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: v("borderSubtle") },
      },
    },
    MuiChip: {
      styleOverrides: {
        // 只有 `color="default"`（沒特別指定語意色）的 Chip 才套用我們的
        // surfaceRaised/borderSubtle 換皮——`color="primary"`／`"success"`
        // 這類語意色 Chip，MUI 內建就會配一組保證看得清楚的文字色（通常是白
        // 字），如果不分青紅皂白把所有 Chip 背景都強制改成偏淺的
        // surfaceRaised，會把「白字配語意色背景」的組合變成「白字配淺色背
        // 景」，字直接看不見（Faryne 實測發現：專案卡片上的可見度標籤 Chip
        // 文字整個消失）。只鎖 `ownerState.color === "default"` 就不會動到
        // 語意色 Chip 原本的配色邏輯。
        root: ({ ownerState }) =>
          ownerState.color === "default" || ownerState.color === undefined
            ? {
                backgroundColor: v("surfaceRaised"),
                border: `1px solid ${v("borderSubtle")}`,
              }
            : {},
        deleteIcon: { color: v("textMuted") },
      },
    },
  };
}
