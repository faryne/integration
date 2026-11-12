import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

import { stockChangePct, type MarketStock } from "@/apis/av/joyu_market.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { stockActressPath } from "@/helpers/joyuMarket.ts";

import { StockChange } from "./StockChange.tsx";

const num = { fontVariantNumeric: "tabular-nums" } as const;

/** 今日買／賣股數：買紅賣綠，都沒有就一個橫線 */
function TradeSides({ stock: s }: { stock: MarketStock }) {
  if (!s.buy_volume && !s.sell_volume) return <>—</>;
  return (
    <>
      <Box component="span" sx={{ color: "error.main" }}>
        {s.buy_volume.toLocaleString()}
      </Box>
      ／
      <Box component="span" sx={{ color: "success.main" }}>
        {s.sell_volume.toLocaleString()}
      </Box>
    </>
  );
}
const photoSx = { borderRadius: 0.75, flexShrink: 0, width: 36 } as const;

/**
 * 股市總覽的列表：桌機是表格（代碼、女優、現價、漲跌、今日買／賣股數、近 90 天出片），手機是一列一檔。
 * 點了到女優頁的「股票」分頁（個股已經併進女優頁）。
 * 只渲染其中一種，免得兩份照片一起載。表格列不能整列包 <a>（HTML 不合法），點整列用 navigate，名字是真的連結（可以新分頁開）
 */
export function StockList({ stocks }: { stocks: MarketStock[] }) {
  const desktop = useMediaQuery(useTheme().breakpoints.up("md"));
  const navigate = useNavigate();
  if (!desktop) {
    return (
      <Stack divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
        {stocks.map((s) => (
          <Stack
            component={RouterLink}
            direction="row"
            key={s.code}
            spacing={1.25}
            sx={{
              alignItems: "center",
              color: "inherit",
              py: 1,
              textDecoration: "none",
            }}
            to={stockActressPath(s)}
          >
            <ActressPhoto
              alt={s.name}
              loading="lazy"
              src={s.photo}
              sx={photoSx}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 700 }}>
                {s.name}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 12, ...num }}>
                {s.code}・近 90 天 {s.videos_90d} 部
                {(s.buy_volume > 0 || s.sell_volume > 0) && (
                  <>
                    ・買／賣 <TradeSides stock={s} />
                  </>
                )}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontWeight: 700, ...num }}>
                {s.price.toFixed(2)}
              </Typography>
              <StockChange pct={stockChangePct(s)} sx={{ fontSize: 12 }} />
            </Box>
          </Stack>
        ))}
      </Stack>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>代碼</TableCell>
          <TableCell>女優</TableCell>
          <TableCell align="right">現價</TableCell>
          <TableCell align="right">漲跌</TableCell>
          <TableCell align="right">今日買／賣</TableCell>
          <TableCell align="right">近 90 天出片</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {stocks.map((s) => (
          <TableRow
            hover
            key={s.code}
            onClick={() => navigate(stockActressPath(s))}
            sx={{ cursor: "pointer" }}
          >
            <TableCell sx={{ color: "text.secondary", ...num }}>
              {s.code}
            </TableCell>
            <TableCell>
              <Stack
                direction="row"
                spacing={1.25}
                sx={{ alignItems: "center" }}
              >
                <ActressPhoto
                  alt={s.name}
                  loading="lazy"
                  src={s.photo}
                  sx={photoSx}
                />
                <Link
                  color="inherit"
                  component={RouterLink}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ fontWeight: 700 }}
                  to={stockActressPath(s)}
                  underline="hover"
                >
                  {s.name}
                </Link>
              </Stack>
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, ...num }}>
              {s.price.toFixed(2)}
            </TableCell>
            <TableCell align="right">
              <StockChange pct={stockChangePct(s)} />
            </TableCell>
            <TableCell align="right" sx={num}>
              <TradeSides stock={s} />
            </TableCell>
            <TableCell align="right" sx={num}>
              {s.videos_90d}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
