import { Navigate, useParams } from "react-router-dom";
import axios from "axios";
import { Skeleton } from "@mui/material";

import { useMarketStock } from "@/apis/av/joyu_market.ts";
import { ErrorSnack } from "@/components/joyu/home/ErrorSnack.tsx";
import { joyuPath } from "@/helpers/joyu.ts";
import { stockActressPath } from "@/helpers/joyuMarket.ts";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

/**
 * /market/J0001：個股已經併進女優頁的「股票」分頁，這裡只查代碼是哪一位、轉過去（replace，上一頁不會回到這裡）。
 * 只有代碼的地方（排行榜、成交紀錄、舊連結）都靠這頁轉
 */
export function JoyuStockRedirect() {
  const { code } = useParams();
  const stock = useMarketStock(code);
  if (stock.data) return <Navigate replace to={stockActressPath(stock.data)} />;
  if (axios.isAxiosError(stock.error) && stock.error.response?.status === 404) {
    return <ErrorPage backUrl={joyuPath("market")} code={404} />;
  }
  return (
    <>
      <Skeleton height={200} variant="rounded" />
      <ErrorSnack message="股市資料讀取失敗，請稍後再試" open={stock.isError} />
    </>
  );
}
