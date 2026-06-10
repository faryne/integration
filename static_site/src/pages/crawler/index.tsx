import {
  Stack,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Chip,
  Paper,
  Tab,
  Tabs,
  Snackbar,
  Drawer,
  IconButton,
} from "@mui/material";
import { type ReactElement, type ReactNode, useEffect, useState } from "react";
import { JsonEditor } from "jsoneditor-react";
import { useTitle } from "@/helpers/title";
import Ajv from "ajv";
import {
  type CrawlerExecRequest,
  useCrawlerExec,
} from "@/apis/tools/crawler_exec.ts";
import Ace from "ace-builds";
import "ace-builds/src-noconflict/mode-json"; // 載入 JSON 模式
import "ace-builds/src-noconflict/theme-github"; // 載入佈景主題（可選）
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/Close";

interface ExampleCode {
  label: string;
  code: string;
}

interface RuleDoc {
  name: string;
  required: boolean;
  type: string;
  summary: string;
  usage: string;
  example: string;
}

const apiEndpoint = `${import.meta.env.VITE_API_BASE}/tools/crawler/exec`;

const ruleDocs: RuleDoc[] = [
  {
    name: "name",
    required: true,
    type: "string",
    summary: "輸出 JSON 的欄位名稱。",
    usage:
      "用來決定結果物件裡的 key。名稱建議使用容易辨識的英文或 snake_case，方便後續程式直接讀取。",
    example: `"name": "title"`,
  },
  {
    name: "pattern",
    required: true,
    type: "string",
    summary: "CSS selector 路徑。",
    usage:
      "用來指定要抓取的 HTML 元素。第一層會從整份 HTML 查找；放在 child 裡時，會從父層已找到的元素內繼續查找。",
    example: `"pattern": "div.itemBox > div.mid > p.name > a"`,
  },
  {
    name: "multiple",
    required: false,
    type: "boolean",
    summary: "決定結果要取單筆或多筆。",
    usage:
      "設為 true 時會回傳陣列，適合列表、表格列、商品卡片。設為 false 時只取第一筆，適合頁面標題、價格、單一欄位。",
    example: `"multiple": true`,
  },
  {
    name: "attrs",
    required: false,
    type: "string[]",
    summary: "額外抓取元素屬性。",
    usage:
      "適合抓連結 href、圖片 src、data-* 屬性。即使指定 attrs，元素文字仍會保留在結果中，方便同時拿文字與屬性。",
    example: `"attrs": ["href", "title"]`,
  },
  {
    name: "trim",
    required: false,
    type: "boolean",
    summary: "清理文字前後空白。",
    usage:
      "設為 true 可以移除文字開頭與結尾的空白、換行，讓結果更容易比對與儲存。若原始空白有意義，再改成 false。",
    example: `"trim": true`,
  },
  {
    name: "child",
    required: false,
    type: "CrawlerRule[]",
    summary: "建立巢狀擷取規則。",
    usage:
      "父層通常搭配 multiple: true 先抓一組容器，例如每一列 tr 或每張卡片；child 再從每個容器內抓 title、url、price 等欄位。",
    example: `"child": [{ "name": "title", "pattern": "h2", "multiple": false }]`,
  },
];

function createExamples(input: CrawlerExecRequest): ExampleCode[] {
  const payload = JSON.stringify(input, null, 2);
  const escapedJson = JSON.stringify(input);

  return [
    {
      label: "curl",
      code: `curl -X POST "${apiEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`,
    },
    {
      label: "JavaScript",
      code: `const response = await fetch("${apiEndpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${payload}),
});

const result = await response.json();
console.log(result.data);`,
    },
    {
      label: "PHP",
      code: `$payload = '${escapedJson}';

$ch = curl_init("${apiEndpoint}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result["data"]);`,
    },
    {
      label: "Go",
      code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

func main() {
	payload := []byte(\`${payload}\`)

	resp, err := http.Post("${apiEndpoint}", "application/json", bytes.NewReader(payload))
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		panic(err)
	}

	fmt.Println(result["data"])
}`,
    },
  ];
}

function CodeExample({
  code,
  language,
  onCopy,
}: {
  code: string;
  language: string;
  onCopy: (code: string) => void;
}) {
  const tokens = highlightCode(code, language);

  return (
    <Paper
      variant="outlined"
      sx={{
        position: "relative",
        bgcolor: "#111827",
        color: "#f9fafb",
        overflow: "hidden",
        borderRadius: 1,
      }}
    >
      <Button
        size="small"
        variant="contained"
        startIcon={<ContentCopyIcon fontSize="small" />}
        onClick={() => onCopy(code)}
        sx={{ position: "absolute", right: 12, top: 12, zIndex: 1 }}
      >
        複製
      </Button>
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 2,
          pt: 7,
          overflowX: "auto",
          fontSize: 14,
          lineHeight: 1.7,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        }}
      >
        <code>{tokens}</code>
      </Box>
    </Paper>
  );
}

function highlightCode(code: string, language: string): ReactNode[] {
  const tokenPattern =
    /(`(?:\\.|[^`])*`|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\/\/.*|#.*|\b(?:await|body|const|defer|err|false|fetch|func|headers|if|import|method|new|nil|package|panic|return|true|var)\b|CURLOPT_[A-Z_]+|\$[A-Za-z_]\w*|-\w+|\b\d+(?:\.\d+)?\b)/g;

  return code.split(tokenPattern).map((token, index) => {
    if (token === "") {
      return null;
    }

    const color = getTokenColor(token, language);
    return color ? (
      <Box component="span" key={`${token}-${index}`} sx={{ color }}>
        {token}
      </Box>
    ) : (
      token
    );
  });
}

function getTokenColor(token: string, language: string): string | null {
  if (/^(`|"|')/.test(token)) {
    return "#a7f3d0";
  }
  if (/^(\/\/|#)/.test(token)) {
    return "#94a3b8";
  }
  if (/^-\w+$/.test(token)) {
    return "#fbbf24";
  }
  if (/^CURLOPT_[A-Z_]+$/.test(token)) {
    return "#93c5fd";
  }
  if (/^\$[A-Za-z_]\w*$/.test(token)) {
    return "#c4b5fd";
  }
  if (/^\d/.test(token)) {
    return "#fca5a5";
  }
  if (
    /\b(await|body|const|defer|err|false|fetch|func|headers|if|import|method|new|nil|package|panic|return|true|var)\b/.test(
      token,
    )
  ) {
    return language === "curl" ? "#f9fafb" : "#93c5fd";
  }

  return null;
}

function RuleGuideDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: { xs: "100vw", sm: 520 },
          maxWidth: "100vw",
          p: 3,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" component="h2">
              規則說明
            </Typography>
            <Typography color="text.secondary" variant="body2">
              每個規則描述一段 HTML 要怎麼轉成 JSON。
            </Typography>
          </Box>
          <IconButton aria-label="關閉規則說明" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Alert severity="info" sx={{ mb: 2 }}>
          第一層從整份 HTML 查找，child 規則只會在父層元素內查找。 沒指定 attrs
          時會回傳元素文字。
        </Alert>

        <Stack spacing={2.5}>
          {ruleDocs.map((field) => (
            <Box key={field.name}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                sx={{ mb: 0.75 }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {field.name}
                </Typography>
                <Chip
                  size="small"
                  label={field.required ? "必填" : "選填"}
                  color={field.required ? "primary" : "default"}
                />
                <Chip size="small" label={field.type} variant="outlined" />
              </Stack>
              <Typography sx={{ mb: 0.75 }}>{field.summary}</Typography>
              <Typography
                color="text.secondary"
                lineHeight={1.7}
                sx={{ mb: 1 }}
              >
                {field.usage}
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 1,
                  bgcolor: "action.hover",
                  overflowX: "auto",
                }}
              >
                <Box
                  component="code"
                  sx={{
                    fontFamily:
                      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  {field.example}
                </Box>
              </Paper>
            </Box>
          ))}
        </Stack>
      </Box>
    </Drawer>
  );
}

export function CrawlerIndex() {
  const [input, setInput] = useState<CrawlerExecRequest>({
    uri: "https://xcity.jp/idol/?kana=あ&num=90&page=1",
    rules: [
      {
        name: "case1",
        pattern: "div.itemBox > div.mid > p.name > a",
        multiple: true,
        attrs: ["href", "title"],
        trim: true,
      },
    ],
  });

  const [submitButton, setSubmitButton] = useState<boolean>(false);
  const [exampleTab, setExampleTab] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const crawlerExec = useCrawlerExec();
  const [resp, setResp] = useState<ReactElement | null>(null);
  useEffect(() => {
    if (crawlerExec.isSuccess) {
      setResp(<JsonEditor mode={"view"} value={crawlerExec.data.data} />);
    }
  }, [crawlerExec.isSuccess]);

  const ajvMod = new Ajv({ allErrors: true, verbose: true });
  const schema = {
    type: "array",
    minItems: 1,
    items: {
      type: "object",
      required: ["name", "pattern"],
      properties: {
        name: {
          type: "string",
          title: "輸出的欄位名稱",
          examples: ["field"],
        },
        pattern: {
          type: "string",
          title: "css selector 路徑",
          examples: ["div.itemBox > div.mid > p.name > a"],
        },
        multiple: {
          type: "boolean",
          title: "是否有多個",
        },
        attrs: {
          type: "array",
          items: {
            type: "string",
          },
          title: "要抓取的元素屬性",
          examples: ["href", "title"],
        },
        trim: {
          type: "boolean",
          title: "是否要處理尾端的空白",
        },
        child: {
          type: "array",
          title: "子層規則，會在目前 selector 找到的每個元素內繼續查找",
          examples: ["[{ name: 'title', pattern: 'h2', multiple: false }]"],
        },
      },
    },
  };

  useTitle("爬蟲工具");

  const examples = createExamples(input);
  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopyMessage("已複製範例程式碼");
  };

  return (
    <Stack direction={"column"} spacing={2.5}>
      <Box>
        <Typography variant={"h5"} component="h1" gutterBottom>
          爬蟲工具
        </Typography>
        <Typography color="text.secondary">
          輸入網址與 CSS selector 規則，直接回傳結構化 JSON。
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 520px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
          <Stack direction={"column"} spacing={2}>
            <TextField
              label={"目標網址"}
              size={"medium"}
              fullWidth
              placeholder={"要抓取的網址"}
              value={input.uri}
              type={"url"}
              onChange={(e) => setInput((o) => ({ ...o, uri: e.target.value }))}
            />

            <Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                sx={{ mb: 1 }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant={"subtitle1"} fontWeight={600}>
                    擷取規則
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<HelpOutlineIcon fontSize="small" />}
                    onClick={() => setGuideOpen(true)}
                  >
                    規則說明
                  </Button>
                </Stack>
                <Stack direction="row" gap={1} flexWrap="wrap">
                  <Chip size="small" label="name + pattern 必填" />
                  <Chip size="small" label="multiple 決定陣列" />
                  <Chip size="small" label="attrs 取屬性" />
                </Stack>
              </Stack>
              <JsonEditor
                ace={Ace}
                ajv={ajvMod}
                mode={"code"}
                value={input.rules}
                onChange={(e: never) => setInput((o) => ({ ...o, rules: e }))}
                schema={schema}
                onValidationError={(errors: never[]) =>
                  setSubmitButton(errors.length > 0)
                }
              />
            </Box>

            <Box textAlign={"right"}>
              <Button
                disabled={submitButton || crawlerExec.isPending}
                variant={"contained"}
                onClick={() => {
                  crawlerExec.mutate(input);
                }}
              >
                {crawlerExec.isPending ? "抓取中..." : "開始抓取"}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            p: resp ? 0 : 3,
            borderRadius: 1,
            minWidth: 0,
            minHeight: 240,
            bgcolor: resp ? "transparent" : "action.hover",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={1}
            sx={{ mb: resp ? 1 : 0 }}
          >
            <Typography variant={"subtitle1"} fontWeight={600}>
              執行結果
            </Typography>
            {!resp && (
              <Typography color="text.secondary" variant="body2">
                送出後會顯示 JSON 結果
              </Typography>
            )}
          </Stack>
          {resp ?? (
            <Typography
              color="text.secondary"
              textAlign="center"
              sx={{ mt: 6 }}
            >
              尚未執行
            </Typography>
          )}
        </Paper>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, minWidth: 0 }}>
        <Typography variant={"subtitle1"} fontWeight={600} gutterBottom>
          API 範例
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 1 }}>
          會使用上方目前的網址與規則內容同步產生。
        </Typography>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs
            value={exampleTab}
            onChange={(_, value) => setExampleTab(value)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {examples.map((example) => (
              <Tab key={example.label} label={example.label} />
            ))}
          </Tabs>
        </Box>
        <Box
          sx={{
            maxHeight: 520,
            overflow: "auto",
          }}
        >
          <CodeExample
            code={examples[exampleTab].code}
            language={examples[exampleTab].label}
            onCopy={copyCode}
          />
        </Box>
      </Paper>

      <Snackbar
        open={copyMessage !== ""}
        autoHideDuration={1800}
        message={copyMessage}
        onClose={() => setCopyMessage("")}
      />
      <RuleGuideDrawer open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Stack>
  );
}
