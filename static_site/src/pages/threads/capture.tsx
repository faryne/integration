import {
  Button,
  Card,
  TextField,
  Stack,
  CardContent,
  CardActions,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useCaptureThread } from "@/apis/tools/capture_thread.ts";
import { useTitle } from "@/helpers/title.tsx";

export function CaptureThread() {
  const [uri, setUri] = useState<string>("");
  const captureThread = useCaptureThread();
  const [submitButtonDisabled, setSubmitButtonDisabled] = useState(false);

  useTitle("Threads 截圖工具");

  useEffect(() => {
    if (captureThread.isSuccess) {
      setSubmitButtonDisabled(false);
    } else if (captureThread.isPending) {
      setSubmitButtonDisabled(true);
    } else {
      setSubmitButtonDisabled(false);
    }
  }, [captureThread.isPending, captureThread.isSuccess, captureThread.isError]);
  return (
    <>
      <Stack direction={"column"} spacing={2}>
        <TextField
          label={"請輸入要抓取的網址"}
          size={"medium"}
          fullWidth
          placeholder={"要抓取的網址"}
          value={uri}
          type={"url"}
          onChange={(e) => setUri(e.target.value)}
        />
        <Button
          disabled={submitButtonDisabled}
          onClick={() => {
            setSubmitButtonDisabled(true);
            captureThread.mutate({ url: uri });
          }}
        >
          送出
        </Button>
        {captureThread.data?.img && (
          <>
            <Card variant={"outlined"}>
              <CardContent>
                <img
                  src={`data:image/png;base64, ${captureThread?.data?.img ?? ""}`}
                />
              </CardContent>
              <CardActions>
                <Button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `data:image/png;base64, ${captureThread?.data?.img ?? ""}`;
                    link.download =
                      btoa(uri)
                        .replace(/\+/g, "-") // 將 + 換成 -
                        .replace(/\//g, "_") // 將 / 換成 _
                        .replace(/=/g, "") + ".png"; // 移除所有 = 符號
                    link.click();
                  }}
                >
                  下載
                </Button>
              </CardActions>
            </Card>
          </>
        )}
      </Stack>
    </>
  );
}
