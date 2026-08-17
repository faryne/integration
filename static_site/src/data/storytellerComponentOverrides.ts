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
 * 第二批（TextField／Tabs／Drawer）於此補上；更多元件（Select／Autocomplete／
 * Switch／Radio／Checkbox／Snackbar／Alert／Divider／Chip）之後再排，見規劃
 * 文件 checklist。
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
  };
}
