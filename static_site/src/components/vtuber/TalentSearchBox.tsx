import {
  Autocomplete,
  Box,
  Chip,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useVtuberChannelSearch } from "@/apis/opendata/vtubers.ts";
import { HighlightText } from "@/components/common/HighlightText.tsx";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import { talentPath } from "@/components/vtuber/routes.ts";
import { useDebouncedValue } from "@/helpers/useDebouncedValue.ts";
import type { VtuberChannelSearchItem, VtuberUnit } from "@/types/vtubers.ts";

interface TalentSearchBoxProps {
  units: VtuberUnit[];
  onError?: (error: unknown) => void;
}

/**
 * 「搜尋藝人」輸入框：停止打字 300ms 後查 DB（名稱、@handle、期別、頻道說明），選了就到藝人頁。
 * 命中在頻道說明時，選項多一行說明片段並標出命中處
 */
export function TalentSearchBox({ units, onError }: TalentSearchBoxProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const keyword = useDebouncedValue(input.trim());
  const search = useVtuberChannelSearch(keyword);
  const unitName = (slug: string) =>
    units.find((u) => u.slug === slug)?.name ?? "";

  useEffect(() => {
    if (search.error) onError?.(search.error);
  }, [search.error, onError]);

  return (
    <Autocomplete<VtuberChannelSearchItem>
      size={"small"}
      options={input.trim() ? (search.data ?? []) : []}
      getOptionLabel={(c) => c.title}
      // 後端已經篩好，前端不再篩
      filterOptions={(options) => options}
      inputValue={input}
      onInputChange={(_, value) => setInput(value)}
      onChange={(_, channel) => channel && navigate(talentPath(channel.handle))}
      value={null}
      blurOnSelect
      clearOnBlur
      loading={search.isFetching && !search.data}
      loadingText={"搜尋中"}
      noOptionsText={"沒有符合的藝人"}
      popupIcon={null}
      sx={{ flex: 1, minWidth: { sm: 240 } }}
      renderOption={({ key, ...props }, c) => (
        <Box
          component={"li"}
          key={key}
          {...props}
          sx={{ gap: 1.25, alignItems: "flex-start !important" }}
        >
          <ChannelAvatar
            src={c.thumbnail_url}
            sx={{ width: 28, height: 28, mt: 0.25 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant={"body2"} noWrap sx={{ flex: 1 }}>
                <HighlightText text={c.title} keyword={keyword} />
              </Typography>
              {c.is_live && (
                <Chip label={"LIVE"} color={"error"} size={"small"} />
              )}
              <Typography variant={"caption"} color={"text.secondary"} noWrap>
                <HighlightText text={unitName(c.unit_slug)} keyword={keyword} />
              </Typography>
            </Box>
            {c.description_snippet && (
              <Typography
                variant={"caption"}
                color={"text.secondary"}
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  lineHeight: 1.5,
                }}
              >
                <HighlightText text={c.description_snippet} keyword={keyword} />
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={"搜尋藝人"}
          slotProps={{
            input: {
              ...params.InputProps,
              startAdornment: (
                <InputAdornment position={"start"}>
                  <SearchIcon fontSize={"small"} />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}
