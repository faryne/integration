import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MoveTarget } from "@/pages/workspace/SidebarActions.tsx";

// 「上傳資產」：先選要放進哪個資產集，按下後由 Go 端開原生選檔視窗（可多選）並直傳 S3。
// onUpload 回傳 true 代表有完成上傳（關閉對話框），使用者在選檔視窗按取消則回 false、保留對話框。
export function UploadDialog({ collections, onClose, onUpload }: { collections: MoveTarget[]; onClose: () => void; onUpload: (collection: string) => Promise<boolean> }) {
  const { t } = useTranslation();
  const [collection, setCollection] = useState("");
  const [uploading, setUploading] = useState(false);

  const upload = async () => {
    setUploading(true);
    const done = await onUpload(collection);
    setUploading(false);
    if (done) onClose();
  };

  return (
    <Dialog open onClose={uploading ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("workspace.upload.title")}</DialogTitle>
      <DialogContent>
        <TextField select fullWidth sx={{ mt: 1 }} label={t("workspace.upload.collection")} value={collection} onChange={(event) => setCollection(event.target.value)} disabled={uploading}>
          {collections.map((target) => (
            <MenuItem key={target.publicId || "uncategorized"} value={target.publicId}>
              {target.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          {t("workspace.upload.cancel")}
        </Button>
        <Button variant="contained" onClick={() => void upload()} disabled={uploading} startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {t("workspace.upload.pick")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
