import { Box, Paper, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  parseCommentRefs,
  type CommentRef,
} from "@/pages/storyteller/wysiwygCore/commentRefs.ts";
import { CommentRefChip } from "./CommentRefChip.tsx";
import { commentRefKey, useCommentRefTargets } from "./useCommentRefTargets.ts";

export type HoveredComment = {
  text: string;
  /** 正規化後的 refs 字串（mark 的 data-comment-refs），空字串＝沒有參照 */
  refs: string;
  /** hover 當下註解範圍的 bounding rect（viewport 座標），用來把 tooltip 定位在正下方 */
  rect: DOMRect;
};

/** 編輯區判斷「滑鼠是不是移進 tooltip」用的屬性 */
export const COMMENT_TOOLTIP_ATTR = "data-comment-tooltip";

// 註解 hover 提示。沒有參照時跟以前一樣不攔滑鼠（pointer-events: none）；有參照時要能移進來點 chip，
// 所以 tooltip 貼齊註解底邊、用透明的上內距當「橋」，滑鼠從註解移到 tooltip 的路上不會離開兩者。
export function CommentTooltip({
  hovered,
  projectPublicId,
  onOpenRefs,
  onLeave,
}: {
  hovered: HoveredComment;
  projectPublicId?: string;
  onOpenRefs: (refs: CommentRef[], active: number) => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation();
  const refs = parseCommentRefs(hovered.refs);
  const { targets, loaded } = useCommentRefTargets(
    refs.length > 0 ? projectPublicId : undefined,
  );
  const interactive = refs.length > 0;
  return (
    <Box
      {...{ [COMMENT_TOOLTIP_ATTR]: "" }}
      onMouseLeave={(event) => {
        if (!(
          event.relatedTarget instanceof Element &&
          event.relatedTarget.closest(".wysiwyg-has-comment")
        ))
          onLeave();
      }}
      sx={{
        position: "fixed",
        top: hovered.rect.bottom,
        left: hovered.rect.left,
        zIndex: 9999,
        maxWidth: 340,
        pt: "6px",
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      <Paper elevation={8} sx={{ p: 1.5, bgcolor: "grey.900" }}>
        {hovered.text && (
          <Typography
            variant="body2"
            sx={{ color: "common.white", whiteSpace: "pre-wrap" }}
          >
            {hovered.text}
          </Typography>
        )}
        {interactive && (
          <Stack
            direction="row"
            spacing={0.75}
            useFlexGap
            flexWrap="wrap"
            sx={{ mt: hovered.text ? 1 : 0 }}
          >
            {refs.map((ref, index) => (
              <CommentRefChip
                key={commentRefKey(ref)}
                refItem={ref}
                target={targets.get(commentRefKey(ref))}
                loaded={loaded}
                onClick={() => onOpenRefs(refs, index)}
                sx={{
                  maxWidth: 220,
                  color: "common.white",
                  borderColor: "grey.600",
                }}
              />
            ))}
          </Stack>
        )}
        <Typography
          variant="caption"
          sx={{ color: "grey.400", display: "block", mt: 0.5 }}
        >
          {/* 觸控/鍵盤操作者沒有右鍵，右鍵不是唯一入口（見已知 Bug 記錄第 9 項：觸控裝置的右鍵事件
              已放行給原生長按選字，不會跳出我們的選單）——選取文字後叫出的格式列（bubble menu）
              「加註解」按鈕在選到既有註解時會變成「編輯註解」，對話框裡也有「移除註解」按鈕，
              不寫死成「右鍵」這一種說法。 */}
          {t("web.commentRef.editHelp")}
        </Typography>
      </Paper>
    </Box>
  );
}
