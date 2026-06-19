import { Link } from "@mui/material";

import { BilingualDisclaimer } from "@/components/common/BilingualDisclaimer.tsx";

const sourceUrl = "https://service.taipower.com.tw/info/tc/inner.aspx?mid=16";

export function TaipowerDataDisclaimer() {
  return (
    <BilingualDisclaimer
      title="資料來源與免責聲明 / Data Source and Disclaimer"
      chinese={
        <>
          本頁資料擷取自
          <Link href={sourceUrl} target="_blank" rel="noopener noreferrer">
            台灣電力公司敦親睦鄰捐助公開資訊
          </Link>
          ，並由本站透過自動化程式整理、搜尋及統計。資料可能因來源網站更新、格式調整、傳輸或處理過程而產生延遲、錯誤、遺漏或統計差異。本頁內容僅供一般資訊與研究參考，不代表台灣電力公司之正式公告或意見；
          <strong>一切資料應以台灣電力公司網站公布內容為準</strong>
          ，使用者應自行查證並承擔依據本頁資訊所作決定之責任。
        </>
      }
      english={
        <>
          Data on this page is collected from the{" "}
          <Link href={sourceUrl} target="_blank" rel="noopener noreferrer">
            Taiwan Power Company neighborhood assistance disclosure website
          </Link>{" "}
          and is processed, indexed, and summarized by automated tools. Updates,
          source-format changes, transmission issues, or processing errors may
          result in delays, inaccuracies, omissions, or differences in
          calculated totals. This page is provided for general information and
          research only and does not represent an official announcement or
          opinion of Taiwan Power Company.{" "}
          <strong>
            The information published on the Taiwan Power Company website shall
            prevail
          </strong>
          . Users should independently verify the data and remain responsible
          for decisions made based on this page.
        </>
      }
    />
  );
}
