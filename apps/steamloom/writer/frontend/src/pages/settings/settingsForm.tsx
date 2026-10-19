import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

export interface SettingsFormController {
  dirty: boolean;
  canSave: boolean;
  saving: boolean;
  save: () => Promise<void>;
  discard: () => void;
}

interface SettingsFormContextValue {
  register: (controller: SettingsFormController | null) => void;
  requestNavigation: (action: () => void) => void;
}

const SettingsFormContext = createContext<SettingsFormContextValue | null>(null);

export function SettingsFormContextProvider({ value, children }: { value: SettingsFormContextValue; children: ReactNode }) {
  return <SettingsFormContext.Provider value={value}>{children}</SettingsFormContext.Provider>;
}

// 每個設定表單只回報 dirty/save/discard；固定按鈕與離開攔截一律由 SettingsPage 外框處理。
export function useSettingsForm(controller: SettingsFormController) {
  const context = useContext(SettingsFormContext);
  if (!context) throw new Error("useSettingsForm must be used inside SettingsPage");
  const latest = useRef(controller);
  latest.current = controller;
  // save/discard 透過 ref 呼叫最新閉包；只有按鈕狀態真的改變時才重新登記，避免父子 render 互相觸發。
  const registered = useMemo<SettingsFormController>(() => ({
    dirty: controller.dirty,
    canSave: controller.canSave,
    saving: controller.saving,
    save: () => latest.current.save(),
    discard: () => latest.current.discard(),
  }), [controller.canSave, controller.dirty, controller.saving]);
  useEffect(() => {
    context.register(registered);
    return () => context.register(null);
  }, [context, registered]);
}

export function useSettingsNavigation() {
  const context = useContext(SettingsFormContext);
  if (!context) throw new Error("useSettingsNavigation must be used inside SettingsPage");
  return useMemo(() => context.requestNavigation, [context]);
}
