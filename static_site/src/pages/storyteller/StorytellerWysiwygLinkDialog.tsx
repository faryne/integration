import LinkOffIcon from "@mui/icons-material/LinkOff";
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useStorytellerLores } from "@/apis/storyteller.ts";
import {
  isSafeHref,
  LORE_URI_PREFIX,
  loreIdFromHref,
} from "./wysiwygCore/whitelist";

type LinkMode = "url" | "lore";

// 編輯器的「加連結／編輯連結」對話框：可以連到外部網址，或連到同專案的某則設定
// （存成 href="steamloom-lore://<id>"，讀者點了會開設定摘要小卡）。
// 開啟時依既有連結預填：既有連結是設定連結就直接切到「設定」模式。
// 父層每次開啟都換 key 重新掛載，所以預填只在初始化 state 時做一次就好。
export function StorytellerWysiwygLinkDialog({
  open,
  initialHref,
  initialTarget,
  initialMode,
  projectPublicId,
  onClose,
  onConfirm,
  onRemove,
}: {
  open: boolean;
  initialHref?: string;
  initialTarget?: string;
  // 從「連到設定」入口打開時直接進設定模式；沒指定就依既有連結判斷
  initialMode?: LinkMode;
  // 沒有專案（例如 WYSIWYG 示範頁）時不提供「設定」模式
  projectPublicId?: string;
  onClose: () => void;
  onConfirm: (href: string, target?: "_blank") => void;
  onRemove: () => void;
}) {
  const initialLoreId = initialHref ? loreIdFromHref(initialHref) : undefined;
  const [mode, setMode] = useState<LinkMode>(
    initialMode ?? (initialLoreId ? "lore" : "url"),
  );
  const [hrefDraft, setHrefDraft] = useState(
    initialLoreId ? "" : (initialHref ?? ""),
  );
  const [openInNewTab, setOpenInNewTab] = useState(initialTarget === "_blank");
  const [loreId, setLoreId] = useState(initialLoreId ?? "");
  // 輸入框文字自己管理：手動打字時要清掉選取，但不能讓 Autocomplete 跟著把打到一半的字清空
  const [loreInput, setLoreInput] = useState("");
  const loresQuery = useStorytellerLores(projectPublicId);
  const lores = loresQuery.data ?? [];
  const selectedLore = lores.find((lore) => lore.public_id === loreId) ?? null;
  const hadExistingLink = Boolean(initialHref);
  const url = hrefDraft.trim();
  const valid = mode === "lore" ? Boolean(selectedLore) : isSafeHref(url);

  const confirm = () => {
    if (!valid) return;
    if (mode === "lore") {
      onConfirm(`${LORE_URI_PREFIX}${loreId}`);
    } else {
      onConfirm(url, openInNewTab ? "_blank" : undefined);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {hadExistingLink ? "編輯連結" : mode === "lore" ? "連到設定" : "加連結"}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {projectPublicId && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={mode}
              onChange={(_, value: LinkMode | null) => value && setMode(value)}
            >
              <ToggleButton value="url">網址</ToggleButton>
              <ToggleButton value="lore">設定</ToggleButton>
            </ToggleButtonGroup>
          )}
          {mode === "lore" ? (
            <>
              <Autocomplete
                options={lores}
                value={selectedLore}
                loading={loresQuery.isLoading}
                onChange={(_, value) => setLoreId(value?.public_id ?? "")}
                inputValue={loreInput}
                // 選好之後又手動改字，就不再算選到那一則：必須重新從清單挑，送出鈕才會開啟
                onInputChange={(_, value, reason) => {
                  // 清掉選取時 MUI 會用空字串觸發 reset，忽略它，讀者打到一半的字才不會消失
                  if (reason === "reset" && value === "") return;
                  setLoreInput(value);
                  if (reason === "input") setLoreId("");
                }}
                getOptionLabel={(lore) =>
                  lore.status === "completed"
                    ? lore.title
                    : `${lore.title}（未公開）`
                }
                isOptionEqualToValue={(option, value) =>
                  option.public_id === value.public_id
                }
                noOptionsText={
                  lores.length === 0 ? "這個專案還沒有設定" : "找不到符合的設定"
                }
                renderInput={(params) => (
                  <TextField {...params} autoFocus label="連到哪一則設定" />
                )}
              />
              <Typography variant="body2" color="text.secondary">
                讀者點了會看到這則設定的摘要。設定還沒公開時，讀者只會看到純文字。
              </Typography>
            </>
          ) : (
            <>
              <TextField
                autoFocus
                fullWidth
                label="網址"
                placeholder="https://..."
                value={hrefDraft}
                onChange={(event) => setHrefDraft(event.target.value)}
                error={url !== "" && !isSafeHref(url)}
                helperText={
                  url !== "" && !isSafeHref(url)
                    ? "只接受 http:// 或 https:// 開頭的網址；要連到設定請切換到「設定」"
                    : undefined
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={openInNewTab}
                    onChange={(event) => setOpenInNewTab(event.target.checked)}
                  />
                }
                label="在新分頁開啟"
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {hadExistingLink && (
          <Button
            color="error"
            onClick={onRemove}
            startIcon={<LinkOffIcon fontSize="small" />}
            sx={{ mr: "auto" }}
          >
            移除連結
          </Button>
        )}
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" onClick={confirm} disabled={!valid}>
          {hadExistingLink ? "更新連結" : "新增連結"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
