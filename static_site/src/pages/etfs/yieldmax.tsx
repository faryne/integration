import React, { useEffect, useState } from "react";
import { Tabs, Tab, Box, Container, Typography, Skeleton } from "@mui/material";
import { type EtfInfo } from "@/types/etf.ts";
import { ETFInfo } from "@/components/etf/etf_info.tsx";
import { useCrawlerExec } from "@/apis/tools/crawler_exec.ts";
import dayjs from "dayjs";
import { useTitle } from "@/helpers/title.tsx";

const etfs: Record<string, { uri: string; description: string }> = {
  CONY: {
    uri: "https://yieldmaxetfs.com/our-etfs/cony/",
    description: "YieldMax COIN Option Income Strategy ETF",
  },
  AIYY: {
    uri: "https://yieldmaxetfs.com/our-etfs/aiyy/",
    description: "YieldMax® AI Option Income Strategy ETF",
  },
  NVDY: {
    uri: "https://yieldmaxetfs.com/our-etfs/nvdy/",
    description: "YieldMax NVDA Option Income Strategy ETF",
  },
  TSLY: {
    uri: "https://yieldmaxetfs.com/our-etfs/tsly/",
    description: "YieldMax TSLA Option Income Strategy ETF",
  },
};

export function YieldMaxEtfs() {
  const [activeTab, setActiveTab] = useState(Object.keys(etfs)[0]);

  const handleChange = (_: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
  };

  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<EtfInfo | null>(null);

  const queryCrawler = useCrawlerExec();
  useEffect(() => {
    queryCrawler.mutate({
      uri: etfs[activeTab].uri,
      rules: [
        {
          name: "distributions",
          pattern: "table.distributions-table > tbody > tr",
          multiple: true,
          child: [
            {
              name: "share",
              pattern: "td:nth-child(1)",
              multiple: false,
            },
            {
              name: "declared_date",
              pattern: "td:nth-child(2)",
              multiple: false,
            },
            {
              name: "ex_date",
              pattern: "td:nth-child(3)",
              multiple: false,
            },
            {
              name: "payable_date",
              pattern: "td:nth-child(5)",
              multiple: false,
            },
            {
              name: "roc",
              pattern: "td:nth-child(6)",
              multiple: false,
            },
          ],
        },
      ],
    });
  }, [activeTab]);

  useTitle(
    "YieldMax ETF 配息統計 - " + activeTab + ":" + etfs[activeTab].description,
  );

  useEffect(() => {
    setLoading(!(queryCrawler.isSuccess || queryCrawler.isError));
    if (queryCrawler.isSuccess) {
      setRawData({
        code: activeTab,
        description: etfs[activeTab].description,
        distributions: queryCrawler.data.data.distributions.map((d: any) => {
          return {
            per_share: parseFloat(d.children.share.text.replace("$", "")),
            declared_date: dayjs(d.children.declared_date.text).format(
              "YYYY-MM-DD",
            ),
            ex_date: dayjs(d.children.ex_date.text).format("YYYY-MM-DD"),
            payable_date: dayjs(d.children.payable_date.text).format(
              "YYYY-MM-DD",
            ),
            roc:
              d.children.roc.text.indexOf("nan") >= 0
                ? -1
                : parseFloat(d.children.roc.text.replace("%", "")),
          };
        }),
      });
    }
  }, [queryCrawler.isPending, queryCrawler.isSuccess, queryCrawler.isError]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        YieldMax ETF 配息統計
      </Typography>

      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {Object.keys(etfs).map((code) => (
            <Tab label={code} value={code} key={code} />
          ))}
        </Tabs>
      </Box>

      {/* 根據選中的 Tab 顯示對應的資料 */}
      {loading ? (
        <Box sx={{ width: "100%", mt: 3 }}>
          <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={200} />
        </Box>
      ) : rawData ? (
        <ETFInfo
          data={rawData ?? { code: "", description: "", distributions: [] }}
        />
      ) : (
        <Box sx={{ p: 5, textAlign: "center" }}>
          {/* 這裡可以放個簡單的 Icon */}
          <Typography color="text.secondary">
            目前暫無 {activeTab} 的紀錄
          </Typography>
        </Box>
      )}
    </Container>
  );
}
