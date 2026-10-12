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
// extra 是列右側的操作（排序箭頭、移動選單），放在可點區域旁邊而不是裡面，避免 button 包 button；
// extraAlways=false 時只在滑鼠移過去才出現（⋮ 選單），排序模式下的箭頭則一直顯示。
function Row({
  depth = 0,
  selected,
  onClick,
  extra,
  extraAlways = false,
  children,
}: {
  depth?: number;
  selected?: boolean;
  onClick?: () => void;
  extra?: ReactNode;
  extraAlways?: boolean;
  children: ReactNode;
}) {
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        alignItems: "center",
        height: 30,
        borderLeft: 3,
        borderColor: selected ? "primary.main" : "transparent",
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.13) : "transparent",
        "&:hover": { bgcolor: selected ? undefined : "action.hover" },
        "& .row-extra": { opacity: extraAlways ? 1 : 0 },
        "&:hover .row-extra, & .row-extra:focus-within": { opacity: 1 },
        "& .MuiSvgIcon-root": { fontSize: 16, color: selected ? "primary.main" : "text.secondary" },
      })}
    >
      <ButtonBase
        onClick={onClick}
        disabled={!onClick}
        sx={{ flex: 1, minWidth: 0, height: "100%", justifyContent: "flex-start", gap: 0.75, pl: 1.25 + depth * 2, pr: extra ? 0.5 : 1.5, fontSize: 13 }}
      >
        {children}
      </ButtonBase>
      {extra && (
        <Box className="row-extra" sx={{ display: "flex", alignItems: "center", pr: 0.5 }}>
          {extra}
        </Box>
      )}
    </Box>
  );
}

const Label = ({ children }: { children: ReactNode }) => (
  <Typography component="span" noWrap sx={{ fontSize: 13, flex: 1, textAlign: "left" }}>
    {children}
  </Typography>
);

// 區塊標題（作品與冊、設定集、資產集）；actions 是標題右側的排序／建立按鈕
export function SidebarSection({ icon, title, actions, children }: { icon: ReactNode; title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, pl: 1.5, pr: 0.5, pt: 0.75, pb: 0.25, minHeight: 34, color: "text.secondary", "& > .MuiSvgIcon-root": { fontSize: 15 } }}>
        {icon}
        <Typography variant="caption" fontWeight={500} sx={{ flex: 1 }}>
          {title}
        </Typography>
        {actions}
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
export function DocumentRow({
  item,
  depth,
  selected,
  onSelect,
  extra,
  extraAlways,
}: {
  item: DocumentItem;
  depth: number;
  selected: DocumentItem | null;
  onSelect: (item: DocumentItem) => void;
  extra?: ReactNode;
  extraAlways?: boolean;
}) {
  return (
    <Row depth={depth} selected={isSameDocument(selected, item)} onClick={() => onSelect(item)} extra={extra} extraAlways={extraAlways}>
      <ArticleIcon />
      <Label>{item.title}</Label>
    </Row>
  );
}

// 可展開的分組（冊、設定集）；沒有 items 的分組（資產集）只顯示名稱。
// extra 是分組本身的操作（排序箭頭），itemExtra 產生每一篇文件右側的操作（排序箭頭或移動選單）。
export function GroupRow({
  name,
  items,
  selected,
  onSelect,
  extra,
  itemExtra,
  extraAlways,
}: {
  name: string;
  items?: DocumentItem[];
  selected: DocumentItem | null;
  onSelect?: (item: DocumentItem) => void;
  extra?: ReactNode;
  itemExtra?: (item: DocumentItem, index: number) => ReactNode;
  extraAlways?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // 選取的文件在這個分組裡就自動展開；使用者手動收合不會被蓋回去
  const containsSelected = (items ?? []).some((item) => isSameDocument(selected, item));
  useEffect(() => {
    if (containsSelected) setOpen(true);
  }, [containsSelected]);
  const expandable = Boolean(items?.length && onSelect);
  return (
    <>
      <Row onClick={expandable ? () => setOpen(!open) : undefined} extra={extra} extraAlways={extraAlways}>
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
          {items!.map((item, index) => (
            <DocumentRow
              key={item.public_id}
              item={item}
              depth={1}
              selected={selected}
              onSelect={onSelect!}
              extra={itemExtra?.(item, index)}
              extraAlways={extraAlways}
            />
          ))}
        </Collapse>
      )}
    </>
  );
}
