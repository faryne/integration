import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Button,
  Link,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { NekomaidPageBreadcrumb } from "@/components/nekomaid/NekomaidBreadcrumb.tsx";
import {
  CopyrightClaimDone,
  CopyrightClaimFields,
} from "@/components/nekomaid/copyrightClaimForm.tsx";
import { useCopyrightClaimForm } from "@/components/nekomaid/useCopyrightClaimForm.ts";
import { siteLabels } from "@/helpers/nekomaid.ts";
import {
  copyrightClaimPath,
  parseNekomaidTargetUrl,
} from "@/helpers/nekomaidForbidden.ts";
import { useTitle } from "@/helpers/title.tsx";

/**
 * 頁尾的版權申告頁（/copyright-claim/new）：畫師貼自己的個人頁網址，截出站台與畫師 ID，
 * 範圍一律是整個畫師（這功能本來就是給畫師維護自己權利用）。只想下架單一作品走作品頁麵包屑的小旗子
 */
export default function CopyrightClaimNew() {
  useTitle("版權申告");
  const [url, setUrl] = useState("");
  const form = useCopyrightClaimForm();
  const parsed = parseNekomaidTargetUrl(url.trim());
  // 作品網址只截得出作品 ID、沒有畫師 ID，這頁不收
  const target =
    parsed && parsed[1] ? { site: parsed[0], authorId: parsed[1] } : null;
  const urlError = url.trim() !== "" && !target;

  return (
    <Stack spacing={2} sx={{ maxWidth: 640, textAlign: "left" }}>
      <NekomaidPageBreadcrumb
        items={[
          { label: "版權申告", to: copyrightClaimPath() },
          { label: "申告整個畫師" },
        ]}
      />
      <Typography component="h1" fontWeight={900} variant="h5">
        版權申告
      </Typography>
      <Paper sx={{ p: 3 }} variant="outlined">
        {form.resultPath ? (
          <Stack spacing={2}>
            <CopyrightClaimDone path={form.resultPath} />
            <Button
              component={RouterLink}
              to={form.resultPath}
              variant="outlined"
            >
              查看我送出的申告
            </Button>
          </Stack>
        ) : (
          <Stack
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (target) form.submit(target.site, target.authorId);
            }}
            spacing={2}
          >
            <TextField
              error={urlError}
              helperText={
                urlError
                  ? "請貼 pixiv／Niconico 靜畫／TINAMI 的畫師個人頁網址"
                  : target
                    ? `${siteLabels[target.site] ?? target.site}・畫師 ${target.authorId} 的所有作品`
                    : " "
              }
              label="畫師個人頁網址"
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.pixiv.net/users/12345678"
              size="small"
              value={url}
            />
            <CopyrightClaimFields form={form} />
            <Button
              disabled={!target || form.pending}
              size="large"
              type="submit"
              variant="contained"
            >
              送出
            </Button>
          </Stack>
        )}
      </Paper>
      <Link component={RouterLink} to={copyrightClaimPath()}>
        查看申告處理結果
      </Link>
    </Stack>
  );
}
