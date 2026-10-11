import { Alert, Snackbar } from "@mui/material";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// 全域錯誤提示：任何 API／Go 綁定呼叫失敗都透過 useSnack().showError 跳出 snack。
const SnackContext = createContext<{ showError: (message: string) => void }>({ showError: () => {} });

export const useSnack = () => useContext(SnackContext);

export function SnackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const showError = useCallback((next: string) => setMessage(next), []);
  return (
    <SnackContext.Provider value={{ showError }}>
      {children}
      <Snackbar
        open={message !== null}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      </Snackbar>
    </SnackContext.Provider>
  );
}
