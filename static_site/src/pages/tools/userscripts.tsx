import React from "react";
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Box,
} from "@mui/material";
import { useTitle } from "@/helpers/title";

interface Userscript {
  name: string;
  description: string;
  url: string;
}

const userscripts: Userscript[] = [
  {
    name: "難以名狀的抓圖器",
    description: "抓取 Pixiv / NicoSeiga / Tinami 的圖片並儲存到 neko.maid.app",
    url: "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/126952-userscript.js",
  },
  {
    name: "AV 女優換圖",
    description: "自動將網頁中的圖片隨機替換為 AV 女優圖庫圖片（純屬娛樂）。",
    url: "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/av-image-replacer.user.js",
  },
  {
    name: "Threads 截圖工具",
    description: "在 Threads 貼文旁加入截圖按鈕，快速產生並下載 PNG 截圖。",
    url: "https://raw.githubusercontent.com/faryne/faryne.github.com/refs/heads/master/userscripts/threads-capture.user.js",
  },
];

export const Userscripts: React.FC = () => {
  useTitle("Userscripts 列表");

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Userscripts 列表
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        這裡列出了我開發的 Userscripts，點擊「查看原始碼」可跳轉至 GitHub 下載。
      </Typography>

      <Grid container spacing={3}>
        {userscripts.map((script, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
            <Card
              sx={{ height: "100%", display: "flex", flexDirection: "column" }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="h2">
                  {script.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {script.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  href={script.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看原始碼
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {userscripts.length === 0 && (
          <Box sx={{ width: "100%", textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary">
              目前暫無資料，請編輯程式碼加入內容。
            </Typography>
          </Box>
        )}
      </Grid>
    </Container>
  );
};

export default Userscripts;
