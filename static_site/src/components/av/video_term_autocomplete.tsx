import { useState } from "react";
import { Autocomplete, Chip, TextField } from "@mui/material";
import type { VideoTermKey } from "@/types/avVideoSubmission.ts";
import { useVideoTermSuggest } from "@/apis/av/video_submission.ts";
import { useDebouncedValue } from "@/helpers/useDebouncedValue.ts";
import { renderCountOption } from "@/components/av/option_count.tsx";

// 選項已經由後端依輸入字篩過，前端不再篩選
const keepOptions = (x: string[]) => x;

/**
 * 影片修改表單的陣列欄位（出演、監督、系列、發售商、品牌、標籤）：多選 chip＋autocomplete。
 * 選項由後端依「包含輸入字」查影片統計、依作品數排序；freeSolo 時可以填清單外的新值（標籤不行）。
 * baseItems 有給時（修改模式）新加的 chip 標色，改過整欄標「已修改」並顯示原本的值
 */
export function VideoTermAutocomplete({
  field,
  label,
  items,
  baseItems,
  freeSolo = true,
  onChange,
}: {
  field: VideoTermKey;
  label: string;
  items: string[];
  baseItems?: string[];
  freeSolo?: boolean;
  onChange: (items: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const q = useDebouncedValue(input.trim(), 300);
  const suggest = useVideoTermSuggest(field, q);
  const options = suggest.data ?? [];
  const counts = new Map(options.map((o) => [o.value, o.count]));
  const changed =
    baseItems !== undefined &&
    JSON.stringify(baseItems) !== JSON.stringify(items);

  return (
    <Autocomplete
      // freeSolo 時 MUI 的 Enter 以「打的字」為準，只有用方向鍵／滑鼠選過的選項才會被選取（v7.3 起）；
      // 自動反白第一個選項會讓人誤以為 Enter 會選它，所以只有不能自由輸入的欄位（標籤）才自動反白
      autoHighlight={!freeSolo}
      filterOptions={keepOptions}
      filterSelectedOptions
      freeSolo={freeSolo}
      inputValue={input}
      loading={suggest.isFetching}
      loadingText="讀取選項中…"
      multiple
      noOptionsText={suggest.isError ? "讀取選項失敗" : "沒有符合的選項"}
      onChange={(_, v) => {
        // freeSolo 打完按 Enter 的值去頭尾空白、去重複
        const next: string[] = [];
        for (const s of v.map((x) => x.trim())) {
          if (s && !next.includes(s)) next.push(s);
        }
        onChange(next);
      }}
      onInputChange={(_, v, reason) => reason !== "reset" && setInput(v)}
      options={options.map((o) => o.value)}
      renderInput={(params) => (
        <TextField
          {...params}
          color={changed ? "success" : undefined}
          focused={changed || undefined}
          helperText={
            changed ? `原本：${baseItems!.join("、") || "（未填）"}` : undefined
          }
          label={changed ? `${label}・已修改` : label}
          size="small"
        />
      )}
      renderOption={renderCountOption(counts, "部")}
      renderValue={(value, getItemProps) =>
        value.map((item, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return (
            <Chip
              color={
                baseItems && !baseItems.includes(item) ? "success" : "default"
              }
              key={key}
              label={item}
              size="small"
              {...itemProps}
            />
          );
        })
      }
      value={items}
    />
  );
}
