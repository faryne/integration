import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  TextField,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CommentRef } from "@/pages/storyteller/wysiwygCore/commentRefs.ts";
import {
  commentRefKey,
  useCommentRefTargets,
  type CommentRefTarget,
} from "./useCommentRefTargets.ts";

// 每組最多列幾筆：沒打字時是「最近更新」，打字後是標題比對結果
const GROUP_LIMIT = 20;

// 挑一篇故事或設定當註解參照。清單在前端過濾（故事／設定清單已經載入），不另打搜尋 API；
// 圖像作品沒有文字內容，參照卡顯示不了，不列。
export function CommentRefPickerDialog({
  open,
  projectPublicId,
  selected,
  onPick,
  onClose,
}: {
  open: boolean;
  projectPublicId?: string;
  selected: CommentRef[];
  onPick: (ref: CommentRef) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const { targets } = useCommentRefTargets(open ? projectPublicId : undefined);
  const groups = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    const matched = [...targets.values()]
      .filter(
        (target) =>
          !target.isImage &&
          (!needle || target.title.toLowerCase().includes(needle)),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return [
      {
        label: t("web.commentRef.story"),
        items: matched
          .filter((target) => target.kind === "story")
          .slice(0, GROUP_LIMIT),
      },
      {
        label: t("web.commentRef.lore"),
        items: matched
          .filter((target) => target.kind === "lore")
          .slice(0, GROUP_LIMIT),
      },
    ].filter((group) => group.items.length > 0);
  }, [targets, keyword, t]);
  const selectedKeys = new Set(selected.map(commentRefKey));
  const pick = (target: CommentRefTarget) => {
    onPick({ kind: target.kind, publicId: target.publicId });
    setKeyword("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t("web.commentRef.add")}</DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={t("web.commentRef.searchPlaceholder")}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          sx={{ mt: 0.5 }}
        />
        <List dense sx={{ maxHeight: 360, overflow: "auto", mt: 1 }}>
          {groups.map((group) => [
            <ListSubheader
              key={group.label}
              disableSticky
              sx={{ lineHeight: 2.5, bgcolor: "transparent" }}
            >
              {group.label}
            </ListSubheader>,
            ...group.items.map((target) => (
              <ListItemButton
                key={commentRefKey(target)}
                disabled={selectedKeys.has(commentRefKey(target))}
                onClick={() => pick(target)}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {target.kind === "lore" ? (
                    <AutoStoriesIcon fontSize="small" />
                  ) : (
                    <DescriptionOutlinedIcon fontSize="small" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={target.title}
                  primaryTypographyProps={{ noWrap: true }}
                />
              </ListItemButton>
            )),
          ])}
        </List>
      </DialogContent>
    </Dialog>
  );
}
