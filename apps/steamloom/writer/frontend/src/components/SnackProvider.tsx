import { Alert, Snackbar, type AlertColor } from "@mui/material";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// 全域提示：任何 API／Go 綁定呼叫失敗都透過 useSnack().showError 跳出 snack；存檔成功這類回饋用 showSuccess，
// 不擋操作的提醒（例如公開時內文連到未公開的設定）用 showWarning。
type Snack = { showError: (message: string) => void; showSuccess: (message: string) => void; showWarning: (message: string) => void };
const SnackContext = createContext<Snack>({ showError: () => {}, showSuccess: () => {}, showWarning: () => {} });

export const useSnack = () => useContext(SnackContext);

export function SnackProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<{ message: string; severity: AlertColor } | null>(null);
  const showError = useCallback((message: string) => setSnack({ message, severity: "error" }), []);
  const showSuccess = useCallback((message: string) => setSnack({ message, severity: "success" }), []);
  const showWarning = useCallback((message: string) => setSnack({ message, severity: "warning" }), []);
  return (
    <SnackContext.Provider value={{ showError, showSuccess, showWarning }}>
      {children}
      <Snackbar
        open={snack !== null}
        // 成功訊息只是確認，比錯誤早點收掉
        autoHideDuration={snack?.severity === "success" ? 2500 : 6000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack?.severity ?? "error"} variant="filled" onClose={() => setSnack(null)}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </SnackContext.Provider>
  );
}
