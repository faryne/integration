import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type { StorytellerAgentPanelAgent } from "@/pages/storyteller/StorytellerAgentPanel.tsx";

interface StorytellerAgentReferenceDrawerProps {
  open: boolean;
  onClose: () => void;
  agents: StorytellerAgentPanelAgent[];
}

const skillCommandRows = [
  { token: "/rewrite", label: "改寫", usage: "把選取或整段內容改寫成不同寫法，語氣風格盡量維持不變。" },
  { token: "/expand", label: "擴寫", usage: "延伸現有內容，補細節、加長篇幅，不改變原本走向。" },
  { token: "/translate", label: "翻譯", usage: "翻譯成指定語言；沒指定語言時預設翻成繁體中文。" },
  { token: "/continue", label: "續寫", usage: "接續目前內容繼續往下寫，不重複已有的部分。" },
  { token: "/custom", label: "自訂指令", usage: "不套用固定模式，照你打的指令自由處理。" },
];

const agentPromptExcerptMaxLength = 60;

function agentPromptExcerpt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return "（這個 Agent 還沒設定人設 prompt）";
  }
  if (trimmed.length <= agentPromptExcerptMaxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, agentPromptExcerptMaxLength)}…`;
}

const referenceExamples = [
  {
    token: "@thisStory",
    title: "目前故事",
    description: "在故事編輯頁引用目前正在編輯的故事內容。",
  },
  {
    token: "@story:[故事標題]",
    title: "指定故事",
    description: "引用同一個專案內指定標題的故事。",
  },
  {
    token: "@thisLore",
    title: "目前設定集",
    description: "在設定集編輯頁引用目前正在編輯的設定集內容。",
  },
  {
    token: "@lore:[設定集標題]",
    title: "指定設定集",
    description: "引用同一個專案內指定標題的設定集。",
  },
];

export function StorytellerAgentReferenceDrawer(
  props: StorytellerAgentReferenceDrawerProps,
) {
  return (
    <Drawer anchor="right" open={props.open} onClose={props.onClose}>
      <Box sx={{ width: { xs: 320, sm: 420 }, p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6" fontWeight={800}>
              指令與引用說明
            </Typography>
            <IconButton size="small" onClick={props.onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Typography variant="subtitle2" fontWeight={800}>
            指令（打 / 開頭）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            一次只會解析最前面那一個指令，後面再打的 / 一律當成一般文字。沒有指令、也沒有 /Agent
            名稱時，就是直接問答，不套用任何人設。
          </Typography>

          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            單輪 skill（只處理這一次，不套用任何 Agent 人設）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            格式是 <code>/指令 [額外需求]</code>，中括號代表可省略——例如直接打{" "}
            <code>/rewrite</code> 送出就套用預設改寫規則；也可以加字說明具體想怎麼改，例如{" "}
            <code>/rewrite 這段話改寫再色一些</code>。
          </Typography>
          <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>指令</TableCell>
                  <TableCell>使用時機</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {skillCommandRows.map((row) => (
                  <TableRow key={row.token}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Chip
                        size="small"
                        label={row.token}
                        sx={{
                          fontFamily:
                            '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {row.label}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.usage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            /&lt;Agent 名稱&gt;——切換人設（只有這一則訊息套用，後續訊息不受影響；也可以直接點上方
            Agent 選單插入，不用自己打字）
          </Typography>
          {props.agents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              這個專案還沒有建立任何 Agent。
            </Typography>
          ) : (
            <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>指令</TableCell>
                    <TableCell>人設 prompt 摘錄</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {props.agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Chip
                          size="small"
                          label={`/${agent.name}`}
                          sx={{
                            fontFamily:
                              '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                          }}
                        />
                      </TableCell>
                      <TableCell>{agentPromptExcerpt(agent.prompt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="subtitle2" fontWeight={800}>
            引用標籤（打 @ 開頭）
          </Typography>
          <Typography variant="body2" color="text.secondary">
            送出時會把引用標籤展開成對應故事或設定集內容，讓模型可以根據上下文回覆。
          </Typography>

          <Stack spacing={1.5}>
            {referenceExamples.map((item) => (
              <Box
                key={item.token}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack spacing={1}>
                  <Chip
                    size="small"
                    label={item.token}
                    sx={{
                      alignSelf: "flex-start",
                      fontFamily:
                        '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                    }}
                  />
                  <Typography variant="subtitle2" fontWeight={800}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.description}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
