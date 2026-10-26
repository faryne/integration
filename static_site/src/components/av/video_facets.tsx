import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { VideoFacetBucket, VideoFacets } from "@/apis/av/video_facets.ts";

const VISIBLE_COUNT = 8;

// 統計欄位 → 搜尋參數；標籤可複選，其餘單選
export type FacetParam = "tag" | "maker" | "series" | "actress";
const GROUPS: { key: keyof VideoFacets; param: FacetParam; title: string }[] = [
  { key: "tags", param: "tag", title: "標籤" },
  { key: "makers", param: "maker", title: "發售商" },
  { key: "series", param: "series", title: "系列" },
  { key: "actresses", param: "actress", title: "出演" },
];

/**
 * 搜尋頁的「篩選」：依目前條件統計常見值，點一下加入條件、已選的再點一次取消。
 * 手機上面板在結果上方，預設收合避免把結果推得太下面
 */
export function VideoFacetsPanel({
  facets,
  isSelected,
  onToggle,
}: {
  facets: VideoFacets;
  isSelected: (param: FacetParam, value: string) => boolean;
  onToggle: (param: FacetParam, value: string) => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(!isMobile);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const groups = GROUPS.filter((g) => facets[g.key].length > 0);
  if (groups.length === 0) return null;

  return (
    <Box>
      <Button
        color="inherit"
        endIcon={
          <ExpandMoreIcon
            sx={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 160ms",
            }}
          />
        }
        onClick={() => setOpen((v) => !v)}
        sx={{
          fontWeight: 800,
          justifyContent: "space-between",
          px: 0,
          width: "100%",
        }}
      >
        篩選
      </Button>
      <Collapse in={open}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {groups.map((g) => (
            <FacetGroup
              key={g.key}
              buckets={facets[g.key]}
              expanded={!!expanded[g.key]}
              isSelected={(value) => isSelected(g.param, value)}
              onExpand={() =>
                setExpanded((e) => ({ ...e, [g.key]: !e[g.key] }))
              }
              onToggle={(value) => onToggle(g.param, value)}
              title={g.title}
            />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}

function FacetGroup({
  buckets,
  expanded,
  isSelected,
  onExpand,
  onToggle,
  title,
}: {
  buckets: VideoFacetBucket[];
  expanded: boolean;
  isSelected: (value: string) => boolean;
  onExpand: () => void;
  onToggle: (value: string) => void;
  title: string;
}) {
  const visible = expanded ? buckets : buckets.slice(0, VISIBLE_COUNT);
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
        <Typography color="text.secondary" fontWeight={700} variant="body2">
          {title}
        </Typography>
        {buckets.length > VISIBLE_COUNT && (
          <Typography
            component="button"
            onClick={onExpand}
            sx={{
              bgcolor: "transparent",
              border: 0,
              color: "primary.main",
              cursor: "pointer",
              fontSize: 12,
              p: 0,
            }}
          >
            {expanded ? "收合" : "更多"}
          </Typography>
        )}
      </Stack>
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {visible.map((b) => {
          const selected = isSelected(b.value);
          return (
            <Chip
              key={b.value}
              clickable
              color={selected ? "primary" : "default"}
              label={
                <>
                  {b.value}
                  <Box
                    component="span"
                    sx={{ ml: 0.5, opacity: 0.7, fontSize: 11 }}
                  >
                    {b.count.toLocaleString()}
                  </Box>
                </>
              }
              onClick={() => onToggle(b.value)}
              size="small"
              sx={{ borderRadius: 1.5 }}
              variant={selected ? "filled" : "outlined"}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
