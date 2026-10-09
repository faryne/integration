import { useCallback, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { LoginPromptDialog } from "@/components/auth/LoginPromptDialog.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type { ReportTarget } from "@/types/storytellerReport.ts";
import { ReportContext } from "./reportContext.ts";
import { ReportDialog } from "./ReportDialog.tsx";

type Snack = { message: string; severity: "success" | "error" };

// 掛在 StorytellerLayout：未登入先問要不要登入，登入後才開檢舉 dialog。
export function ReportProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [snack, setSnack] = useState<Snack | null>(null);
  const open = useCallback(
    (next: ReportTarget) => (session ? setTarget(next) : setLoginOpen(true)),
    [session],
  );
  // 給 dialog 的 effect 用，必須是穩定的參考
  const onError = useCallback(
    (message: string) => setSnack({ message, severity: "error" }),
    [],
  );

  return (
    <ReportContext.Provider value={open}>
      {children}
      {target && (
        <ReportDialog
          // 換對象時重設表單
          key={`${target.type}:${target.publicId}`}
          target={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            setSnack({ message: "已收到檢舉", severity: "success" });
          }}
          onError={onError}
        />
      )}
      <LoginPromptDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        description="檢舉需要登入。是否要現在登入？"
      />
      <CustomSnackbar
        open={Boolean(snack)}
        message={snack?.message ?? ""}
        severity={snack?.severity ?? "success"}
        onClose={() => setSnack(null)}
      />
    </ReportContext.Provider>
  );
}
