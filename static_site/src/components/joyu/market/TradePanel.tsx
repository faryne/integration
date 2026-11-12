import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import {
  marketTradeErrorMessage,
  useMarketQuote,
  useMarketTrade,
  type MarketStockDetail,
} from "@/apis/av/joyu_market.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { money } from "@/helpers/joyuMarket.ts";
import { useDebouncedValue } from "@/helpers/useDebouncedValue.ts";
import { trackEvent } from "@/lib/analytics.ts";

import { MarketLine } from "./MarketLine.tsx";
import { MarketLoginCta } from "./MarketLoginCta.tsx";
import { useMarketUid } from "./useMarketUid.ts";

const QUICK_SHARES = [10, 100, 1000];

/**
 * 個股頁的交易面板：選買或賣、輸入股數 → 停止輸入 300ms 後跟後端報價（金額、手續費、成交後股價、最多可買／賣）→ 送出。
 * 送出時帶報價的合計當 limit，價格在這中間被別人動了後端會拒單，報價會自動重抓。
 * 沒登入或匿名帳號：換成 Google 登入按鈕
 */
export function TradePanel({ stock }: { stock: MarketStockDetail }) {
  const { uid, loading } = useMarketUid();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [input, setInput] = useState("100");
  const shares = Math.max(0, Math.floor(Number(input) || 0));
  const debounced = useDebouncedValue(shares, 300);
  const quote = useMarketQuote(uid, stock.code, side, debounced);
  const trade = useMarketTrade();
  const [snack, setSnack] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  if (loading) return null;
  if (!uid) return <MarketLoginCta label="用 Google 登入後交易" title="交易" />;

  const q = quote.data;
  const max = q?.max_shares ?? 0;
  // 報價要對上目前輸入的股數才能送出（還在等報價或股數超過上限就不行）
  const ready =
    stock.status === "listed" &&
    !!q &&
    q.side === side &&
    q.shares === shares &&
    shares > 0 &&
    shares <= max &&
    !quote.isFetching;
  const buy = side === "buy";

  const submit = () =>
    q &&
    trade.mutate(
      { code: stock.code, limit: q.total_cents, shares, side },
      {
        onError: (e) =>
          setSnack({ ok: false, text: marketTradeErrorMessage(e) }),
        onSuccess: (r) => {
          setSnack({
            ok: true,
            text: `${buy ? "買進" : "賣出"} ${r.shares} 股，${buy ? "付款" : "入帳"} ${money(r.total)}`,
          });
          trackEvent("market_trade", { code: stock.code, shares, side });
        },
      },
    );

  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Typography
        component="h2"
        sx={{ fontSize: 17, fontWeight: 800, mb: 1.5 }}
      >
        交易
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        onChange={(_, v) => v && setSide(v)}
        size="small"
        sx={{ mb: 1.5 }}
        value={side}
      >
        <ToggleButton color="error" value="buy">
          買進
        </ToggleButton>
        <ToggleButton color="success" value="sell">
          賣出
        </ToggleButton>
      </ToggleButtonGroup>
      <TextField
        fullWidth
        onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
        size="small"
        slotProps={{
          htmlInput: { "aria-label": "股數", inputMode: "numeric" },
        }}
        value={input}
      />
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ my: 1.25 }}>
        {QUICK_SHARES.map((n) => (
          <Chip
            key={n}
            label={n}
            onClick={() => setInput(String(n))}
            size="small"
          />
        ))}
        <Chip
          disabled={!q}
          label={`${buy ? "最多" : "全部"} ${max.toLocaleString()}`}
          onClick={() => setInput(String(max))}
          size="small"
        />
      </Stack>
      <MarketLine
        label="成交金額"
        value={q && shares ? money(q.amount) : "—"}
      />
      <MarketLine label="手續費 1%" value={q && shares ? money(q.fee) : "—"} />
      <MarketLine
        label={buy ? "買完後股價" : "賣完後股價"}
        value={q && shares ? money(q.price_after) : "—"}
      />
      <Box sx={{ borderTop: 1, borderColor: "divider", mt: 0.5, pt: 0.5 }}>
        <MarketLine
          bold
          label={buy ? "付款" : "入帳"}
          value={q && shares ? money(q.total) : "—"}
        />
      </Box>
      <Button
        color={buy ? "error" : "success"}
        disabled={!ready || trade.isPending}
        fullWidth
        onClick={submit}
        sx={{ mt: 1.5 }}
        variant="contained"
      >
        {buy ? "買進" : "賣出"}
      </Button>
      <CustomSnackbar
        message={snack?.text ?? ""}
        onClose={() => setSnack(null)}
        open={!!snack}
        severity={snack?.ok ? "success" : "error"}
      />
    </Paper>
  );
}
