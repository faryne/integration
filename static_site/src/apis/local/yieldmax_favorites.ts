import { useState } from "react";

// YieldMax 沒有登入機制，收藏清單直接存在瀏覽器 localStorage，不經過後端
const storageKey = "faryne.yieldmax.favorites";

function readFavorites(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavorites(codes: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(codes));
}

export function useYieldMaxFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(readFavorites()),
  );

  const toggleFavorite = (code: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      writeFavorites([...next]);
      return next;
    });
  };

  return { favorites, toggleFavorite };
}
