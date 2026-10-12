import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MoveTarget } from "@writer/pages/workspace/SidebarActions.tsx";

// 側邊列「建立」的對話框：只問名稱；故事／圖像作品可選要放在哪一冊、設定可選設定集。
// 名稱空白或送出中時「建立」不能按；成功與否由外層 onSubmit 處理（失敗會跳 snack，對話框保留讓使用者重試）。
export function CreateDialog({
  kind,
  groups,
  groupLabel,
  defaultGroup,
  onClose,
  onSubmit,
}: {
  kind: string;
  groups?: MoveTarget[];
  groupLabel?: string;
  defaultGroup?: string;
  onClose: () => void;
  onSubmit: (name: string, group: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [group, setGroup] = useState(defaultGroup ?? "");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = name.trim() !== "" && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const ok = await onSubmit(name.trim(), group);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("workspace.create.title", { kind: t(`workspace.create.kinds.${kind}`) })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            label={t("workspace.create.name")}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              // 輸入法選字中的 Enter 不算送出
              if (event.key === "Enter" && !event.nativeEvent.isComposing) void submit();
            }}
          />
          {groups && (
            <TextField select label={groupLabel} value={group} onChange={(event) => setGroup(event.target.value)}>
              {groups.map((target) => (
                <MenuItem key={target.publicId || "ungrouped"} value={target.publicId}>
                  {target.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t("workspace.create.cancel")}
        </Button>
        <Button variant="contained" onClick={() => void submit()} disabled={!canSubmit}>
          {t("workspace.create.submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
