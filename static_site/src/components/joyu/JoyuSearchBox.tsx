import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, InputBase } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { joyuSearchPath } from "@/helpers/joyu.ts";

import { joyuInk } from "./joyuTheme.ts";

/**
 * joyu 的統一搜尋框（頁首、首頁主視覺共用）：番號直接到影片頁，其他當名字到女優搜尋（規則見 helpers/joyu.ts）。
 * header：深紫頁首裡的小輸入框；hero：首頁主視覺的大輸入框加搜尋鈕
 */
export function JoyuSearchBox({ variant }: { variant: "header" | "hero" }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
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
      <InputBase
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          hero
            ? "輸入名字、別名，或直接貼番號（例：ABCD-123）"
            : "名字、別名或番號"
        }
        inputProps={{ "aria-label": "搜尋女優或番號" }}
        sx={{
          flex: 1,
          px: hero ? 2 : 1,
          py: hero ? 1.25 : 0.5,
          fontSize: 14,
          color: hero ? "#2a1f2c" : joyuInk.text,
        }}
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
