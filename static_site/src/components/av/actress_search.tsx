import type { ActressSearchRequest } from "@/apis/av/actress_search";
import {
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SearchIcon from "@mui/icons-material/Search";

export interface IActressSearch {
  onClick: (input: ActressSearchRequest) => void;
  conditions?: ActressSearchRequest;
}

type RangeKey = "height" | "b" | "w" | "h";

const cupOptions = [
  "AAA",
  "AA",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
];
const rangeLimits: Record<RangeKey, number> = {
  height: 250,
  b: 200,
  w: 200,
  h: 200,
};

export function ActressSearch(props: IActressSearch) {
  const [req, setReq] = useState<ActressSearchRequest>({
    page: 1,
  });

  useEffect(() => {
    if (props.conditions) {
      setReq({ ...props.conditions, page: props.conditions.page ?? 1 });
    }
  }, [props.conditions]);

  const clearRange = (key: RangeKey) => {
    setReq((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateRangeBoundary = (
    key: RangeKey,
    side: "min" | "max",
    input: string,
  ) => {
    setReq((current) => {
      const next = { ...current };
      const currentValue = next[key] ?? [0, 0];
      const rawValue = input === "" ? 0 : parseInt(input, 10);

      if (Number.isNaN(rawValue)) {
        return current;
      }

      const parsedValue = Math.min(Math.max(rawValue, 0), rangeLimits[key]);
      const range: [number, number] = [
        side === "min" ? parsedValue : currentValue[0],
        side === "max" ? parsedValue : currentValue[1],
      ];

      if (range[0] <= 0 && range[1] <= 0) {
        delete next[key];
        return next;
      }

      if (range[0] > 0 && range[1] > 0 && range[0] > range[1]) {
        if (side === "min") {
          range[1] = range[0];
        } else {
          range[0] = range[1];
        }
      }

      next[key] = range;
      return next;
    });
  };

  const setRange = (key: RangeKey, value: [number, number]) => {
    setReq((current) => ({
      ...current,
      [key]: value.map((v) => Math.min(Math.max(v, 0), rangeLimits[key])),
    }));
  };

  const rangeText = (value: number[] | undefined, unit: string) => {
    if (!value) {
      return "不限";
    }

    const [min, max] = value;
    if (min > 0 && max > 0) {
      return `${min}~${max}${unit}`;
    }
    if (min > 0) {
      return `${min}${unit}以上`;
    }
    return `${max}${unit}以下`;
  };

  const renderRangeInputs = (
    label: string,
    key: RangeKey,
    value: number[] | undefined,
    unit: string,
    presets?: Array<{ label: string; value: [number, number] }>,
  ) => (
    <Stack spacing={1}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography color="text.secondary" fontWeight={700} variant="body2">
          {label}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography color="text.secondary" variant="caption">
            {rangeText(value, unit)}
          </Typography>
          {value && (
            <IconButton
              aria-label={`清除${label}條件`}
              onClick={() => clearRange(key)}
              size="small"
            >
              <RemoveCircleOutlineIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          fullWidth
          label="最小"
          onChange={(e) => updateRangeBoundary(key, "min", e.target.value)}
          size="small"
          slotProps={{
            htmlInput: { min: 0, max: rangeLimits[key], inputMode: "numeric" },
            input: { endAdornment: unit },
          }}
          type="number"
          value={value?.[0] && value[0] > 0 ? value[0] : ""}
        />
        <TextField
          fullWidth
          label="最大"
          onChange={(e) => updateRangeBoundary(key, "max", e.target.value)}
          size="small"
          slotProps={{
            htmlInput: { min: 0, max: rangeLimits[key], inputMode: "numeric" },
            input: { endAdornment: unit },
          }}
          type="number"
          value={value?.[1] && value[1] > 0 ? value[1] : ""}
        />
      </Stack>
      {presets && (
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {presets.map((preset) => (
            <Chip
              clickable
              key={preset.label}
              label={preset.label}
              onClick={() => setRange(key, preset.value)}
              size="small"
              sx={{ borderRadius: 1 }}
              variant={
                value?.[0] === preset.value[0] && value?.[1] === preset.value[1]
                  ? "filled"
                  : "outlined"
              }
            />
          ))}
        </Stack>
      )}
    </Stack>
  );

  const setCup = (cup: string) => {
    setReq((current) => {
      const next = { ...current };
      if (next.cup === cup || cup === "") {
        delete next.cup;
        return next;
      }

      next.cup = cup;
      return next;
    });
  };

  const handleSubmit = () => {
    const next = { ...req };
    next.name = next.name?.trim();
    next.cup = next.cup?.trim().toUpperCase();

    if (!next.name) {
      delete next.name;
    }
    if (!next.cup) {
      delete next.cup;
    }
    (["height", "b", "w", "h"] as RangeKey[]).forEach((key) => {
      const range = next[key];
      if (!range || range.every((value) => value <= 0)) {
        delete next[key];
      }
    });
    props.onClick(next);
  };

  const heightPresets = [
    { label: "150~160", value: [150, 160] as [number, number] },
    { label: "160~170", value: [160, 170] as [number, number] },
    { label: "170~180", value: [170, 180] as [number, number] },
  ];

  const bodyPresets = [
    { label: "80~90", value: [80, 90] as [number, number] },
    { label: "90~100", value: [90, 100] as [number, number] },
  ];

  return (
    <Stack direction={"column"} spacing={2.5}>
      <Stack direction={"column"} spacing={1.5}>
        <TextField
          label={"關鍵字"}
          variant={"outlined"}
          value={req.name ?? ""}
          onChange={(e) => {
            setReq((o) => ({ ...o, name: e.target.value }));
          }}
          size="small"
        />
        <Stack spacing={1}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography color="text.secondary" fontWeight={700} variant="body2">
              罩杯
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {req.cup ? `${req.cup} Cup` : "不限"}
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {cupOptions.map((cup) => (
              <Chip
                clickable
                key={cup}
                label={cup}
                onClick={() => setCup(cup)}
                size="small"
                sx={{ borderRadius: 1, minWidth: 36 }}
                variant={req.cup === cup ? "filled" : "outlined"}
              />
            ))}
            {req.cup && !cupOptions.includes(req.cup) && (
              <Chip
                clickable
                label={req.cup}
                onClick={() => setCup(req.cup ?? "")}
                size="small"
                sx={{ borderRadius: 1 }}
              />
            )}
          </Stack>
          <TextField
            label="自訂罩杯"
            onChange={(e) => setCup(e.target.value.trim().toUpperCase())}
            size="small"
            value={req.cup && !cupOptions.includes(req.cup) ? req.cup : ""}
          />
        </Stack>
        <TextField
          type={"number"}
          aria-valuemin={0}
          aria-valuemax={2100}
          label={"出生年份"}
          variant={"outlined"}
          value={req.birth_year ?? ""}
          onChange={(e) => {
            setReq((o) => {
              const next = { ...o };
              if (e.target.value === "") {
                delete next.birth_year;
                return next;
              }

              const birthYear = parseInt(e.target.value, 10);
              if (!isNaN(birthYear)) {
                return {
                  ...next,
                  birth_year: Math.max(birthYear, 0),
                };
              }
              return o;
            });
          }}
          size="small"
        />
      </Stack>
      {renderRangeInputs("身高", "height", req.height, "cm", heightPresets)}
      {renderRangeInputs("胸圍", "b", req.b, "cm", bodyPresets)}
      {renderRangeInputs("腰圍", "w", req.w, "cm")}
      {renderRangeInputs("臀圍", "h", req.h, "cm", bodyPresets)}

      <Button
        onClick={handleSubmit}
        startIcon={<SearchIcon />}
        sx={{ borderRadius: 1.5 }}
        variant={"contained"}
      >
        搜尋
      </Button>
    </Stack>
  );
}
