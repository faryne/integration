import CloseIcon from "@mui/icons-material/Close";
import { Chip } from "@mui/material";
import type { DocumentScope } from "@/pages/storyteller/documentEditor/useDocumentScope.ts";
import { useTranslation } from "react-i18next";

// 只編輯某一章時，分頁列右側的狀態標籤：「只編輯：第二章 ✕」，按 ✕ 回到全文。
// 範圍模式會把其他章藏起來，作者要一眼看得出現在不是全文；進入範圍的入口在大綱面板。
export function DocumentScopeChip({
  scope,
  label,
  backLabel,
  onBack,
}: {
  scope: DocumentScope | null;
  label: string;
  backLabel: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  if (!scope) return null;
  return (
    <Chip
      size="small"
      color="primary"
      variant="outlined"
      label={t("writer:editor.outline.editingOnly", { title: scope.title || t("writer:editor.outline.untitled"), label })}
      onDelete={onBack}
      deleteIcon={<CloseIcon aria-label={backLabel} />}
      sx={{ mb: 1, maxWidth: 320 }}
    />
  );
}
