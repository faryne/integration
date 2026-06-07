import { Button, Paper, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { useEffect, useState } from "react";
import { ChipRadioGroup } from "./ChipRadioGroup.tsx";

export interface NekomaidSearchFormValue {
  site: string;
  tag: string;
  rating: string;
  type: string;
  wallpaper: string;
  minWidth: string;
}

export function SearchPanel({
  site,
  tag,
  rating,
  type,
  wallpaper,
  minWidth,
  onSearch,
}: NekomaidSearchFormValue & {
  onSearch: (next: NekomaidSearchFormValue) => void;
}) {
  const [draft, setDraft] = useState({
    site,
    tag,
    rating,
    type,
    wallpaper,
    minWidth,
  });

  useEffect(() => {
    setDraft({ site, tag, rating, type, wallpaper, minWidth });
  }, [minWidth, rating, site, tag, type, wallpaper]);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
      <Stack spacing={2}>
        <Typography fontWeight={900} variant="h6">
          搜尋條件
        </Typography>
        <TextField
          label="Tag"
          value={draft.tag}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, tag: event.target.value }))
          }
        />
        <ChipRadioGroup
          label="來源"
          value={draft.site}
          options={[
            { label: "全部", value: "" },
            { label: "Pixiv", value: "pixiv" },
            { label: "Niconico 靜畫", value: "nico" },
            { label: "TINAMI", value: "tinami" },
          ]}
          onChange={(value) => setDraft((prev) => ({ ...prev, site: value }))}
        />
        <ChipRadioGroup
          label="分級"
          value={draft.rating}
          options={[
            { label: "不分級", value: "1" },
            { label: "全年齡向", value: "2" },
            { label: "R18", value: "3" },
          ]}
          onChange={(value) => setDraft((prev) => ({ ...prev, rating: value }))}
        />
        <ChipRadioGroup
          label="作品型態"
          value={draft.type}
          options={[
            { label: "全部", value: "" },
            { label: "插畫", value: "illust" },
            { label: "漫畫", value: "manga" },
            { label: "動圖", value: "ugoira" },
          ]}
          onChange={(value) => setDraft((prev) => ({ ...prev, type: value }))}
        />
        <ChipRadioGroup
          label="桌布比例"
          value={draft.wallpaper}
          options={[
            { label: "全部", value: "" },
            { label: "16:10", value: "16:10" },
            { label: "16:9", value: "16:9" },
            { label: "4:3", value: "4:3" },
          ]}
          onChange={(value) =>
            setDraft((prev) => ({ ...prev, wallpaper: value }))
          }
        />
        <TextField
          label="最小寬度"
          type="number"
          value={draft.minWidth}
          slotProps={{ htmlInput: { min: 0, step: 1 } }}
          helperText="搭配桌布比例篩選，單位 px。"
          onChange={(event) =>
            setDraft((prev) => ({
              ...prev,
              minWidth: event.target.value.replace(/[^\d]/g, ""),
            }))
          }
        />
        <Button
          startIcon={<SearchIcon />}
          variant="contained"
          onClick={() => onSearch({ ...draft, tag: draft.tag.trim() })}
        >
          搜尋
        </Button>
      </Stack>
    </Paper>
  );
}
