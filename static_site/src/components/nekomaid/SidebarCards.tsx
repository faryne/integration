import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { nekomaidUserscriptUrl } from "@/helpers/nekomaid.ts";

export function UserscriptPromotionCard() {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        p: 2.5,
        background:
          "linear-gradient(145deg, rgba(254, 243, 199, 0.92), rgba(255,255,255,0.98))",
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography fontWeight={900} variant="h6">
            安裝抓圖 userscript
          </Typography>
          <Typography color="text.secondary" variant="body2">
            在 Pixiv、Niconico 靜畫與 TINAMI
            頁面加入抓圖入口，減少手動複製作品資訊。
          </Typography>
        </Box>
        <Button
          component="a"
          href={nekomaidUserscriptUrl}
          target="_blank"
          rel="noreferrer"
          variant="contained"
        >
          查看 userscript
        </Button>
      </Stack>
    </Paper>
  );
}

export function PaypalDonateCard() {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2.5 }}>
      <Box
        component="form"
        action="https://www.paypal.com/cgi-bin/webscr"
        method="post"
        target="_top"
      >
        <Stack spacing={2}>
          <Box>
            <Typography fontWeight={900} variant="h6">
              神秘的捐款箱
            </Typography>
            <Typography color="text.secondary" variant="body2">
              如果這個工具對你有幫助，可以用 PayPal 支持維護。
            </Typography>
          </Box>

          <input type="hidden" name="cmd" value="_s-xclick" />
          <input type="hidden" name="hosted_button_id" value="PQH4RC8VG585W" />
          <input type="hidden" name="currency_code" value="TWD" />
          <input type="hidden" name="charset" value="utf-8" />
          <input type="hidden" name="on0" value="捐款數目" />

          <FormControl fullWidth>
            <InputLabel id="paypal-donate-label">捐款數目</InputLabel>
            <Select
              labelId="paypal-donate-label"
              id="paypal_donate"
              name="os0"
              label="捐款數目"
              defaultValue="60"
            >
              <MenuItem value="60">60 NT$60 TWD</MenuItem>
              <MenuItem value="100">100 NT$100 TWD</MenuItem>
              <MenuItem value="150">150 NT$150 TWD</MenuItem>
              <MenuItem value="300">300 NT$300 TWD</MenuItem>
            </Select>
          </FormControl>

          <Button type="submit" variant="outlined">
            使用 PayPal 捐贈
          </Button>
          <Box
            component="img"
            alt=""
            src="https://www.paypalobjects.com/zh_TW/i/scr/pixel.gif"
            sx={{ height: 1, width: 1 }}
          />
        </Stack>
      </Box>
    </Paper>
  );
}
