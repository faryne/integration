import type { Components, Theme } from "@mui/material/styles";

import { STORYTELLER_CSS_VARIABLE_NAMES } from "./storytellerSemanticTheme";

const v = (key: keyof typeof STORYTELLER_CSS_VARIABLE_NAMES) =>
  `var(${STORYTELLER_CSS_VARIABLE_NAMES[key]})`;

/**
 * Phase E 對比度檢查抓到的問題：選單「選中項目」原本直接拿 `selection` token
 * 當實色背景、上面疊 `textPrimary`——`selection` 是中亮度的強調色，拿來當
 * 「選取狀態的高亮邊框/outline」（圖片、表格 NodeSelection）對比度沒問題，
 * 但整塊實色背景 + 全對比度文字這個用法，22 組色系有一半以上不達 WCAG AA
 * （4.5:1），是色彩學的硬限制，不是選錯顏色。
 *
 * 改成「半透明色層蓋在原本背景上」（Material Design 的 state layer 概念，很多
 * 產品的選單選中態其實都是這樣做），不用重新設計 11 組色系的 `selection` 數值：
 * `color-mix()` 把 `selection` 跟 `surfaceOverlay` 混出一個貼近原本背景亮度、
 * 只帶一點強調色的淡色調，文字顏色完全不用動。22% 是實測掃過 10%~50% 找出來的
 * 安全值（`npx vitest run` 對比度檢查跑過全部色系＋中秋節 overlay，worst case
 * 6.56:1，比 4.5:1 要求有充足餘裕；35% 以上開始有色系會低於 4.5:1）。
 */
function selectionStateLayer(percent: number) {
  return `color-mix(in srgb, ${v("selection")} ${percent}%, transparent)`;
}

/**
 * Phase E 對比度檢查也抓到 `MuiButton` `contained` 的另一半問題：MUI 沒有明講
 * `primary.contrastText` 時用 `contrastThreshold`（預設 3）自動選黑字/白字，門檻
 * 比 WCAG AA 文字要求的 4.5:1 寬鬆，`accentMain` 是中亮度品牌色，很多色系兩種
 * 選擇都不夠格——這不是換個判斷邏輯能解的，是同一塊背景色沒辦法同時跟純黑、純白
 * 都達到 4.5:1，色彩學的硬限制。
 *
 * 改成跟選單 active 狀態同一招：不用整塊實色 `accentMain` 背景，改成淡色調
 * （`accentMain` 用 `color-mix()` 疊一點在 `surfaceRaised` 上）＋固定用
 * `textPrimary` 當文字色（不是 `accentMain` 本身——實測發現 `accentMain` 拿來
 * 當文字疊在一般 surface 上，也不是每個色系都過 4.5:1，例如 bronze 淺色模式只有
 * 2.66:1；只有已經證實「22 組色系 × 三種 surface 全部過關」的 `textPrimary`
 * 才穩）。30% 是實測掃過 10%~40% 找出來的安全值，worst case 6.18:1，比 4.5:1
 * 要求有餘裕，視覺上仍看得出是「調過色」的按鈕，不是普通中性按鈕。
 */
function accentTonalBackground(percent: number) {
  return `color-mix(in srgb, ${v("accentMain")} ${percent}%, ${v("surfaceRaised")})`;
}

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
          "&.Mui-selected": { backgroundColor: selectionStateLayer(22) },
          "&.Mui-selected:hover": { backgroundColor: selectionStateLayer(22) },
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
    MuiButton: {
      styleOverrides: {
        // 只改 containedPrimary（`variant="contained"` 沒指定 `color` 時的預設，
        // 也是 `color="primary"` 明講時的 slot）——`accentMain` 是 `primary.main`，
        // 這是這次對比度問題的來源。`containedSecondary`／`containedError` 等
        // 沒有一起改：這次對比度檢查只驗證過 primary，範圍故意卡住不擴大。
        containedPrimary: {
          backgroundColor: accentTonalBackground(30),
          color: v("textPrimary"),
          boxShadow: "none",
          "&:hover": {
            backgroundColor: accentTonalBackground(40),
            boxShadow: "none",
          },
          "&:active": {
            backgroundColor: accentTonalBackground(48),
          },
          "&.Mui-disabled": {
            backgroundColor: accentTonalBackground(12),
            color: v("textMuted"),
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
          '&[aria-selected="true"]': {
            backgroundColor: selectionStateLayer(22),
          },
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
        // 跟下面 MuiChip 同一個坑：只有 `variant="standard"`（沒特別指定，
        // 預設值）才套用 surfaceRaised 換皮。`variant="filled"`（例如
        // CustomSnackbar.tsx 存檔完成的提示）MUI 內建是「severity 色系飽和
        // 背景＋白字」，這裡如果無條件把背景改成偏淺的 surfaceRaised，白字
        // 會看不見（Faryne 實測發現：存檔完成的提示文字整個消失）。
        // `variant="outlined"` 也排除，理由一樣（outlined 用 severity 色文
        // 字＋透明背景，不該被蓋成 surfaceRaised）。
        root: ({ ownerState }) =>
          ownerState.variant === "standard" || ownerState.variant === undefined
            ? {
                backgroundColor: v("surfaceRaised"),
                border: `1px solid ${v("borderSubtle")}`,
              }
            : {},
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
