import AddIcon from "@mui/icons-material/Add";
import { Button, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  COMMENT_REFS_MAX,
  type CommentRef,
} from "@/pages/storyteller/wysiwygCore/commentRefs.ts";
import { CommentRefChip } from "./CommentRefChip.tsx";
import { CommentRefPickerDialog } from "./CommentRefPickerDialog.tsx";
import { commentRefKey, useCommentRefTargets } from "./useCommentRefTargets.ts";

// 註解對話框裡的「參照」區：已選的參照 chip（可移除）＋「加參照」開挑選器
export function CommentRefsField({
  projectPublicId,
  refs,
  onChange,
}: {
  projectPublicId: string;
  refs: CommentRef[];
  onChange: (refs: CommentRef[]) => void;
}) {
  const { t } = useTranslation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const { targets, loaded } = useCommentRefTargets(
    refs.length > 0 ? projectPublicId : undefined,
  );
  return (
    <>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mt: 2, mb: 1 }}
      >
        {t("web.commentRef.title")}
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        alignItems="center"
      >
        {refs.map((ref) => (
          <CommentRefChip
            key={commentRefKey(ref)}
            refItem={ref}
            target={targets.get(commentRefKey(ref))}
            loaded={loaded}
            onDelete={() => onChange(refs.filter((item) => item !== ref))}
          />
        ))}
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={refs.length >= COMMENT_REFS_MAX}
          onClick={() => setPickerOpen(true)}
        >
          {t("web.commentRef.add")}
        </Button>
      </Stack>
      <CommentRefPickerDialog
        open={pickerOpen}
        projectPublicId={projectPublicId}
        selected={refs}
        onClose={() => setPickerOpen(false)}
        onPick={(ref) => {
          onChange([...refs, ref]);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
