import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import type { EtfInfo } from "@/types/etf.ts";
import { ETFInfo } from "@/components/etf/etf_info.tsx";
import { useCrawlerExec } from "@/apis/tools/crawler_exec.ts";
import dayjs from "dayjs";
import { useTitle } from "@/helpers/title.tsx";
import { yieldMaxEtfOptions, yieldMaxEtfs } from "@/data/yieldmax.ts";
import { useNavigate, useParams } from "react-router-dom";
import { InvestmentRiskDisclaimer } from "@/components/etf/InvestmentRiskDisclaimer.tsx";
import { useYieldMaxFavorites } from "@/apis/local/yieldmax_favorites.ts";

interface CrawlerTextField {
  text: string;
}

interface YieldMaxDistributionCrawlerResult {
  children: {
    share: CrawlerTextField;
    declared_date: CrawlerTextField;
    ex_date: CrawlerTextField;
    payable_date: CrawlerTextField;
    roc: CrawlerTextField;
  };
}

export function YieldMaxEtfs() {
  const navigate = useNavigate();
  const { etfCode } = useParams();
  const defaultEtfCode = yieldMaxEtfOptions[0].code;
  const normalizedEtfCode = etfCode?.toUpperCase();
  const activeTab =
    normalizedEtfCode && yieldMaxEtfs[normalizedEtfCode]
      ? normalizedEtfCode
      : defaultEtfCode;
  const { favorites, toggleFavorite } = useYieldMaxFavorites();
  const [keyword, setKeyword] = useState("");
  const filteredEtfs = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return yieldMaxEtfOptions;
    }

    return yieldMaxEtfOptions.filter(
      (etf) =>
        etf.code.toLowerCase().includes(normalizedKeyword) ||
        etf.description.toLowerCase().includes(normalizedKeyword),
    );
  }, [keyword]);

  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<EtfInfo | null>(null);

  useEffect(() => {
    if (normalizedEtfCode && normalizedEtfCode !== activeTab) {
      navigate(`/data/etf/yieldmax/${activeTab}`, { replace: true });
    }
  }, [activeTab, navigate, normalizedEtfCode]);

  const queryCrawler = useCrawlerExec();
  useEffect(() => {
    queryCrawler.mutate({
      uri: yieldMaxEtfs[activeTab].uri,
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
    "YieldMax ETF 配息統計 - " +
      activeTab +
      ":" +
      yieldMaxEtfs[activeTab].description,
  );

  useEffect(() => {
    setLoading(!(queryCrawler.isSuccess || queryCrawler.isError));
    if (queryCrawler.isSuccess) {
      setRawData({
        code: activeTab,
        description: yieldMaxEtfs[activeTab].description,
        divided_info: yieldMaxEtfs[activeTab].divided_info ?? undefined,
        distributions: queryCrawler.data.data.distributions.map(
          (distribution: YieldMaxDistributionCrawlerResult) => ({
            per_share: parseFloat(
              distribution.children.share.text.replace("$", ""),
            ),
            declared_date: dayjs(
              distribution.children.declared_date.text,
            ).format("YYYY-MM-DD"),
            ex_date: dayjs(distribution.children.ex_date.text).format(
              "YYYY-MM-DD",
            ),
            payable_date: dayjs(distribution.children.payable_date.text).format(
              "YYYY-MM-DD",
            ),
            roc:
              distribution.children.roc.text.indexOf("nan") >= 0
                ? -1
                : parseFloat(distribution.children.roc.text.replace("%", "")),
          }),
        ),
      });
    }
  }, [queryCrawler.isPending, queryCrawler.isSuccess, queryCrawler.isError]);

  return (
    <>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          YieldMax ETF 配息統計
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>
                    ETF 清單
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Single Stock 共 {yieldMaxEtfOptions.length} 檔
                  </Typography>
                </Box>

                <TextField
                  size="small"
                  type="search"
                  placeholder="搜尋代碼或名稱"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestartAltIcon />}
                  onClick={() => {
                    setKeyword("");
                    navigate(`/data/etf/yieldmax/${defaultEtfCode}`);
                  }}
                >
                  重設
                </Button>

                <List
                  dense
                  sx={{
                    maxHeight: { xs: 320, md: 680 },
                    overflowY: "auto",
                    pr: 1,
                  }}
                >
                  {filteredEtfs.map((etf) => {
                    const active = activeTab === etf.code;

                    return (
                      <ListItemButton
                        key={etf.code}
                        selected={active}
                        onClick={() =>
                          navigate(`/data/etf/yieldmax/${etf.code}`)
                        }
                        sx={{
                          alignItems: "flex-start",
                          borderRadius: 1.5,
                          mb: 0.5,
                        }}
                      >
                        <Stack spacing={0.5} sx={{ width: "100%" }}>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            justifyContent="space-between"
                          >
                            <Stack
                              direction="row"
                              spacing={0.5}
                              alignItems="center"
                            >
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(etf.code);
                                }}
                                sx={{ p: 0.25 }}
                              >
                                {favorites.has(etf.code) ? (
                                  <StarIcon fontSize="small" color="warning" />
                                ) : (
                                  <StarBorderIcon fontSize="small" />
                                )}
                              </IconButton>
                              <Typography fontWeight={800}>
                                {etf.code}
                              </Typography>
                            </Stack>
                            {active && <Chip size="small" label="目前" />}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {etf.description.replace("YieldMax ", "")}
                          </Typography>
                        </Stack>
                      </ListItemButton>
                    );
                  })}
                </List>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 9 }}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              {loading ? (
                <Box sx={{ width: "100%", mt: 3 }}>
                  <Skeleton variant="rectangular" height={60} sx={{ mb: 1 }} />
                  <Skeleton variant="rectangular" height={200} />
                </Box>
              ) : rawData ? (
                <ETFInfo
                  data={
                    rawData ?? { code: "", description: "", distributions: [] }
                  }
                />
              ) : (
                <Box sx={{ p: 5, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    目前暫無 {activeTab} 的紀錄
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <InvestmentRiskDisclaimer />
    </>
  );
}
