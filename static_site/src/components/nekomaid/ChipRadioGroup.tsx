import { Chip, Stack, Typography } from "@mui/material";

export function ChipRadioGroup({
  disabled = false,
  label,
  value,
  options,
  onChange,
}: {
  disabled?: boolean;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Stack spacing={1}>
      <Typography color="text.secondary" fontWeight={800} variant="body2">
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Chip
              key={`${label}-${option.value || "all"}`}
              label={option.label}
              clickable={!disabled}
              color={selected ? "primary" : "default"}
              disabled={disabled}
              variant={selected ? "filled" : "outlined"}
              onClick={() => {
                if (!disabled) {
                  onChange(option.value);
                }
              }}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
