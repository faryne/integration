import {
  Stack,
  Box,
  TextField,
  Button,
  Divider,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import { type ReactElement, useEffect, useState } from "react";
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

  const crawlerExec = useCrawlerExec();
  const [resp, setResp] = useState<ReactElement | null>(null);
  useEffect(() => {
    if (crawlerExec.data?.data) {
      setResp(<JsonEditor mode={"view"} value={crawlerExec.data.data} />);
    }
  }, [crawlerExec.data]);

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
      },
    },
  };

  useTitle("爬蟲工具");

  return (
    <Stack direction={"column"} spacing={1}>
      <TextField
        label={"請輸入要抓取的網址"}
        size={"medium"}
        fullWidth
        placeholder={"要抓取的網址"}
        value={input.uri}
        type={"url"}
        onChange={(e) => setInput((o) => ({ ...o, uri: e.target.value }))}
      />
      <Box>
        <Typography variant={"subtitle2"}>元素說明</Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>欄位名稱</TableCell>
              <TableCell>欄位說明</TableCell>
              <TableCell>是否必填</TableCell>
              <TableCell>類型</TableCell>
              <TableCell>範例值</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(schema.items.properties as Record<string, any>).map(
              ([key, value]) => (
                <TableRow key={`description-${key}`}>
                  <TableCell>{key}</TableCell>
                  <TableCell>{value.title}</TableCell>
                  <TableCell>
                    {schema.items.required.indexOf(key) >= 0 ? "必填" : "選填"}
                  </TableCell>
                  <TableCell>{value.type}</TableCell>
                  <TableCell>
                    {typeof value.examples !== "undefined"
                      ? (value.examples as string[]).join("、")
                      : "-"}
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </Box>
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
      <Divider />
      <Box textAlign={"center"}>
        <Button
          disabled={submitButton}
          variant={"contained"}
          onClick={() => {
            console.log(input);
            crawlerExec.mutate(input);
          }}
        >
          開始抓取
        </Button>
      </Box>
      <Divider />
      {resp}
    </Stack>
  );
}
