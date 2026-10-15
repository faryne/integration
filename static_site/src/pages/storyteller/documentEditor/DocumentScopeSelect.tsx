import CropFreeIcon from "@mui/icons-material/CropFree";
import { MenuItem, TextField } from "@mui/material";
import { useEffect, useState } from "react";
import type { DocumentSection } from "@/pages/storyteller/documentEditor/documentSections.ts";
import type { DocumentScopeState } from "@/pages/storyteller/documentEditor/useDocumentScope.ts";

// 「編輯範圍」選單：全文，或依標題層級縮排列出各章。章節清單在打開選單、換範圍時才解析（不跟著每次打字重算）
export function DocumentScopeSelect({
  scope,
  label,
  fullLabel,
}: {
  scope: DocumentScopeState;
  label: string;
  fullLabel: string;
}) {
  const [sections, setSections] = useState<DocumentSection[]>(scope.sections);
  const { activeMarkerId } = scope;
  useEffect(() => {
    setSections(scope.sections());
    // scope 物件每次 render 都是新的，只在換範圍時重抓
  }, [activeMarkerId]);
  if (!scope.available) return null;

  return (
    <TextField
      select
      size="small"
      variant="standard"
      label={label}
      value={activeMarkerId ?? ""}
      onChange={(event) => scope.select(event.target.value || null)}
      slotProps={{
        select: {
          onOpen: () => setSections(scope.sections()),
          displayEmpty: true,
          renderValue: (value) =>
            sections.find((section) => section.markerId === value)?.title ||
            fullLabel,
        },
        inputLabel: { shrink: true },
      }}
      sx={{ minWidth: 160, maxWidth: 280 }}
    >
      <MenuItem value="">{fullLabel}</MenuItem>
      {sections.map((section) => (
        <MenuItem
          key={section.markerId}
          value={section.markerId}
          sx={{ pl: 1 + section.level * 1.5, gap: 1 }}
        >
          {section.markerId === activeMarkerId && (
            <CropFreeIcon fontSize="small" color="primary" />
          )}
          {section.title || "（無標題文字）"}
        </MenuItem>
      ))}
    </TextField>
  );
}
