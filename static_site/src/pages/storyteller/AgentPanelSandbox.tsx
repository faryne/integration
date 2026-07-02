import { Alert, Button, Container, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import {
  StorytellerAgentPanel,
  type StorytellerAgentPanelMessage,
} from "@/pages/storyteller/StorytellerAgentPanel.tsx";

// 模擬後端既有的對話紀錄，筆數足以讓訊息區出現捲軸，方便驗證捲動行為
const seedMessages: StorytellerAgentPanelMessage[] = Array.from(
  { length: 6 },
  (_, index) => [
    {
      id: `seed-user-${index}`,
      role: "user" as const,
      content: `這是第 ${index + 1} 則歷史需求，用來把訊息區撐出捲軸。`,
      speaker: "使用者",
    },
    {
      id: `seed-assistant-${index}`,
      role: "assistant" as const,
      content: `這是第 ${index + 1} 則歷史回應。\n\n多行內容讓每則訊息佔一點高度，模擬真實對話紀錄的長度。`,
      speaker: "模擬 Agent",
    },
  ],
).flat();

// dev 專用沙盒：以編輯器的對話流程（樂觀訊息＋等待泡泡）驅動 AI Agent 面板，
// 用 setTimeout 取代真實 API 呼叫（不消耗 token），驗證：
// 1. 送出後需求立刻出現在列表 2. 完成後列表捲到最新 3. 空狀態在首則訊息送出時消失
export default function StorytellerAgentPanelSandbox() {
  const [messages, setMessages] =
    useState<StorytellerAgentPanelMessage[]>(seedMessages);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [prompt, setPrompt] = useState("");
  const messageIdRef = useRef(0);

  const panelMessages: StorytellerAgentPanelMessage[] = [
    ...messages,
    ...(pendingPrompt
      ? [
          {
            id: "pending-user",
            role: "user" as const,
            content: pendingPrompt,
            speaker: "使用者",
          },
        ]
      : []),
  ];

  function runMockAgent() {
    const instruction = prompt.trim() || "（未輸入需求）";
    setPendingPrompt(instruction);
    setPrompt("");
    setPending(true);
    // 模擬後端完成寫入後，正式紀錄取代樂觀訊息
    window.setTimeout(() => {
      messageIdRef.current += 1;
      const runId = messageIdRef.current;
      setMessages((rows) => [
        ...rows,
        {
          id: `mock-user-${runId}`,
          role: "user",
          content: instruction,
          speaker: "使用者",
        },
        {
          id: `mock-assistant-${runId}`,
          role: "assistant",
          content: `模擬回應（第 ${runId} 次執行）：已收到「${instruction}」。\n\n這段文字由 setTimeout 產生，沒有呼叫任何 API。`,
          speaker: "模擬 Agent",
        },
      ]);
      setPendingPrompt("");
      setPending(false);
    }, 3000);
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={800}>
          AI Agent 面板沙盒
        </Typography>
        <Alert severity="info" variant="outlined">
          此頁僅在開發模式可見，用 3 秒延遲模擬 AI
          回應，不會呼叫任何 API。可用「清空對話」測試空狀態→首則訊息的轉場。
        </Alert>
        <Stack direction="row">
          <Button
            size="small"
            variant="outlined"
            onClick={() => setMessages([])}
          >
            清空對話
          </Button>
        </Stack>
        <StorytellerAgentPanel
          agents={[
            {
              id: "mock",
              name: "模擬 Agent",
              provider: "mock",
              model: "mock-model",
              prompt: "沙盒模擬用 Agent，不會呼叫任何 API。",
              enabled: true,
            },
          ]}
          selectedAgentId="mock"
          onSelectedAgentChange={() => {}}
          messages={panelMessages}
          messagesLoading={false}
          pending={pending}
          emptyTitle="尚無對話"
          emptyDescription="送出需求後開始模擬。"
          page={1}
          pageCount={1}
          onPageChange={() => {}}
          prompt={prompt}
          onPromptChange={setPrompt}
          promptPlaceholder="輸入任意文字，3 秒後出現模擬回應"
          canRun={!pending}
          onRun={runMockAgent}
          onApplyText={() => {}}
        />
      </Stack>
    </Container>
  );
}
