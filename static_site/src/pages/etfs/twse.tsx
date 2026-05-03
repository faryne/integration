import React, { useState, useMemo, useEffect } from "react";
import {
  Grid,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { useTitle } from "@/helpers/title.tsx";
import { OptimizedEtfCard } from "@/components/etf/etf_card_info.tsx";
import { useGetTwseEtfCodeList } from "@/apis/opendata/twse_etf.ts";
import type { TwseEtfInfo } from "@/types/etf.ts";

const EtfDashboard: React.FC = () => {
  // 狀態管理
  const [searchTerm, setSearchTerm] = useState(""); // 搜尋關鍵字
  const [selectedEtf, setSelectedEtf] = useState<TwseEtfInfo | null>(null);
  const [allEtfs, setAllEtfs] = useState<TwseEtfInfo[]>([]);
  const [open, setOpen] = useState(false);

  const query = useGetTwseEtfCodeList();
  useTitle("ETF 投資導航");

  useEffect(() => {
    if (!query.isLoading && query.isSuccess && !query.isError) {
      setAllEtfs(query.data.data);
    }
  }, [query.isLoading, query.isSuccess, query.isError]);

  // 核心篩選邏輯：使用 useMemo 確保只有在關鍵字或原始資料變動時才重新計算
  const filteredEtfs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allEtfs;

    return allEtfs.filter(
      (etf) =>
        etf.code.includes(term) ||
        etf.name.toLowerCase().includes(term) ||
        etf.company.toLowerCase().includes(term) ||
        etf.target.toLowerCase().includes(term),
    );
  }, [searchTerm, allEtfs]);

  const handleOpen = (etf: TwseEtfInfo) => {
    setSelectedEtf(etf);
    setOpen(true);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: "0 auto" }}>
      <Typography
        variant="h4"
        sx={{ mb: 3, fontWeight: "bold", color: "#1a237e" }}
      >
        ETF 投資導航{" "}
        {allEtfs && <Typography>共 {allEtfs.length} 支</Typography>}
      </Typography>

      {/* 搜尋篩選列 */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="搜尋代碼、名稱、公司或關鍵字 (如：元大、科技...)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 4, bgcolor: "white" }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />

      {/* 卡片列表 */}
      <Typography
        variant="h6"
        sx={{ mb: 2, fontWeight: "bold", color: "#1a237e" }}
      >
        共 {filteredEtfs.length} 支符合條件
      </Typography>
      <Grid container spacing={3}>
        {filteredEtfs && filteredEtfs.length > 0 ? (
          filteredEtfs.map((etf) => (
            <Grid key={etf.code} size={3}>
              <OptimizedEtfCard etf={etf} onClick={() => handleOpen(etf)} />
            </Grid>
          ))
        ) : (
          <Grid size={12}>
            <Box sx={{ textAlign: "center", py: 10 }}>
              <Typography variant="h6" color="text.secondary">
                找不到符合「{searchTerm}」的 ETF
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* 彈出視窗 (維持原本邏輯) */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedEtf && (
          <>
            <DialogTitle
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{selectedEtf.name} 歷史配息</span>
              <IconButton onClick={() => setOpen(false)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers>
              {/* 此處放置 Table 程式碼，同前一個回答 */}
              <Typography variant="body2" sx={{ mb: 2 }}>
                這裡會顯示 {selectedEtf.code} 的詳細配息數據...
              </Typography>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default EtfDashboard;
