import {
  Autocomplete,
  Box,
  Button,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { TalentAvatar } from "@/components/vtuber/TalentAvatar.tsx";
import { TalentPanel } from "@/components/vtuber/TalentPanel.tsx";
import { talentPath } from "@/components/vtuber/routes.ts";
import { matchesTalent } from "@/components/vtuber/talentSearch.ts";
import { ChannelAvatar } from "@/components/vtuber/ChannelAvatar.tsx";
import type {
  VtuberChannelList,
  VtuberChannelSummary,
} from "@/types/vtubers.ts";

interface TalentPickerProps {
  list: VtuberChannelList;
  currentHandle?: string;
}

/** 藝人選擇列：搜尋＋全部藝人面板＋正在直播的頭像；藝人再多也只佔一列 */
export function TalentPicker({ list, currentHandle }: TalentPickerProps) {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(false);
  const unitName = (slug: string) =>
    list.units.find((u) => u.slug === slug)?.name ?? "";
  const live = list.channels.filter((c) => c.is_live);

  return (
    <Paper
      variant={"outlined"}
      sx={{
        px: 1.75,
        py: 1.25,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "10px 16px",
      }}
    >
      <Stack
        direction={"row"}
        spacing={1}
        sx={{ width: { xs: "100%", sm: "auto" } }}
      >
        <Autocomplete<VtuberChannelSummary>
          size={"small"}
          options={list.channels}
          getOptionLabel={(c) => c.title}
          filterOptions={(options, { inputValue }) =>
            inputValue
              ? options
                  .filter((c) =>
                    matchesTalent(c, inputValue, unitName(c.unit_slug)),
                  )
                  .slice(0, 8)
              : []
          }
          onChange={(_, channel) =>
            channel && navigate(talentPath(channel.handle))
          }
          value={null}
          blurOnSelect
          clearOnBlur
          noOptionsText={"沒有符合的藝人"}
          popupIcon={null}
          sx={{ flex: 1, minWidth: { sm: 240 } }}
          renderOption={({ key, ...props }, c) => (
            <Box component={"li"} key={key} {...props} sx={{ gap: 1.25 }}>
              <ChannelAvatar
                src={c.thumbnail_url}
                sx={{ width: 28, height: 28 }}
              />
              <Typography variant={"body2"} noWrap sx={{ flex: 1 }}>
                {c.title}
              </Typography>
              {c.is_live && (
                <Chip label={"LIVE"} color={"error"} size={"small"} />
              )}
              <Typography variant={"caption"} color={"text.secondary"}>
                {unitName(c.unit_slug)}
              </Typography>
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
        <Button
          variant={"outlined"}
          startIcon={<MenuIcon />}
          onClick={() => setPanelOpen(true)}
          sx={{ flexShrink: 0 }}
        >
          全部藝人 {list.channels.length}
        </Button>
      </Stack>
      {live.length > 0 && (
        <Stack
          direction={"row"}
          spacing={1.25}
          alignItems={"center"}
          sx={{ flex: "1 1 260px", minWidth: 0 }}
        >
          <Typography
            variant={"body2"}
            fontWeight={700}
            color={"error"}
            sx={{ whiteSpace: "nowrap" }}
          >
            ● 直播中
          </Typography>
          <Stack
            direction={"row"}
            spacing={1}
            sx={{ overflowX: "auto", py: 0.5, px: 0.25 }}
          >
            {live.map((c) => (
              <TalentAvatar
                key={c.channel_id}
                channel={c}
                size={38}
                showName={false}
                current={c.handle === currentHandle}
              />
            ))}
          </Stack>
        </Stack>
      )}
      <TalentPanel
        open={panelOpen}
        list={list}
        currentHandle={currentHandle}
        onClose={() => setPanelOpen(false)}
      />
    </Paper>
  );
}
