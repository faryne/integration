const workspaceSearchHistoryLimit = 8;
const workspaceSearchHistoryMaxAgeMs = 90 * 24 * 60 * 60 * 1000;

interface WorkspaceSearchHistoryEntry {
  keyword: string;
  searchedAt: number;
}

function workspaceSearchHistoryKey(projectPublicId: string) {
  return `steamloom:workspace-search-history:${projectPublicId}`;
}

export function readWorkspaceSearchHistory(projectPublicId: string) {
  return readWorkspaceSearchHistoryEntries(projectPublicId).map(
    (entry) => entry.keyword,
  );
}

function readWorkspaceSearchHistoryEntries(projectPublicId: string) {
  if (!projectPublicId || typeof window === "undefined") {
    return [];
  }
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(workspaceSearchHistoryKey(projectPublicId)) ??
        "[]",
    ) as WorkspaceSearchHistoryEntry[];
    const oldestAllowed = Date.now() - workspaceSearchHistoryMaxAgeMs;
    return parsed
      .filter(
        (entry) =>
          typeof entry?.keyword === "string" &&
          entry.keyword.trim() !== "" &&
          Number.isFinite(entry.searchedAt) &&
          entry.searchedAt >= oldestAllowed,
      )
      .slice(0, workspaceSearchHistoryLimit);
  } catch {
    return [];
  }
}

export function saveWorkspaceSearchHistory(
  projectPublicId: string,
  keyword: string,
) {
  keyword = keyword.trim();
  if (!projectPublicId || !keyword || typeof window === "undefined") {
    return readWorkspaceSearchHistory(projectPublicId);
  }
  const entries = readWorkspaceSearchHistoryEntries(projectPublicId).filter(
    (entry) =>
      entry.keyword.toLocaleLowerCase("zh-TW") !==
      keyword.toLocaleLowerCase("zh-TW"),
  );
  entries.unshift({ keyword, searchedAt: Date.now() });
  const next = entries.slice(0, workspaceSearchHistoryLimit);
  try {
    window.localStorage.setItem(
      workspaceSearchHistoryKey(projectPublicId),
      JSON.stringify(next),
    );
  } catch {
    // localStorage 被停用或容量不足不該影響搜尋本身。
  }
  return next.map((entry) => entry.keyword);
}
