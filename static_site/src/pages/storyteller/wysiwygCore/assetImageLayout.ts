import type { SxProps, Theme } from "@mui/material/styles";

import {
  ASSET_IMAGE_LAYOUT_VALUES,
  DEFAULT_ASSET_IMAGE_LAYOUT,
  normalizeAssetImageLayout,
  type AssetImageLayoutValue,
} from "./whitelist";

export const ASSET_IMAGE_LAYOUT_LABELS: Record<
  AssetImageLayoutValue,
  string
> = {
  block: "圖片全寬",
  center: "圖片置中",
  "float-left": "圖片靠左環繞",
  "float-right": "圖片靠右環繞",
};

export const ASSET_IMAGE_LAYOUT_OPTIONS = ASSET_IMAGE_LAYOUT_VALUES.map(
  (value) => ({ value, label: ASSET_IMAGE_LAYOUT_LABELS[value] }),
);

export function assetImageLayoutTitle(layout: AssetImageLayoutValue) {
  return layout === DEFAULT_ASSET_IMAGE_LAYOUT ? "" : ` "layout=${layout}"`;
}

export function assetImageFrameSx(value: unknown): SxProps<Theme> {
  const layout = normalizeAssetImageLayout(value);
  const base: SxProps<Theme> = {
    my: 1,
    maxWidth: "100%",
    overflow: "hidden",
    borderRadius: 1,
    bgcolor: "background.default",
  };
  if (layout === "center") {
    return {
      ...base,
      display: "block",
      width: { xs: "100%", sm: "min(80%, 720px)" },
      mx: "auto",
      clear: "both",
    };
  }
  if (layout === "float-left" || layout === "float-right") {
    const isLeft = layout === "float-left";
    return {
      ...base,
      display: "block",
      float: { xs: "none", sm: isLeft ? "left" : "right" },
      width: { xs: "100%", sm: "min(45%, 360px)" },
      mr: { xs: 0, sm: isLeft ? 2 : 0 },
      ml: { xs: 0, sm: isLeft ? 0 : 2 },
      clear: "both",
    };
  }
  return { ...base, display: "block", width: "100%" };
}

export const CLEAR_FLOATING_ASSET_SX = {
  "& h1, & h2, & h3, & h4, & h5, & h6": { clear: "both" },
  "& [data-block-kind], & table, & [data-asset-layout]": { clear: "both" },
} as const;
