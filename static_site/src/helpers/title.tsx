import { useEffect } from "react";

export function useTitle(page: string) {
  useEffect(() => {
    document.title = `${page} | ha2.tw / faryne.dev`;
  }, [page]);
}
