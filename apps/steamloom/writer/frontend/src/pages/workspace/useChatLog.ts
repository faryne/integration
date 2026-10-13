import { useCallback, useEffect, useRef, useState } from "react";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage } from "@writer/lib/backend.ts";

// 不用 wails 產生的 class：那些 class 帶了 convertValues，物件字面值塞不回去。
type ChatThread = { id: string; title: string; session_id: string; updated_at: string; last_task_state?: string; active_task_id?: string };
export type ChatLine = {
  type?: string;
  role?: string;
  text: string;
  created_at?: string;
  task_id?: string;
  proposal_id?: string;
  event_id?: string;
  tool_name?: string;
  action?: string;
  commands?: string[];
};
type ChatPage = {
  threads: ChatThread[];
  current_id: string;
  session_id: string;
  messages: ChatLine[];
  start: number;
  total: number;
};
// 一個專案 × 一個 Agent 的對話紀錄。切換時只讀目前那一條的尾端，更早的另按一次才補上。
export function useChatLog(projectID: string, agentID: string) {
  const { showError } = useSnack();
  const [page, setPage] = useState<ChatPage | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const pin = useRef(true);
  const request = useRef(0);
  const refresh = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const current = useRef<ChatPage | null>(null);

  useEffect(() => {
    current.current = page;
  }, [page]);

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

  const replace = useCallback((next: ChatPage) => {
    pin.current = true;
    setPage(next);
  }, []);

  const selectThread = async (threadID: string) => {
    if (!agentID || threadID === page?.current_id) return;
    try {
      replace(await backend.ChatSelect(agentID, projectID, threadID));
    } catch (err) {
      showError(errorMessage(err));
    }
  };

  // Task event 只刷新目前正在看的 thread；背景完成不能搶走使用者選取狀態。
  const refreshVisibleThread = useCallback(async (threadID: string) => {
    if (!agentID || current.current?.current_id !== threadID) return;
    const token = ++refresh.current;
    try {
      const next = await backend.ChatSelect(agentID, projectID, threadID);
      if (refresh.current === token && current.current?.current_id === threadID) replace(next);
    } catch (err) {
      showError(errorMessage(err));
    }
  }, [agentID, projectID, replace, showError]);

  const openThread = useCallback(async (threadID: string) => {
    if (!agentID || !threadID) return;
    try {
      replace(await backend.ChatSelect(agentID, projectID, threadID));
    } catch (err) {
      showError(errorMessage(err));
    }
  }, [agentID, projectID, replace, showError]);

  const startNew = async () => {
    if (!agentID) return null;
    try {
      const next = await backend.ChatNew(agentID, projectID);
      replace(next);
      return next;
    } catch (err) {
      showError(errorMessage(err));
      return null;
    }
  };

  const renameCurrent = async (title: string) => {
    if (!agentID || !page?.current_id) return false;
    try {
      replace(await backend.ChatRename(agentID, projectID, page.current_id, title));
      return true;
    } catch (err) {
      showError(errorMessage(err));
      return false;
    }
  };

  const deleteCurrent = async () => {
    if (!agentID || !page?.current_id) return false;
    try {
      replace(await backend.ChatDelete(agentID, projectID, page.current_id));
      return true;
    } catch (err) {
      showError(errorMessage(err));
      return false;
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

  return { page, box, loadingOlder, selectThread, openThread, refreshVisibleThread, startNew, renameCurrent, deleteCurrent, loadOlder };
}
