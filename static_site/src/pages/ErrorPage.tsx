import { Box, Button, Container, Stack, Typography } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

export interface ErrorPageProps {
  backUrl?: string;
  code: number;
  message?: string;
  internalCode?: string;
}

const defaultErrorContent: Record<number, { title: string; message: string }> =
  {
    400: {
      title: "請求格式不太對",
      message:
        "喵嗚，主人送來的資料女僕看不太懂。請確認輸入內容後，再交給我一次喵。",
    },
    401: {
      title: "需要先登入",
      message: "主人還沒有通行證喵。請先登入，女僕才能帶你進去看這份資料。",
    },
    403: {
      title: "沒有瀏覽權限",
      message:
        "這個房間目前不能讓主人進去喵。若覺得不應該被擋下，請再確認權限設定。",
    },
    404: {
      title: "找不到這個頁面",
      message:
        "喵嗚，女僕把走廊都找過了，還是沒有找到主人想看的頁面。先回首頁休息一下喵。",
    },
    500: {
      title: "伺服器累倒了",
      message:
        "女僕後台好像打翻茶盤了喵。請稍後再試一次，或把狀況交給管理員檢查。",
    },
    503: {
      title: "服務暫時休息中",
      message: "女僕正在整理房間，服務暫時無法使用喵。請稍後再回來看看。",
    },
  };

const fallbackErrorContent = {
  title: "發生了一點小狀況",
  message:
    "喵嗚，女僕這邊暫時處理不了主人想看的內容。請稍後再試一次，或先回首頁休息一下喵。",
};

export function ErrorPage({
  backUrl,
  code,
  message,
  internalCode,
}: ErrorPageProps) {
  const errorContent = defaultErrorContent[code] ?? fallbackErrorContent;
  const buttonHref = backUrl ?? "/";
  const ButtonIcon = backUrl ? ArrowBackIcon : HomeIcon;
  const buttonText = backUrl ? "回前頁" : "回首頁";

  return (
    <Container
      maxWidth="md"
      sx={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        py: { xs: 6, md: 10 },
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 4, md: 6 }}
        alignItems="center"
        sx={{ width: "100%" }}
      >
        <Box
          component="img"
          src="/faryne-icon-1024.jpg"
          alt="Faryne mascot"
          sx={{
            width: { xs: 180, md: 260 },
            height: { xs: 180, md: 260 },
            objectFit: "cover",
            borderRadius: 4,
            boxShadow: 3,
            flexShrink: 0,
          }}
        />

        <Box sx={{ textAlign: { xs: "center", md: "left" } }}>
          <Typography
            component="h1"
            variant="h2"
            color="primary"
            sx={{ fontWeight: 800 }}
          >
            {code}
          </Typography>
          <Typography
            component="p"
            variant="h5"
            sx={{ mt: 1, fontWeight: 700 }}
          >
            {errorContent.title}
          </Typography>
          <Typography
            component="p"
            variant="body1"
            color="text.secondary"
            sx={{ mt: 2, maxWidth: 520 }}
          >
            {message ?? errorContent.message}
          </Typography>

          {internalCode ? (
            <Typography
              component="p"
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", mt: 2 }}
            >
              系統內部錯誤代碼：{internalCode}
            </Typography>
          ) : null}

          <Button
            component="a"
            href={buttonHref}
            variant="contained"
            startIcon={<ButtonIcon />}
            sx={{ mt: 3 }}
          >
            {buttonText}
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}
