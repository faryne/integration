import { useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EventIcon from "@mui/icons-material/Event";

export interface DailyPriceQuote {
  open: number;
  high: number;
  low: number;
  close: number;
}

const PRICE_LABELS: { key: keyof DailyPriceQuote; label: string }[] = [
  { key: "open", label: "開盤" },
  { key: "high", label: "最高" },
  { key: "low", label: "最低" },
  { key: "close", label: "收盤" },
];

interface PriceQueryPanelProps {
  currencyCode: string;
  selectedPrice: number;
  onFetchDailyPrice: (date: string) => Promise<DailyPriceQuote | null>;
  onSelectPrice: (price: number) => void;
}

// 讓使用者改用「選日期 -> 取得當天開高低收 -> 挑一個帶入當前股價」的方式輸入，
// 實際查價邏輯交由外部 callback 提供（不同 ETF 資料來源不同）。
export function PriceQueryPanel({
  currencyCode,
  selectedPrice,
  onFetchDailyPrice,
  onSelectPrice,
}: PriceQueryPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [queryDate, setQueryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<DailyPriceQuote | null>(null);

  const handleFetch = async () => {
    if (!queryDate) return;
    setLoading(true);
    setError("");
    setQuote(null);
    try {
      const result = await onFetchDailyPrice(queryDate);
      if (!result) {
        setError("查無當日價格資料");
      } else {
        setQuote(result);
      }
    } catch {
      setError("查詢失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={1}>
      <Button
        size="small"
        variant="text"
        startIcon={<EventIcon />}
        onClick={() => setExpanded((v) => !v)}
        sx={{ alignSelf: "flex-start" }}
      >
        依日期查詢當日股價
      </Button>
      <Collapse in={expanded}>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              type="date"
              label="查價日期"
              size="small"
              value={queryDate}
              onChange={(e) => setQueryDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={!queryDate || loading}
              onClick={handleFetch}
              startIcon={loading ? <CircularProgress size={14} /> : undefined}
            >
              查詢
            </Button>
          </Stack>
          {error && <Alert severity="warning">{error}</Alert>}
          {quote && (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                點選一個價格帶入「當前股價」：
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {PRICE_LABELS.map(({ key, label }) => (
                  <Chip
                    key={key}
                    label={`${label} ${currencyCode} ${quote[key]}`}
                    onClick={() => onSelectPrice(quote[key])}
                    color={selectedPrice === quote[key] ? "primary" : "default"}
                    variant={
                      selectedPrice === quote[key] ? "filled" : "outlined"
                    }
                  />
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}
