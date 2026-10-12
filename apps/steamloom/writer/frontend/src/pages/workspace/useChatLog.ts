import { useEffect, useRef, useState } from "react";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage } from "@writer/lib/backend.ts";
import type { agent } from "../../../wailsjs/go/models";

// 不用 wails 產生的 class：那些 class 帶了 convertValues，物件字面值塞不回去。
type ChatThread = { id: string; title: string; session_id: string; updated_at: string };
type ChatLine = { role: string; text: string };
type ChatPage = {
  threads: ChatThread[];
  current_id: string;
  session_id: string;
  messages: ChatLine[];
  start: number;
  total: number;
};
type Reply = agent.Reply;

const pageSize = 40;

// 一個專案 × 一個 Agent 的對話紀錄。切換時只讀目前那一條的尾端，更早的另按一次才補上。
export function useChatLog(projectID: string, agentID: string) {
  const { showError } = useSnack();
  const [page, setPage] = useState<ChatPage | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pin = useRef(true);
  const request = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentID) {
      setPage(null);
      return;
    }
    const token = ++request.current;
    pin.current = true;
    setPage(null);
    backend
      .ChatOpen(agentID, projectID)
      .then((next) => {
        if (request.current === token) setPage(next);
      })
      .catch((err) => {
        if (request.current !== token) return;
        showError(errorMessage(err));
      });
  }, [projectID, agentID, showError]);

  useEffect(() => {
    if (!pin.current) return;
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [page?.messages, page?.current_id]);

  const replace = (next: ChatPage) => {
    pin.current = true;
    setPage(next);
  };

  const selectThread = async (threadID: string) => {
    if (!agentID || threadID === page?.current_id) return;
    try {
      replace(await backend.ChatSelect(agentID, projectID, threadID));
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  const startNew = async () => {
    if (!agentID) return;
    try {
      replace(await backend.ChatNew(agentID, projectID));
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  const loadOlder = async () => {
    if (!page?.current_id || page.start <= 0 || loadingOlder) return;
    const scroller = box.current;
    const previous = scroller?.scrollHeight ?? 0;
    pin.current = false;
    setLoadingOlder(true);
    try {
      const older = await backend.ChatOlder(agentID, projectID, page.current_id, page.start);
      setPage((current) =>
        current && current.current_id === page.current_id
          ? { ...current, messages: [...older.messages, ...current.messages], start: older.start, total: older.total }
          : current,
      );
      requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop += scroller.scrollHeight - previous;
      });
    } catch (err) {
      showError(errorMessage(err));
      pin.current = true;
    } finally {
      setLoadingOlder(false);
    }
  };

  // 送出成功後接上這一來一回。視窗超過一頁就丟掉最舊的，位置還在檔案裡。
  const appendTurn = (prompt: string, reply: Reply) => {
    pin.current = true;
    setPage((current) => {
      const same = current?.current_id === reply.thread_id && current.current_id !== "";
      const base = same ? (current.messages ?? []) : [];
      let start = same ? current.start : 0;
      let total = (same ? current.total : 0) + 2;
      let messages = [...base, { role: "user", text: prompt }, { role: "assistant", text: reply.text }];
      if (messages.length > pageSize) {
        start += messages.length - pageSize;
        messages = messages.slice(messages.length - pageSize);
      }
      const thread = { id: reply.thread_id, title: reply.title, session_id: reply.session_id, updated_at: new Date().toISOString() };
      const threads = [thread, ...(current?.threads ?? []).filter((item) => item.id !== reply.thread_id)];
      return { threads, current_id: reply.thread_id, session_id: reply.session_id, messages, start, total };
    });
  };

  return { page, box, loadingOlder, selectThread, startNew, loadOlder, appendTurn };
}
