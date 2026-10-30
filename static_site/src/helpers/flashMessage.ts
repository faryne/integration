import { useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * 換頁後要顯示一次的提示（例如審核完跳到下一筆時的「已核准」）：
 * 由 navigate(..., { state: { flash } }) 帶過來，關掉後同一次瀏覽不再出現
 */
export function useFlashMessage() {
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash ?? null;
  const [closedKey, setClosedKey] = useState<string | null>(null);
  return {
    message: closedKey === location.key ? null : flash,
    close: () => setClosedKey(location.key),
  };
}
