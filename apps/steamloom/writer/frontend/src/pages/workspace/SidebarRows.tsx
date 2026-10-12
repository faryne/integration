import ArticleIcon from "@mui/icons-material/Article";
import ChatIcon from "@mui/icons-material/Chat";
import FolderIcon from "@mui/icons-material/Folder";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { Box, ButtonBase, Collapse, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useEffect, useState, type ReactNode } from "react";
import type { DocumentItem } from "@/lib/backend.ts";
import { isSameDocument } from "@/pages/workspace/workspaceTree.ts";

// 側邊列的列樣式比照網站工作台：30px 高、選取時左邊一條強調色＋淡底色。
function Row({ depth = 0, selected, onClick, children }: { depth?: number; selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      disabled={!onClick}
      sx={(theme) => ({
        width: "100%",
        height: 30,
        justifyContent: "flex-start",
        gap: 0.75,
        pl: 1.25 + depth * 2,
        pr: 1.5,
        fontSize: 13,
        borderLeft: 3,
        borderColor: selected ? "primary.main" : "transparent",
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.13) : "transparent",
        "&:hover": { bgcolor: selected ? undefined : "action.hover" },
        "& .MuiSvgIcon-root": { fontSize: 16, color: selected ? "primary.main" : "text.secondary" },
      })}
    >
      {children}
    </ButtonBase>
  );
}

const Label = ({ children }: { children: ReactNode }) => (
  <Typography component="span" noWrap sx={{ fontSize: 13, flex: 1, textAlign: "left" }}>
    {children}
  </Typography>
);

// 區塊標題（作品與冊、設定集、資產集）
export function SidebarSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, pt: 1.25, pb: 0.5, color: "text.secondary", "& .MuiSvgIcon-root": { fontSize: 15 } }}>
        {icon}
        <Typography variant="caption" fontWeight={500}>
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );
}

// 側邊列最上方：沒有選文件時就是 AI 助理。
export function AssistantRow({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <Row selected={selected} onClick={onClick}>
      <ChatIcon />
      <Label>{label}</Label>
    </Row>
  );
}

// 單篇故事或設定
export function DocumentRow({ item, depth, selected, onSelect }: { item: DocumentItem; depth: number; selected: DocumentItem | null; onSelect: (item: DocumentItem) => void }) {
  return (
    <Row depth={depth} selected={isSameDocument(selected, item)} onClick={() => onSelect(item)}>
      <ArticleIcon />
      <Label>{item.title}</Label>
    </Row>
  );
}

// 可展開的分組（冊、設定集）；沒有 items 的分組（資產集）只顯示名稱
export function GroupRow({ name, items, selected, onSelect }: { name: string; items?: DocumentItem[]; selected: DocumentItem | null; onSelect?: (item: DocumentItem) => void }) {
  const [open, setOpen] = useState(false);
  // 選取的文件在這個分組裡就自動展開；使用者手動收合不會被蓋回去
  const containsSelected = (items ?? []).some((item) => isSameDocument(selected, item));
  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected]);
  const expandable = Boolean(items?.length && onSelect);
  return (
    <>
      <Row onClick={expandable ? () => setOpen(!open) : undefined}>
        {expandable ? (
          <KeyboardArrowRightIcon sx={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        ) : (
          <FolderIcon />
        )}
        <Label>{name}</Label>
        {items && (
          <Typography component="span" sx={{ fontSize: 12, color: "text.secondary" }}>
            {items.length}
          </Typography>
        )}
      </Row>
      {expandable && (
        <Collapse in={open} unmountOnExit>
          {items!.map((item) => (
            <DocumentRow key={item.public_id} item={item} depth={1} selected={selected} onSelect={onSelect!} />
          ))}
        </Collapse>
      )}
    </>
  );
}
