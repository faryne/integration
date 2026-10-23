import {
  Box,
  Checkbox,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useMemo, useState } from "react";

import { TalentAvatar } from "@/components/vtuber/TalentAvatar.tsx";
import { matchesTalent } from "@/components/vtuber/talentSearch.ts";
import type {
  VtuberBranch,
  VtuberChannelList,
  VtuberUnit,
} from "@/types/vtubers.ts";

const BRANCHES: VtuberBranch[] = ["JP", "EN", "ID", "DEV_IS"];
// 常數表裡沒有的新分組歸到這裡（後端會 warn 提醒補表）
const OTHER_UNIT: VtuberUnit = { slug: "", name: "其他", branch: "JP" };

interface TalentPanelProps {
  open: boolean;
  list: VtuberChannelList;
  currentHandle?: string;
  onClose: () => void;
}

/** 全部藝人面板：分頁是分部，裡面依期別分段；有搜尋字時跨分部顯示 */
export function TalentPanel({
  open,
  list,
  currentHandle,
  onClose,
}: TalentPanelProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [branch, setBranch] = useState<VtuberBranch>("JP");
  const [keyword, setKeyword] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);

  const unitBySlug = useMemo(
    () => new Map(list.units.map((unit) => [unit.slug, unit])),
    [list.units],
  );
  const unitOf = (slug: string) => unitBySlug.get(slug) ?? OTHER_UNIT;
  const visible = list.channels.filter(
    (c) =>
      (!liveOnly || c.is_live) &&
      matchesTalent(c, keyword, unitOf(c.unit_slug).name),
  );
  const inBranch = keyword
    ? visible
    : visible.filter((c) => unitOf(c.unit_slug).branch === branch);
  // 依常數表順序分段，「其他」放最後
  const sections = [...list.units, OTHER_UNIT]
    .map((unit) => ({
      unit,
      channels: inBranch.filter((c) => unitOf(c.unit_slug) === unit),
    }))
    .filter((s) => s.channels.length > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth={"md"}
      fullWidth
    >
      <Stack
        direction={"row"}
        spacing={1.5}
        useFlexGap
        alignItems={"center"}
        sx={{ pl: 2.5, pr: 7, pt: 2, flexWrap: "wrap" }}
      >
        <Typography variant={"h6"} fontWeight={800}>
          全部藝人
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              size={"small"}
              checked={liveOnly}
              onChange={(e) => setLiveOnly(e.target.checked)}
            />
          }
          label={"只看直播中"}
        />
        <TextField
          size={"small"}
          placeholder={"搜尋名稱或期別"}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          sx={{
            ml: { sm: "auto" },
            order: { xs: 3, sm: 0 },
            width: { xs: "100%", sm: 240 },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position={"start"}>
                  <SearchIcon fontSize={"small"} />
                </InputAdornment>
              ),
            },
          }}
        />
        {/* 固定在右上角，標題列換行時才不會被擠到第二行 */}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 12, right: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      <Tabs
        value={keyword ? false : branch}
        onChange={(_, value: VtuberBranch) => {
          setBranch(value);
          setKeyword("");
        }}
        variant={"scrollable"}
        sx={{ px: 2.5, borderBottom: 1, borderColor: "divider" }}
      >
        {BRANCHES.map((b) => (
          <Tab
            key={b}
            value={b}
            label={`${b} ${visible.filter((c) => unitOf(c.unit_slug).branch === b).length}`}
          />
        ))}
      </Tabs>
      <DialogContent>
        {sections.length === 0 ? (
          <Typography color={"text.secondary"} textAlign={"center"} py={3}>
            沒有符合的藝人
          </Typography>
        ) : (
          sections.map(({ unit, channels }) => (
            <Box key={unit.slug || "other"} sx={{ mb: 2 }}>
              <Typography
                variant={"body2"}
                fontWeight={700}
                color={"text.secondary"}
                sx={{ mb: 1 }}
              >
                {keyword && `${unit.branch}・`}
                {unit.name}（{channels.length}）
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
                  gap: "10px 6px",
                }}
              >
                {channels.map((c) => (
                  <TalentAvatar
                    key={c.channel_id}
                    channel={c}
                    current={c.handle === currentHandle}
                    onSelect={onClose}
                  />
                ))}
              </Box>
            </Box>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
