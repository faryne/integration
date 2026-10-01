import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerDialog } from "@/components/storyteller/StorytellerDialog.tsx";
import { useCreateStorytellerPersonalAccessToken } from "@/apis/storyteller.ts";
import {
  mcpPatTools,
  mcpEndpoint,
  personalAccessTokenExpiryOptions,
  personalAccessTokenExpiryDays,
} from "@/pages/storyteller/mcpClientSetup.ts";
import {
  CopyableCode,
  ToolPicker,
} from "@/pages/storyteller/developerShared.tsx";

// MCP 連接步驟 2（Personal Access Token）：先填名稱、效期與要用的工具，建立後在同一個視窗
// 顯示 token 與該工具格式的設定。token 只出現這一次，所以關閉前一律提醒先複製。
export function McpPatSetupDialog({
  open,
  onClose,
  onComplete,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (toolLabel: string) => void;
  onCopy: (value: string) => void;
}) {
  const createToken = useCreateStorytellerPersonalAccessToken();
  const [label, setLabel] = useState("");
  const [expiresIn, setExpiresIn] = useState("30");
  const [toolKey, setToolKey] = useState(mcpPatTools[0].key);
  const [token, setToken] = useState<string | null>(null);
  const tool =
    mcpPatTools.find((item) => item.key === toolKey) ?? mcpPatTools[0];

  // 關閉時清掉這次的輸入與 token，下次打開是全新的流程
  function reset() {
    setLabel("");
    setExpiresIn("30");
    setToken(null);
    createToken.reset();
  }

  function cancel() {
    reset();
    onClose();
  }

  function create() {
    createToken.mutate(
      { label, expires_in_days: personalAccessTokenExpiryDays(expiresIn) },
      { onSuccess: (created) => setToken(created?.token ?? null) },
    );
  }

  return (
    <StorytellerDialog
      open={open}
      maxWidth="sm"
      eyebrow="步驟 2 · Personal Access Token"
      title={token ? "Token 已建立" : "建立連線用的 Token"}
      onClose={token ? undefined : cancel}
      actions={
        token ? (
          <Button
            variant="contained"
            onClick={() => {
              onComplete(tool.label);
              reset();
            }}
          >
            我已複製，完成
          </Button>
        ) : (
          <>
            <Button onClick={cancel}>取消</Button>
            <Button
              variant="contained"
              disabled={createToken.isPending || !label.trim()}
              onClick={create}
            >
              {createToken.isPending ? "建立中" : "建立"}
            </Button>
          </>
        )
      }
    >
      {token ? (
        <Stack spacing={2}>
          <Alert severity="warning" variant="outlined">
            這組 token
            只會顯示這一次，請妥善保存，關閉後就無法再次查看完整內容。
          </Alert>
          <CopyableCode label="Token" value={token} onCopy={onCopy} />
          <CopyableCode
            label={tool.snippetLabel}
            value={tool.snippet(mcpEndpoint, token)}
            onCopy={onCopy}
          />
        </Stack>
      ) : (
        <Stack spacing={2}>
          <TextField
            required
            fullWidth
            label="名稱"
            placeholder="例如：Codex、我的筆電"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <TextField
            fullWidth
            select
            label="效期"
            value={expiresIn}
            onChange={(event) => setExpiresIn(event.target.value)}
          >
            {personalAccessTokenExpiryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            要用在哪個工具？（決定建立後顯示的設定格式）
          </Typography>
          <ToolPicker
            tools={mcpPatTools}
            value={toolKey}
            onChange={setToolKey}
          />
        </Stack>
      )}
      <CustomSnackbar
        open={createToken.isError}
        message="建立 Token 失敗，請確認欄位內容後重試。"
        severity="error"
        onClose={() => createToken.reset()}
      />
    </StorytellerDialog>
  );
}
