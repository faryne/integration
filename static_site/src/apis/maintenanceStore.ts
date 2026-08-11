import { useSyncExternalStore } from "react";

// 全站維護模式的外部狀態；由 axios interceptor 依 API 回應設定，App.tsx 用 useMaintenanceState() 訂閱。
// 用 useSyncExternalStore 是因為這個狀態的變動來源在 React tree 之外（axios interceptor），
// 不適合塞進某個元件的 useState。
export interface MaintenanceState {
  active: boolean;
  // 維護結束時間（ISO 字串），只有後端走 MAINTENANCE_START／MAINTENANCE_END 時間區間模式時才會有值；
  // 手動開關模式不知道何時恢復，維持 null。
  retryAt: string | null;
}

let state: MaintenanceState = { active: false, retryAt: null };
const listeners = new Set<() => void>();

export function setMaintenanceState(next: {
  active: boolean;
  retryAt?: string | null;
}) {
  const retryAt = next.retryAt ?? null;
  if (state.active === next.active && state.retryAt === retryAt) {
    return;
  }
  state = { active: next.active, retryAt };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

export function useMaintenanceState(): MaintenanceState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
