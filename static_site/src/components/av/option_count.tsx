import type { HTMLAttributes, Key } from "react";
import { Box } from "@mui/material";

/**
 * Autocomplete 選項列：左邊是值、右邊是數量（「12 部」「3 位」）。
 * counts 沒有這個值時顯示 missingText（沒給就不顯示），女優主題條件、影片修改表單共用
 */
export function renderCountOption(
  counts: Map<string, number>,
  unit: string,
  missingText?: string,
) {
  return (
    props: HTMLAttributes<HTMLLIElement> & { key?: Key },
    option: string,
  ) => {
    const { key, ...rest } = props;
    const count = counts.get(option);
    return (
      <li key={key} {...rest}>
        <Box component="span" sx={{ flex: 1, wordBreak: "break-all" }}>
          {option}
        </Box>
        <Box
          component="span"
          sx={{ color: "text.secondary", ml: 2, whiteSpace: "nowrap" }}
        >
          {count === undefined
            ? missingText
            : `${count.toLocaleString()} ${unit}`}
        </Box>
      </li>
    );
  };
}
