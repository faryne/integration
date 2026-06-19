import { BilingualDisclaimer } from "@/components/common/BilingualDisclaimer.tsx";

export function InvestmentRiskDisclaimer() {
  return (
    <BilingualDisclaimer
      chinese={
        <>
          本站內容僅供一般資訊與個人研究參考，不構成投資、稅務、法律或財務規劃建議，也不代表任何買賣邀約、招攬或推薦。資料可能來自公開資訊、第三方來源或自動化工具計算，可能存在延遲、錯誤、遺漏或未即時更新。
          <strong>任何歷史資料、統計結果或模型輸出均不保證未來表現</strong>
          。所有金融商品皆有風險，投資人應自行查證資料、理解商品特性並審慎評估自身風險承受能力；任何投資決策及其結果均由使用者自行負責。
        </>
      }
      english={
        <>
          The content on this website is provided for general information and
          personal research only. It does not constitute investment, tax, legal,
          financial planning, or other professional advice, nor does it
          represent an offer, solicitation, or recommendation to buy or sell any
          financial product. Data may come from public sources, third parties,
          or automated calculations and may be delayed, inaccurate, incomplete,
          or not updated in real time.
          <strong>
            {" "}
            Historical data, statistics, and model outputs do not guarantee
            future performance
          </strong>
          . All financial products involve risk. Users should independently
          verify information, understand product characteristics, assess their
          own risk tolerance, and take full responsibility for their decisions
          and outcomes.
        </>
      }
    />
  );
}
