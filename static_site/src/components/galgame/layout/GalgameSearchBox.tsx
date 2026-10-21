import SearchIcon from "@mui/icons-material/Search";
import { Box, IconButton, InputBase } from "@mui/material";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import { galgamePath } from "@/helpers/galgame.ts";

/** 單一搜尋框：同時搜品牌與影片，結果呈現在首頁的 ?keyword= 搜尋結果 */
export function GalgameSearchBox() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const keyword = params.get("keyword") ?? "";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(
      new FormData(event.currentTarget).get("keyword") ?? "",
    ).trim();
    navigate(
      value
        ? `${galgamePath()}?keyword=${encodeURIComponent(value)}`
        : galgamePath(),
    );
  };

  return (
    <Box
      component="form"
      role="search"
      onSubmit={submit}
      sx={{ flex: 1, width: "100%", maxWidth: 520, mx: "auto" }}
    >
      <InputBase
        // 網址上的關鍵字變了（點標籤、上一頁）就重建輸入框，讓預設值跟著同步
        key={keyword}
        name="keyword"
        defaultValue={keyword}
        placeholder={t("galgame.layout.search.placeholder")}
        inputProps={{ "aria-label": t("galgame.layout.search.placeholder") }}
        startAdornment={
          <IconButton
            type="submit"
            size="small"
            edge="start"
            aria-label={t("galgame.layout.search.submit")}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
        }
        sx={{
          width: "100%",
          height: 40,
          px: 1.5,
          gap: 0.5,
          borderRadius: 999,
          border: 1,
          borderColor: "divider",
          bgcolor: "action.hover",
          fontSize: 14,
        }}
      />
    </Box>
  );
}
