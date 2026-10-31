import {
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { useActressTopicIndex } from "@/apis/av/actress_topic.ts";
import { actressTopicPath } from "@/helpers/avActressTopic.ts";
import { useTitle } from "@/helpers/title.tsx";
import { AgeConfirmationGate } from "@/components/common/AgeConfirmation.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthContext.ts";

// 主題多的分組占整列寬，其他兩兩並排
const WIDE_GROUPS = ["special", "body", "pref", "hot", "cold"];

/** 女優主題總覽：/av/actress/topics，依分組列出每個主題與人數（資料來自每週產生的 index.json） */
export function AVActressTopics() {
  useTitle("AV 女優主題");
  const index = useActressTopicIndex();
  const { session } = useAuth();
  const [errorClosed, setErrorClosed] = useState(false);

  return (
    <AgeConfirmationGate
      description="AV 女優主題頁包含成人內容與成人作品資料。請確認你已年滿 18 歲後再繼續瀏覽。"
      leaveTo="/"
      panelTitle="AV 女優主題需要年齡確認"
    >
      <Stack spacing={2} sx={{ textAlign: "left" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
        >
          <Box>
            <Typography component="h1" fontWeight={900} variant="h5">
              女優主題
            </Typography>
            {index.data && (
              <Typography color="text.secondary" variant="body2">
                更新於{" "}
                {index.data.generated_at.slice(0, 10).replaceAll("-", "/")}
              </Typography>
            )}
          </Box>
          {/* 管理員才看得到 */}
          {session?.user.is_admin && (
            <Button
              component={RouterLink}
              to="/av/actress/topics/manage"
              variant="outlined"
            >
              管理主題
            </Button>
          )}
        </Stack>
        {index.isPending ? (
          <Skeleton height={480} variant="rounded" />
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            {index.data?.groups.map((group) => (
              <Paper
                key={group.key}
                sx={{
                  gridColumn: WIDE_GROUPS.includes(group.key)
                    ? "1 / -1"
                    : undefined,
                  p: 2,
                }}
                variant="outlined"
              >
                <Typography fontWeight={800} sx={{ mb: 1.25 }}>
                  {group.label}
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {group.topics.map((topic) => (
                    <Chip
                      clickable
                      component={RouterLink}
                      key={topic.slug}
                      label={
                        <>
                          {topic.label}
                          <Box
                            component="span"
                            sx={{
                              color: "text.secondary",
                              fontSize: "0.75em",
                              ml: 0.75,
                            }}
                          >
                            {topic.count.toLocaleString()}
                          </Box>
                        </>
                      }
                      title={topic.summary}
                      to={actressTopicPath(topic.slug)}
                      variant="outlined"
                    />
                  ))}
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Stack>
      <CustomSnackbar
        message="主題資料讀取失敗，請稍後再試"
        onClose={() => setErrorClosed(true)}
        open={index.isError && !errorClosed}
        severity="error"
      />
    </AgeConfirmationGate>
  );
}
