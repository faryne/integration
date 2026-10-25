import { Button, Paper, Stack, Typography } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useState } from "react";

import { TalentAvatar } from "@/components/vtuber/TalentAvatar.tsx";
import { TalentPanel } from "@/components/vtuber/TalentPanel.tsx";
import { TalentSearchBox } from "@/components/vtuber/TalentSearchBox.tsx";
import type { VtuberChannelList } from "@/types/vtubers.ts";

interface TalentPickerProps {
  list: VtuberChannelList;
  currentHandle?: string;
  onError?: (error: unknown) => void; // 搜尋 API 出錯時跳 snack
}

/** 藝人選擇列：搜尋＋全部藝人面板＋正在直播的頭像；藝人再多也只佔一列 */
export function TalentPicker({
  list,
  currentHandle,
  onError,
}: TalentPickerProps) {
  const [panelOpen, setPanelOpen] = useState(false);
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
        <TalentSearchBox units={list.units} onError={onError} />
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
