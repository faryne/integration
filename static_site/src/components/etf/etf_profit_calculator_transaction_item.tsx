import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  emptySellEvent,
  type SellEvent,
  type Transaction,
} from "@/components/etf/etf_profit_calculator_types.ts";

interface TransactionAccordionItemProps {
  record: Transaction;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<Transaction>) => void;
  onDelete: () => void;
}

function summarize(record: Transaction) {
  const buyDate = record.buyDate || "未設定日期";
  const shares = record.buyShares || 0;
  const price = record.buyPrice || 0;
  const soldShares = record.sells.reduce(
    (sum, s) => sum + (s.sellShares || 0),
    0,
  );
  const remaining = shares - soldShares;

  let text = `${buyDate} 購入 ${shares.toLocaleString()} 股 @ ${price}`;
  if (record.sells.length > 0) {
    text += ` · 已賣出 ${record.sells.length} 筆 (${soldShares.toLocaleString()} 股) · 剩餘 ${remaining.toLocaleString()} 股`;
  }
  return text;
}

// 單一購入批次：可展開/收合，內含可分好幾次賣出的紀錄
export function TransactionAccordionItem({
  record,
  expanded,
  onToggleExpanded,
  onChange,
  onDelete,
}: TransactionAccordionItemProps) {
  const updateSell = (sellId: string, patch: Partial<SellEvent>) => {
    onChange({
      sells: record.sells.map((s) =>
        s.id === sellId ? { ...s, ...patch } : s,
      ),
    });
  };

  const removeSell = (sellId: string) => {
    onChange({ sells: record.sells.filter((s) => s.id !== sellId) });
  };

  const addSell = () => {
    onChange({
      sells: [...record.sells, emptySellEvent(Date.now().toString())],
    });
  };

  return (
    <Accordion
      expanded={expanded}
      onChange={onToggleExpanded}
      sx={{ mb: 1, "&:before": { display: "none" } }}
      variant="outlined"
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ width: "100%", pr: 1 }}
        >
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            noWrap
          >
            {summarize(record)}
          </Typography>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
          >
            <TextField
              type="date"
              label="購入日期"
              size="small"
              value={record.buyDate}
              onChange={(e) => onChange({ buyDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 180 }}
            />
            <TextField
              label="原始股數"
              type="number"
              size="small"
              value={record.buyShares || ""}
              onChange={(e) => onChange({ buyShares: Number(e.target.value) })}
            />
            <TextField
              label="購入單價"
              type="number"
              size="small"
              value={record.buyPrice || ""}
              onChange={(e) => onChange({ buyPrice: Number(e.target.value) })}
            />
          </Stack>

          {record.sells.map((sell, sellIndex) => (
            <Stack
              key={sell.id}
              direction="row"
              spacing={2}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ pl: 4, py: 1, borderLeft: "3px solid #ffc107" }}
            >
              <Typography
                variant="body2"
                color="warning.main"
                fontWeight="bold"
              >
                ↳ 賣出 {sellIndex + 1}：
              </Typography>
              <TextField
                type="date"
                label="賣出日期"
                size="small"
                value={sell.sellDate}
                onChange={(e) =>
                  updateSell(sell.id, { sellDate: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                sx={{ width: 180 }}
              />
              <TextField
                label="賣出股數"
                type="number"
                size="small"
                value={sell.sellShares || ""}
                onChange={(e) =>
                  updateSell(sell.id, { sellShares: Number(e.target.value) })
                }
              />
              <TextField
                label="賣出價格"
                type="number"
                size="small"
                value={sell.sellPrice || ""}
                onChange={(e) =>
                  updateSell(sell.id, { sellPrice: Number(e.target.value) })
                }
              />
              <IconButton
                size="small"
                color="error"
                onClick={() => removeSell(sell.id)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}

          <Box>
            <Button
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={addSell}
            >
              新增賣出紀錄
            </Button>
          </Box>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
