import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import type {
  ActressTopicConditions,
  ActressTopicOptions,
} from "@/types/avActressTopic.ts";
import {
  TOPIC_BLOOD_TYPES,
  TOPIC_CUPS,
  TOPIC_HOROSCOPES,
  TOPIC_RANGE_FIELDS,
} from "@/data/avActressTopicAdmin.ts";
import { ActressTopicOptionAutocomplete } from "@/components/av/actress_topic_option_autocomplete.tsx";

type Range = [number, number];

/** 空字串或非正整數都當 0（＝不限） */
const toNumber = (v: string) => Math.max(parseInt(v, 10) || 0, 0);

/** 一列：左邊標籤、右邊輸入；手機改成上下排 */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", sm: "88px minmax(0, 1fr)" },
      }}
    >
      <Typography color="text.secondary" sx={{ pt: { sm: 1 } }} variant="body2">
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

/**
 * 自訂主題的條件編輯：同一欄位內多選是 OR，不同欄位之間是 AND；空白代表不限。
 * 出身地、類型用 facet 自動完成（options 來自後端），其他是 chip 複選或最小／最大值
 */
export function ActressTopicConditionForm({
  value: c,
  onChange,
  options,
  optionsLoading,
}: {
  value: ActressTopicConditions;
  onChange: (value: ActressTopicConditions) => void;
  options?: ActressTopicOptions;
  optionsLoading?: boolean;
}) {
  const set = (patch: Partial<ActressTopicConditions>) =>
    onChange({ ...c, ...patch });
  const toggle = (list: string[] | undefined, v: string) =>
    list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  const genres = c.genres ?? [];

  return (
    <Stack spacing={2}>
      <Row label="星座">
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {TOPIC_HOROSCOPES.map((h) => (
            <Chip
              clickable
              color={c.horoscope?.includes(h.slug) ? "primary" : "default"}
              key={h.slug}
              label={h.label}
              onClick={() => set({ horoscope: toggle(c.horoscope, h.slug) })}
              size="small"
              variant={c.horoscope?.includes(h.slug) ? "filled" : "outlined"}
            />
          ))}
        </Stack>
      </Row>
      <Row label="血型">
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {TOPIC_BLOOD_TYPES.map((b) => (
            <Chip
              clickable
              color={c.blood?.includes(b) ? "primary" : "default"}
              key={b}
              label={`${b} 型`}
              onClick={() => set({ blood: toggle(c.blood, b) })}
              size="small"
              variant={c.blood?.includes(b) ? "filled" : "outlined"}
            />
          ))}
        </Stack>
      </Row>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
        }}
      >
        {TOPIC_RANGE_FIELDS.map((f) => {
          const range = (c[f.key] ?? [0, 0]) as Range;
          const update = (i: 0 | 1, v: string) => {
            const next: Range = [...range];
            next[i] = toNumber(v);
            set({ [f.key]: next });
          };
          return (
            <Row
              key={f.key}
              label={f.unit ? `${f.label}（${f.unit}）` : f.label}
            >
              <Stack direction="row" gap={1} sx={{ alignItems: "center" }}>
                <TextField
                  onChange={(e) => update(0, e.target.value)}
                  placeholder="最小"
                  size="small"
                  type="number"
                  value={range[0] || ""}
                />
                <Typography color="text.secondary">～</Typography>
                <TextField
                  onChange={(e) => update(1, e.target.value)}
                  placeholder="最大"
                  size="small"
                  type="number"
                  value={range[1] || ""}
                />
              </Stack>
            </Row>
          );
        })}
        <Row label="罩杯">
          <Stack direction="row" gap={1} sx={{ alignItems: "center" }}>
            {([0, 1] as const).map((i) => (
              <TextField
                fullWidth
                key={i}
                onChange={(e) => {
                  const next: [string, string] = [...(c.cup ?? ["", ""])];
                  next[i] = e.target.value;
                  set({ cup: next });
                }}
                select
                size="small"
                // 空字串（不限）也要顯示選項文字
                slotProps={{ select: { displayEmpty: true } }}
                value={c.cup?.[i] ?? ""}
              >
                <MenuItem value="">不限</MenuItem>
                {TOPIC_CUPS.map((cup) => (
                  <MenuItem key={cup} value={cup}>
                    {cup}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
        </Row>
      </Box>

      <Row label="出身地">
        <ActressTopicOptionAutocomplete
          label="輸入都道府県"
          loading={optionsLoading}
          multiple
          onChange={(v) => set({ born_city: v })}
          options={options?.born_cities}
          unit="位"
          value={c.born_city ?? []}
        />
      </Row>
      <Row label="類型">
        <Stack spacing={1}>
          {genres.map((g, i) => (
            <Stack
              direction="row"
              gap={1}
              key={i}
              sx={{ alignItems: "center" }}
            >
              <ActressTopicOptionAutocomplete
                label="輸入類型"
                loading={optionsLoading}
                onChange={(v) =>
                  set({
                    genres: genres.map((x, j) =>
                      j === i ? { ...x, tag: v[0] ?? "" } : x,
                    ),
                  })
                }
                options={options?.tags}
                unit="部"
                value={g.tag ? [g.tag] : []}
              />
              <Typography color="text.secondary" variant="body2">
                至少
              </Typography>
              <TextField
                onChange={(e) =>
                  set({
                    genres: genres.map((x, j) =>
                      j === i ? { ...x, min: toNumber(e.target.value) } : x,
                    ),
                  })
                }
                size="small"
                sx={{ width: 72 }}
                type="number"
                value={g.min || ""}
              />
              <Typography color="text.secondary" variant="body2">
                部
              </Typography>
              <IconButton
                aria-label="移除類型條件"
                onClick={() =>
                  set({ genres: genres.filter((_, j) => j !== i) })
                }
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Button
            onClick={() => set({ genres: [...genres, { tag: "", min: 1 }] })}
            size="small"
            startIcon={<AddIcon />}
            sx={{ alignSelf: "flex-start" }}
            variant="outlined"
          >
            類型條件
          </Button>
        </Stack>
      </Row>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        {(
          [
            ["debut_within_months", "出道在幾個月內"],
            ["active_within_months", "最後出演在幾個月內"],
            ["min_videos", "總出演數至少"],
          ] as const
        ).map(([key, label]) => (
          <TextField
            key={key}
            label={label}
            onChange={(e) => set({ [key]: toNumber(e.target.value) })}
            placeholder="不限"
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            type="number"
            value={c[key] || ""}
          />
        ))}
      </Box>
    </Stack>
  );
}
