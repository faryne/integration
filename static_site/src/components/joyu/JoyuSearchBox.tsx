import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Autocomplete,
  Box,
  Button,
  InputBase,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { useActressSuggest } from "@/apis/av/actress_search.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { HighlightText } from "@/components/common/HighlightText.tsx";
import { actressPagePath } from "@/helpers/avActressRef.ts";
import { joyuSearchPath, joyuVideoCode } from "@/helpers/joyu.ts";
import { useDebouncedValue } from "@/helpers/useDebouncedValue.ts";
import type { Actress } from "@/types/av.ts";

import { joyuInk } from "./joyuTheme.ts";

// autocomplete：停止打字 250ms 才查、至少 2 個字（1 個字範圍太廣），下拉最多列 8 位
const SUGGEST_DELAY_MS = 250;
const SUGGEST_MIN_CHARS = 2;
const SUGGEST_SIZE = 8;

/** 名字沒命中時，列出命中的別名或假名，讓人知道為什麼會出現這位 */
const matchedAlias = (a: Actress, q: string) => {
  const lower = q.toLowerCase();
  if (a.name.toLowerCase().includes(lower)) return undefined;
  return [...(a.aliases ?? []), a.kana].find((x) =>
    x?.toLowerCase().includes(lower),
  );
};

/**
 * joyu 的統一搜尋框（頁首、首頁主視覺共用）：番號直接到影片頁，其他當名字到女優搜尋（規則見 helpers/joyu.ts）。
 * header：深紫頁首裡的小輸入框；hero：首頁主視覺的大輸入框加搜尋鈕。
 * 輸入名字時下拉列出符合的女優（女優搜尋 API 第一頁），選了直接開女優頁（帶 xcity_id／manual_id，同名不會開錯）；
 * 不選直接 Enter 或按搜尋鈕，照舊走 joyuSearchPath。輸入法選字中不查，選字的 Enter 也不會送出（MUI 會略過 keyCode 229）
 */
export function JoyuSearchBox({ variant }: { variant: "header" | "hero" }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [composing, setComposing] = useState(false);
  const query = useDebouncedValue(text.trim(), SUGGEST_DELAY_MS);
  // 番號不查女優；選字中先留著上一批結果，選字確定才查。
  // 還要等 debounce 追上框裡的字：選字結束那一刻 query 還是選字前的假名，不擋會先白查一次
  const suggestable =
    query.length >= SUGGEST_MIN_CHARS && !joyuVideoCode(query);
  const suggest = useActressSuggest(
    query,
    suggestable && !composing && query === text.trim(),
  );
  const options = suggestable
    ? (suggest.data?.data.data ?? []).slice(0, SUGGEST_SIZE)
    : [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(joyuSearchPath(text));
  };
  const hero = variant === "hero";

  return (
    <Box
      component="form"
      role="search"
      onSubmit={submit}
      sx={{
        display: "flex",
        alignItems: "center",
        borderRadius: hero ? 2.5 : 2,
        overflow: "hidden",
        ...(hero
          ? { bgcolor: "#fff", maxWidth: 640 }
          : {
              bgcolor: "rgba(255,255,255,.08)",
              border: `1px solid ${joyuInk.line}`,
            }),
      }}
    >
      {!hero && (
        <SearchIcon sx={{ ml: 1, fontSize: 18, color: joyuInk.textMuted }} />
      )}
      {/* freeSolo：打的字本身就是合法輸入；沒選選項時 Enter 不攔，交給表單 submit */}
      <Autocomplete<Actress, false, false, true>
        freeSolo
        options={options}
        // 後端已經篩好，前端不再篩
        filterOptions={(o) => o}
        getOptionLabel={(o) => (typeof o === "string" ? o : o.name)}
        // 同名女優不能用名字當 key
        getOptionKey={(o) =>
          typeof o === "string" ? o : `${o.domain}-${o.aid}`
        }
        inputValue={text}
        // reset 是 MUI 選了選項後把框裡換成女優名字，不是使用者打的字；照收的話會多查一次那位的名字
        onInputChange={(_, value, reason) =>
          reason !== "reset" && setText(value)
        }
        onChange={(_, value) => {
          if (value && typeof value !== "string") {
            setText("");
            navigate(actressPagePath(value.name, value));
          }
        }}
        // 8 筆一次看完不用捲
        slotProps={{
          listbox: { sx: { maxHeight: "60vh" } },
          popper: { sx: { minWidth: 280 } },
        }}
        sx={{ flex: 1, minWidth: 0 }}
        renderOption={({ key, ...props }, a) => {
          const alias = matchedAlias(a, query);
          return (
            <Box component="li" {...props} key={key} sx={{ gap: 1.25 }}>
              <ActressPhoto
                alt={a.name}
                loading="lazy"
                src={a.photo}
                sx={{ borderRadius: 0.5, flexShrink: 0, width: 30 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography noWrap variant="body2">
                  <HighlightText keyword={query} text={a.name} />
                </Typography>
                {alias && (
                  <Typography color="text.secondary" noWrap variant="caption">
                    <HighlightText keyword={query} text={alias} />
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <InputBase
            ref={params.InputProps.ref}
            inputProps={{
              ...params.inputProps,
              "aria-label": "搜尋女優或番號",
              onCompositionStart: () => setComposing(true),
              onCompositionEnd: () => setComposing(false),
            }}
            placeholder={
              hero
                ? "輸入名字、別名，或直接貼番號（例：ABCD-123）"
                : "名字、別名或番號"
            }
            sx={{
              width: "100%",
              px: hero ? 2 : 1,
              py: hero ? 1.25 : 0.5,
              fontSize: 14,
              color: hero ? "#2a1f2c" : joyuInk.text,
            }}
          />
        )}
      />
      {hero && (
        <Button
          type="submit"
          variant="contained"
          disableElevation
          sx={{
            alignSelf: "stretch",
            borderRadius: 0,
            px: 3,
            fontWeight: 700,
            bgcolor: joyuInk.accent,
            "&:hover": { bgcolor: "#e84d7a" },
          }}
        >
          搜尋
        </Button>
      )}
    </Box>
  );
}
