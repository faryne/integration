import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SendIcon from "@mui/icons-material/Send";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import {
  callEncryptedDemo,
  type DemoHttpMethod,
} from "@/apis/auth/encryptedDemo.ts";
import { decryptPayload, encryptPayload } from "@/apis/auth/encryptedCrypto.ts";
import { getStoredAuthSession } from "@/apis/auth/storage.ts";
import { useTitle } from "@/helpers/title.tsx";

interface FieldRow {
  id: string;
  key: string;
  value: string;
}

const methodOptions: DemoHttpMethod[] = ["GET", "POST", "PUT", "DELETE"];

function prettyJson(input: string) {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

function buildQueryString(fields: FieldRow[]) {
  const values = new URLSearchParams();
  fields.forEach((field) => {
    if (field.key.trim()) {
      values.set(field.key.trim(), field.value);
    }
  });
  return values.toString();
}

function buildJsonString(fields: FieldRow[]) {
  const payload = fields.reduce<Record<string, string>>((output, field) => {
    if (field.key.trim()) {
      output[field.key.trim()] = field.value;
    }
    return output;
  }, {});
  return JSON.stringify(payload);
}

export default function EncryptedDemo() {
  useTitle("Encrypted API Demo");

  const [method, setMethod] = useState<DemoHttpMethod>("POST");
  const [payloadType, setPayloadType] = useState<"json" | "querystring">(
    "json",
  );
  const [fields, setFields] = useState<FieldRow[]>([
    { id: crypto.randomUUID(), key: "a", value: "1" },
    { id: crypto.randomUUID(), key: "b", value: "2" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [plainRequest, setPlainRequest] = useState("");
  const [encryptedRequest, setEncryptedRequest] = useState("");
  const [encryptedResponse, setEncryptedResponse] = useState("");
  const [decryptedResponse, setDecryptedResponse] = useState("");

  const session = useMemo(() => getStoredAuthSession(), []);
  const encryptKey = session?.encrypt_key ?? "";

  const updateField = (id: string, patch: Partial<FieldRow>) => {
    setFields((current) =>
      current.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  };

  const addField = () => {
    setFields((current) => [
      ...current,
      { id: crypto.randomUUID(), key: "", value: "" },
    ]);
  };

  const removeField = (id: string) => {
    setFields((current) => current.filter((field) => field.id !== id));
  };

  const handleSubmit = async () => {
    if (!encryptKey) {
      setErrorMessage("找不到 encrypt_key，請先到 /login 完成 Google 登入。 ");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const requestPayload =
        payloadType === "json"
          ? buildJsonString(fields)
          : buildQueryString(fields);
      const encryptedPayload = await encryptPayload(encryptKey, requestPayload);
      const demoResponse = await callEncryptedDemo({
        method,
        encryptKey,
        encryptedPayload,
      });
      const rawEncryptedResponse = demoResponse.body.trim();
      const rawDecryptedResponse = demoResponse.ok
        ? await decryptPayload(encryptKey, rawEncryptedResponse)
        : `HTTP ${demoResponse.status}\n${rawEncryptedResponse}`;

      setPlainRequest(requestPayload);
      setEncryptedRequest(encryptedPayload);
      setEncryptedResponse(rawEncryptedResponse);
      setDecryptedResponse(prettyJson(rawDecryptedResponse));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "呼叫失敗");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip label="Hidden test page" color="primary" />
            <Chip label="AES-256-GCM" variant="outlined" />
          </Stack>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 900 }}>
            Encrypted API 串接測試
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            此頁不放導覽連結，用來測試 /auth/encrypted/demo 的 request 加密與
            response 解密。
          </Typography>
        </Box>

        {!encryptKey && (
          <Alert severity="warning">
            尚未找到 encrypt_key。請先到 /login 完成登入並建立後端 session。
          </Alert>
        )}
        {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

        <Card
          elevation={0}
          sx={{ border: "1px solid #dce4ef", borderRadius: 4 }}
        >
          <CardContent>
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="encrypted-method-label">
                      HTTP Method
                    </InputLabel>
                    <Select
                      labelId="encrypted-method-label"
                      label="HTTP Method"
                      value={method}
                      onChange={(event) =>
                        setMethod(event.target.value as DemoHttpMethod)
                      }
                    >
                      {methodOptions.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel id="encrypted-payload-type-label">
                      Payload
                    </InputLabel>
                    <Select
                      labelId="encrypted-payload-type-label"
                      label="Payload"
                      value={payloadType}
                      onChange={(event) =>
                        setPayloadType(
                          event.target.value as "json" | "querystring",
                        )
                      }
                    >
                      <MenuItem value="json">JSON: {`{"a":"1"}`}</MenuItem>
                      <MenuItem value="querystring">
                        QueryString: a=1&amp;b=2
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Divider />

              <Stack spacing={2}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    欄位
                  </Typography>
                  <Button startIcon={<AddIcon />} onClick={addField}>
                    新增欄位
                  </Button>
                </Stack>

                {fields.map((field) => (
                  <Grid
                    container
                    spacing={1.5}
                    key={field.id}
                    alignItems="center"
                  >
                    <Grid size={{ xs: 12, md: 5 }}>
                      <TextField
                        label="欄位名稱"
                        value={field.key}
                        onChange={(event) =>
                          updateField(field.id, { key: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 10, md: 6 }}>
                      <TextField
                        label="欄位值"
                        value={field.value}
                        onChange={(event) =>
                          updateField(field.id, { value: event.target.value })
                        }
                        fullWidth
                      />
                    </Grid>
                    <Grid size={{ xs: 2, md: 1 }}>
                      <IconButton
                        aria-label="remove field"
                        disabled={fields.length <= 1}
                        onClick={() => removeField(field.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                ))}
              </Stack>

              <Button
                size="large"
                variant="contained"
                startIcon={<SendIcon />}
                disabled={submitting || !encryptKey}
                onClick={handleSubmit}
              >
                {submitting ? "送出中" : "加密並送出"}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <OutputCard title="Plain Request" value={plainRequest} />
          <OutputCard title="Encrypted Request" value={encryptedRequest} />
          <OutputCard title="Encrypted Response" value={encryptedResponse} />
          <OutputCard title="Decrypted Response" value={decryptedResponse} />
        </Grid>
      </Stack>
    </Box>
  );
}

function OutputCard({ title, value }: { title: string; value: string }) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 3,
          minHeight: 180,
          background: "#fbfdff",
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
          {title}
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            fontSize: 13,
            color: "#24364b",
          }}
        >
          {value || "尚無資料"}
        </Box>
      </Paper>
    </Grid>
  );
}
