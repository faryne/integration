import { useEffect, useState } from "react";
import type { WorkspaceSection } from "./ProjectWorkspacePreviewTypes.ts";

export type WorkspaceViewMode = "grid" | "list";

const storageKey = "storyteller-workspace-view-modes";
const defaultModes: Record<WorkspaceSection, WorkspaceViewMode> = {
  stories: "list",
  lores: "grid",
  assets: "grid",
};

function initialModes(): Record<WorkspaceSection, WorkspaceViewMode> {
  if (typeof window === "undefined") return defaultModes;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return Object.fromEntries(
      Object.entries(defaultModes).map(([section, fallback]) => [
        section,
        stored[section] === "grid" || stored[section] === "list"
          ? stored[section]
          : fallback,
      ]),
    ) as Record<WorkspaceSection, WorkspaceViewMode>;
  } catch {
    return defaultModes;
  }
}

/** 各資料類型獨立記住 grid/list，切換專案後不必重新設定。 */
export function useWorkspaceViewMode(section: WorkspaceSection) {
  const [modes, setModes] = useState(initialModes);
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(modes));
  }, [modes]);
  return {
    viewMode: modes[section],
    setViewMode: (mode: WorkspaceViewMode) =>
      setModes((current) => ({ ...current, [section]: mode })),
  };
}
