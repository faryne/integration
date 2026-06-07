import type { EtfDivideInfo } from "@/types/etf.ts";

export type YieldMaxEtfConfig = {
  uri: string;
  description: string;
  divided_info?: EtfDivideInfo[];
};

export const yieldMaxEtfs: Record<string, YieldMaxEtfConfig> = {
  ABNY: {
    uri: "https://yieldmaxetfs.com/our-etfs/abny/",
    description: "YieldMax ABNB Option Income Strategy ETF",
  },
  AIYY: {
    uri: "https://yieldmaxetfs.com/our-etfs/aiyy/",
    description: "YieldMax AI Option Income Strategy ETF",
  },
  AMDY: {
    uri: "https://yieldmaxetfs.com/our-etfs/amdy/",
    description: "YieldMax AMD Option Income Strategy ETF",
  },
  AMZY: {
    uri: "https://yieldmaxetfs.com/our-etfs/amzy/",
    description: "YieldMax AMZN Option Income Strategy ETF",
  },
  APLY: {
    uri: "https://yieldmaxetfs.com/our-etfs/aply/",
    description: "YieldMax AAPL Option Income Strategy ETF",
  },
  BABO: {
    uri: "https://yieldmaxetfs.com/our-etfs/babo/",
    description: "YieldMax BABA Option Income Strategy ETF",
  },
  BRKC: {
    uri: "https://yieldmaxetfs.com/our-etfs/brkc/",
    description: "YieldMax BRK.B Option Income Strategy ETF",
  },
  CONY: {
    uri: "https://yieldmaxetfs.com/our-etfs/cony/",
    description: "YieldMax COIN Option Income Strategy ETF",
  },
  CRCO: {
    uri: "https://yieldmaxetfs.com/our-etfs/crco/",
    description: "YieldMax CRCL Option Income Strategy ETF",
  },
  CRSH: {
    uri: "https://yieldmaxetfs.com/our-etfs/crsh/",
    description: "YieldMax Short TSLA Option Income Strategy ETF",
  },
  CVNY: {
    uri: "https://yieldmaxetfs.com/our-etfs/cvny/",
    description: "YieldMax CVNA Option Income Strategy ETF",
  },
  DIPS: {
    uri: "https://yieldmaxetfs.com/our-etfs/dips/",
    description: "YieldMax Short NVDA Option Income Strategy ETF",
  },
  DISO: {
    uri: "https://yieldmaxetfs.com/our-etfs/diso/",
    description: "YieldMax DIS Option Income Strategy ETF",
  },
  DRAY: {
    uri: "https://yieldmaxetfs.com/our-etfs/dray/",
    description: "YieldMax DKNG Option Income Strategy ETF",
  },
  FBY: {
    uri: "https://yieldmaxetfs.com/our-etfs/fby/",
    description: "YieldMax META Option Income Strategy ETF",
  },
  FIAT: {
    uri: "https://yieldmaxetfs.com/our-etfs/fiat/",
    description: "YieldMax Short COIN Option Income Strategy ETF",
  },
  GMEY: {
    uri: "https://yieldmaxetfs.com/our-etfs/gmey/",
    description: "YieldMax GME Option Income Strategy ETF",
  },
  GOOY: {
    uri: "https://yieldmaxetfs.com/our-etfs/gooy/",
    description: "YieldMax GOOGL Option Income Strategy ETF",
  },
  HIYY: {
    uri: "https://yieldmaxetfs.com/our-etfs/hiyy/",
    description: "YieldMax HIMS Option Income Strategy ETF",
  },
  HOOY: {
    uri: "https://yieldmaxetfs.com/our-etfs/hooy/",
    description: "YieldMax HOOD Option Income Strategy ETF",
  },
  INYY: {
    uri: "https://yieldmaxetfs.com/our-etfs/inyy/",
    description: "YieldMax INTC Option Income Strategy ETF",
  },
  JPO: {
    uri: "https://yieldmaxetfs.com/our-etfs/jpo/",
    description: "YieldMax JP Option Income Strategy ETF",
  },
  MARO: {
    uri: "https://yieldmaxetfs.com/our-etfs/maro/",
    description: "YieldMax MARA Option Income Strategy ETF",
  },
  MRNY: {
    uri: "https://yieldmaxetfs.com/our-etfs/mrny/",
    description: "YieldMax MRNA Option Income Strategy ETF",
  },
  MSFO: {
    uri: "https://yieldmaxetfs.com/our-etfs/msfo/",
    description: "YieldMax MSFT Option Income Strategy ETF",
  },
  MSTY: {
    uri: "https://yieldmaxetfs.com/our-etfs/msty/",
    description: "YieldMax MSTR Option Income Strategy ETF",
  },
  NFLY: {
    uri: "https://yieldmaxetfs.com/our-etfs/nfly/",
    description: "YieldMax NFLX Option Income Strategy ETF",
  },
  NVDY: {
    uri: "https://yieldmaxetfs.com/our-etfs/nvdy/",
    description: "YieldMax NVDA Option Income Strategy ETF",
  },
  PLTY: {
    uri: "https://yieldmaxetfs.com/our-etfs/plty/",
    description: "YieldMax PLTR Option Income Strategy ETF",
  },
  PYPY: {
    uri: "https://yieldmaxetfs.com/our-etfs/pypy/",
    description: "YieldMax PYPL Option Income Strategy ETF",
  },
  RBLY: {
    uri: "https://yieldmaxetfs.com/our-etfs/rbly/",
    description: "YieldMax RBLX Option Income Strategy ETF",
  },
  RDYY: {
    uri: "https://yieldmaxetfs.com/our-etfs/rdyy/",
    description: "YieldMax RDDT Option Income Strategy ETF",
  },
  SMCY: {
    uri: "https://yieldmaxetfs.com/our-etfs/smcy/",
    description: "YieldMax SMCI Option Income Strategy ETF",
  },
  SNOY: {
    uri: "https://yieldmaxetfs.com/our-etfs/snoy/",
    description: "YieldMax SNOW Option Income Strategy ETF",
  },
  TSLY: {
    uri: "https://yieldmaxetfs.com/our-etfs/tsly/",
    description: "YieldMax TSLA Option Income Strategy ETF",
  },
  TSMY: {
    uri: "https://yieldmaxetfs.com/our-etfs/tsmy/",
    description: "YieldMax TSM Option Income Strategy ETF",
  },
  WNTR: {
    uri: "https://yieldmaxetfs.com/our-etfs/wntr/",
    description: "YieldMax MSTR Short Option Income Strategy ETF",
  },
  XOMO: {
    uri: "https://yieldmaxetfs.com/our-etfs/xomo/",
    description: "YieldMax XOM Option Income Strategy ETF",
  },
  XYZY: {
    uri: "https://yieldmaxetfs.com/our-etfs/xyzy/",
    description: "YieldMax XYZ Option Income Strategy ETF",
  },
  YBIT: {
    uri: "https://yieldmaxetfs.com/our-etfs/ybit/",
    description: "YieldMax Bitcoin Option Income Strategy ETF",
  },
};

export const yieldMaxEtfOptions = Object.entries(yieldMaxEtfs).map(
  ([code, config]) => ({
    code,
    ...config,
  }),
);
