import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  beaconStorytellerReadingRecords,
  saveStorytellerReadingRecords,
  storytellerReadingRecordsQueryKey,
  useStorytellerReadingRecords,
  type StorytellerReadingTargetType,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import {
  fromServerRecords,
  loadLocalReadingProgress,
  mergeProgress,
  READING_PROGRESS_FLUSH_MS,
  READING_PROGRESS_SETTLE_MS,
  readingTargetKey,
  saveLocalReadingProgress,
  shouldRecordProgress,
  toRecordInputs,
  type ReaderProgressMap,
} from "./readingRecordStore.ts";

// 兩份進度表取聯集：同一篇取進度較大者、讀完狀態只要一邊有就算（跟後端 upsert 規則一致）
function unionProgress(base: ReaderProgressMap, overlay: ReaderProgressMap) {
  const out = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const current = out[key];
    out[key] =
      !current || value.progress > current.progress
        ? {
            ...value,
            completed: value.completed || Boolean(current?.completed),
          }
        : { ...current, completed: current.completed || value.completed };
  }
  return out;
}

// 閱讀進度：登入讀者存後端、未登入讀者存 localStorage，對外只提供統一的 progressMap 與 report。
// 未登入時累積的本機紀錄，在讀者登入後「下一次打開同一部作品」時補寫到後端並清掉本機資料
// （lazy 合併，不需要另外掛登入 hook，也不用一次掃過所有作品）。
export function useReadingRecords(projectPublicId?: string) {
  const { session, loading: authLoading } = useAuth();
  const encryptKey = session?.encrypt_key;
  const queryClient = useQueryClient();
  const serverQuery = useStorytellerReadingRecords(projectPublicId);
  const queryKey = storytellerReadingRecordsQueryKey(
    projectPublicId,
    session?.user.id,
  );

  // 換作品時在 render 階段重新載入本機紀錄（React 官方建議的「依 props 調整 state」寫法）
  const [localProjectId, setLocalProjectId] = useState(projectPublicId);
  const [localProgress, setLocalProgress] = useState(() =>
    loadLocalReadingProgress(projectPublicId),
  );
  // 登入讀者剛回報、還沒寫回後端的進度，先疊在畫面上，列表不用等 debounce 才更新
  const [optimistic, setOptimistic] = useState<ReaderProgressMap>({});
  if (localProjectId !== projectPublicId) {
    setLocalProjectId(projectPublicId);
    setLocalProgress(loadLocalReadingProgress(projectPublicId));
    setOptimistic({});
  }

  const progressMap = encryptKey
    ? unionProgress(fromServerRecords(serverQuery.data ?? []), optimistic)
    : localProgress;
  // 進度資料就緒才做「回到上次位置」：登入狀態還沒確定、或後端紀錄還沒回來時都不算
  const ready =
    !authLoading &&
    (!encryptKey || serverQuery.isSuccess || serverQuery.isError);

  // flush 會在 cleanup／離開頁面時呼叫，拿不到當下 render 的值，所以把最新的連線資訊放 ref
  const pendingRef = useRef<ReaderProgressMap>({});
  const flushTimerRef = useRef<number | null>(null);
  const latestRef = useRef({ encryptKey, projectPublicId, queryKey });
  useEffect(() => {
    latestRef.current = { encryptKey, projectPublicId, queryKey };
  });

  // beacon=true 用在分頁被藏起來／關閉時：改走 fetch keepalive，送出就好、不等回應
  const flush = (beacon = false) => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const {
      encryptKey: key,
      projectPublicId: pid,
      queryKey: qk,
    } = latestRef.current;
    const pending = pendingRef.current;
    const records = toRecordInputs(pending);
    if (!key || !pid || records.length === 0) {
      return;
    }
    pendingRef.current = {};
    if (beacon) {
      beaconStorytellerReadingRecords(key, pid, records);
      return;
    }
    saveStorytellerReadingRecords(key, pid, records)
      .then((data) => queryClient.setQueryData(qk, data))
      // 背景寫入失敗不打擾讀者（不跳 snack），放回待寫清單，下次回報或離開頁面時再送一次
      .catch(() => {
        pendingRef.current = unionProgress(pending, pendingRef.current);
      });
  };

  // 換作品、登出或離開閱讀頁時，把上一部作品還沒送出的進度寫完
  useEffect(() => () => flush(), [projectPublicId, encryptKey]);

  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === "hidden") {
        flush(true);
      }
    };
    document.addEventListener("visibilitychange", handleHidden);
    window.addEventListener("pagehide", handleHidden);
    return () => {
      document.removeEventListener("visibilitychange", handleHidden);
      window.removeEventListener("pagehide", handleHidden);
    };
  }, []);

  // lazy 合併：登入狀態下打開作品，發現本機還留著未登入時的紀錄，就整批補寫到後端
  useEffect(() => {
    if (!encryptKey || !projectPublicId || !serverQuery.isSuccess) {
      return;
    }
    const local = loadLocalReadingProgress(projectPublicId);
    if (Object.keys(local).length === 0) {
      return;
    }
    saveStorytellerReadingRecords(
      encryptKey,
      projectPublicId,
      toRecordInputs(local),
    )
      .then((data) => {
        saveLocalReadingProgress(projectPublicId, {});
        setLocalProgress({});
        queryClient.setQueryData(
          storytellerReadingRecordsQueryKey(projectPublicId, session?.user.id),
          data,
        );
      })
      .catch(() => undefined);
  }, [encryptKey, projectPublicId, serverQuery.isSuccess]);

  const report = (
    type: StorytellerReadingTargetType,
    publicId: string,
    progress: number,
  ) => {
    if (!projectPublicId) {
      return;
    }
    const key = readingTargetKey(type, publicId);
    if (!shouldRecordProgress(progressMap[key], progress)) {
      return;
    }
    if (!encryptKey) {
      // 未登入：直接寫 localStorage（每次重讀一次，避免多個分頁互相蓋掉）
      const next = mergeProgress(
        loadLocalReadingProgress(projectPublicId),
        key,
        progress,
      );
      saveLocalReadingProgress(projectPublicId, next);
      setLocalProgress(next);
      return;
    }
    setOptimistic((prev) => mergeProgress(prev, key, progress));
    pendingRef.current = mergeProgress(pendingRef.current, key, progress);
    if (flushTimerRef.current === null) {
      flushTimerRef.current = window.setTimeout(
        () => flush(),
        READING_PROGRESS_FLUSH_MS,
      );
    }
  };

  return {
    progressMap,
    ready,
    report,
    storyProgress: (publicId: string) =>
      progressMap[readingTargetKey("story", publicId)],
  };
}

// 進度值穩定 READING_PROGRESS_SETTLE_MS 之後才交給 onSettle；targetId 或數值一變就重新計時，
// 換篇瞬間的暫態值因此不會被記錄。onSettle 放 ref，避免它每次 render 換新參考導致計時器一直重來。
export function useSettledReadingProgress(
  targetId: string | undefined,
  progress: number | null,
  onSettle: (targetId: string, progress: number) => void,
) {
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  });
  useEffect(() => {
    if (!targetId || progress === null) {
      return;
    }
    const timer = window.setTimeout(
      () => onSettleRef.current(targetId, progress),
      READING_PROGRESS_SETTLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [targetId, progress]);
}
