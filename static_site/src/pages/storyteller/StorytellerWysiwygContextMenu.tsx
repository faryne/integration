import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { Editor } from "@tiptap/core";

import {
  findAssetImageAtSelection,
  wysiwygCommandsByGroup,
  type WysiwygCommand,
  type WysiwygCommandContext,
} from "./wysiwygCore/commands";
import {
  OPEN_ASSET_IMAGE_SETTINGS_EVENT,
  type OpenAssetImageSettingsEventDetail,
} from "./wysiwygCore/assetImageEvents";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface StorytellerWysiwygContextMenuProps {
  editor: Editor;
  position: ContextMenuPosition | null;
  onClose: () => void;
  commandContext: WysiwygCommandContext;
  /** 連結／腳注／註解的「快速移除」是右鍵選單獨有的捷徑（工具列沒有對應按鈕，只能
   * 透過對話框本身的「移除」按鈕），command registry 沒有涵蓋，維持獨立傳入。 */
  onRemoveLink: () => void;
  onRemoveFootnote: () => void;
  onRemoveComment: () => void;
  hasLink: boolean;
  hasFootnote: boolean;
  hasComment: boolean;
  hasSelection: boolean;
  isCurrentParagraphEmpty: boolean;
  hasAssetImage: boolean;
}

/**
 * 右鍵選單（Phase 2：context-aware 化）。依 selection 狀態分兩大類主內容：
 * - 有選取文字：行內樣式（mark／顏色）。
 * - 沒有選取（游標在空白或非空段落）：區塊操作（標題／引用／清單／分隔線／表格列，
 *   空白段落再加插入圖片）。
 *
 * 連結／腳注／註解的「編輯／移除既有 mark」是跨這兩類的例外：只要游標目前落在既有
 * mark 裡（`command.isActive`），不論有沒有選取文字都要顯示，所以獨立算成
 * `annotationItems`，附加在主內容之後，不受兩大類切換影響。「加新的」（沒有選取
 * 文字、游標也不在既有 mark 裡）則不顯示——沒有目標文字可以加註解/連結/腳注。
 */
export function StorytellerWysiwygContextMenu({
  editor,
  position,
  onClose,
  commandContext,
  onRemoveLink,
  onRemoveFootnote,
  onRemoveComment,
  hasLink,
  hasFootnote,
  hasComment,
  hasSelection,
  isCurrentParagraphEmpty,
  hasAssetImage,
}: StorytellerWysiwygContextMenuProps) {
  const runAndClose = (command: WysiwygCommand) => {
    command.run(editor, commandContext);
    onClose();
  };
  const openAssetImageSettings = () => {
    const target = findAssetImageAtSelection(editor);
    if (target) {
      editor.view.dom.dispatchEvent(
        new CustomEvent<OpenAssetImageSettingsEventDetail>(
          OPEN_ASSET_IMAGE_SETTINGS_EVENT,
          { detail: { pos: target.pos } },
        ),
      );
    }
    onClose();
  };
  const deleteAssetImage = () => {
    const target = findAssetImageAtSelection(editor);
    if (target) {
      editor
        .chain()
        .focus()
        .command(({ state, dispatch }) => {
          if (dispatch) {
            dispatch(
              state.tr.delete(target.pos, target.pos + target.node.nodeSize),
            );
          }
          return true;
        })
        .run();
    }
    onClose();
  };

  const textColorCommands = wysiwygCommandsByGroup("color").filter((c) =>
    c.id.startsWith("text-color-"),
  );
  const bgColorCommands = wysiwygCommandsByGroup("color").filter((c) =>
    c.id.startsWith("bg-color-"),
  );
  // 有選取文字時可以「加」新的連結/腳注/註解；沒有選取但游標落在既有 mark 裡時
  // 只能編輯/移除既有的，不顯示「加」——沒有目標文字。
  const annotationCommands = wysiwygCommandsByGroup("annotation").filter(
    (command) =>
      !hasAssetImage &&
      (command.isVisible?.(commandContext) ?? true) &&
      (hasSelection || (command.isActive?.(editor) ?? false)),
  );
  const insertImageCommand = wysiwygCommandsByGroup("insert").find(
    (c) => c.id === "insert-image",
  );
  const showInsertImage =
    isCurrentParagraphEmpty &&
    (insertImageCommand?.isVisible?.(commandContext) ?? false);
  const alignCommands = wysiwygCommandsByGroup("align");
  const imageLayoutCommands = wysiwygCommandsByGroup("image-layout");

  const quickRemoveFor: Record<
    string,
    { label: string; onClick: () => void } | undefined
  > = {
    link: hasLink ? { label: "移除連結", onClick: onRemoveLink } : undefined,
    footnote: hasFootnote
      ? { label: "移除腳注", onClick: onRemoveFootnote }
      : undefined,
    comment: hasComment
      ? { label: "移除註解", onClick: onRemoveComment }
      : undefined,
  };

  return (
    <Menu
      open={position !== null}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={
        position ? { top: position.y, left: position.x } : undefined
      }
    >
      {hasAssetImage
        ? [
            <MenuItem key="asset-image-settings" onClick={openAssetImageSettings}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>圖片設定</ListItemText>
            </MenuItem>,
            <MenuItem key="asset-image-delete" onClick={deleteAssetImage}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>刪除圖片</ListItemText>
            </MenuItem>,
            <Divider key="asset-image-layout-divider" />,
            ...imageLayoutCommands.map((command) => {
              const Icon = command.icon!;
              return (
                <MenuItem
                  key={command.id}
                  selected={command.isActive?.(editor) ?? false}
                  onClick={() => runAndClose(command)}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{command.label}</ListItemText>
                </MenuItem>
              );
            }),
          ]
        : hasSelection
        ? [
            ...wysiwygCommandsByGroup("mark").map((command) => {
              const Icon = command.icon!;
              return (
                <MenuItem
                  key={command.id}
                  selected={command.isActive?.(editor) ?? false}
                  onClick={() => runAndClose(command)}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{command.label}</ListItemText>
                </MenuItem>
              );
            }),
            <Divider key="mark-color-divider" />,
            <Typography
              key="text-color-label"
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", px: 2, pt: 1 }}
            >
              文字顏色
            </Typography>,
            <Stack
              key="text-color-swatches"
              direction="row"
              spacing={1}
              sx={{ px: 2, py: 1 }}
            >
              {textColorCommands
                .filter((c) => c.id !== "text-color-clear")
                .map((command) => (
                  <Tooltip key={command.id} title={command.label}>
                    <Box
                      component="button"
                      type="button"
                      aria-label={command.label}
                      aria-pressed={command.isActive?.(editor) ?? false}
                      onClick={() => runAndClose(command)}
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "2px solid",
                        borderColor: command.isActive?.(editor)
                          ? "text.primary"
                          : "divider",
                        bgcolor: command.previewColor,
                        cursor: "pointer",
                        p: 0,
                      }}
                    />
                  </Tooltip>
                ))}
            </Stack>,
            <MenuItem
              key="text-color-clear"
              onClick={() =>
                runAndClose(getColorClearCommand(textColorCommands))
              }
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>清除文字顏色</ListItemText>
            </MenuItem>,
            <Divider key="bg-color-divider" />,
            <Typography
              key="bg-color-label"
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", px: 2, pt: 1 }}
            >
              文字背景色
            </Typography>,
            <Stack
              key="bg-color-swatches"
              direction="row"
              spacing={1}
              sx={{ px: 2, py: 1 }}
            >
              {bgColorCommands
                .filter((c) => c.id !== "bg-color-clear")
                .map((command) => (
                  <Tooltip key={command.id} title={command.label}>
                    <Box
                      component="button"
                      type="button"
                      aria-label={command.label}
                      aria-pressed={command.isActive?.(editor) ?? false}
                      onClick={() => runAndClose(command)}
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "2px solid",
                        borderColor: command.isActive?.(editor)
                          ? "text.primary"
                          : "divider",
                        bgcolor: command.previewColor,
                        cursor: "pointer",
                        p: 0,
                      }}
                    />
                  </Tooltip>
                ))}
            </Stack>,
            <MenuItem
              key="bg-color-clear"
              onClick={() =>
                runAndClose(getColorClearCommand(bgColorCommands))
              }
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>清除背景色</ListItemText>
            </MenuItem>,
          ]
        : [
            ...wysiwygCommandsByGroup("heading").map((command) => {
              const Icon = command.icon!;
              return (
                <MenuItem
                  key={command.id}
                  selected={command.isActive?.(editor) ?? false}
                  onClick={() => runAndClose(command)}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{command.label}</ListItemText>
                </MenuItem>
              );
            }),
            <Divider key="heading-block-divider" />,
            ...alignCommands.map((command) => {
              const Icon = command.icon!;
              return (
                <MenuItem
                  key={command.id}
                  selected={command.isActive?.(editor) ?? false}
                  onClick={() => runAndClose(command)}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{command.label}</ListItemText>
                </MenuItem>
              );
            }),
            <Divider key="align-block-divider" />,
            ...wysiwygCommandsByGroup("block").map((command) => {
              const Icon = command.icon!;
              return (
                <MenuItem
                  key={command.id}
                  selected={command.isActive?.(editor) ?? false}
                  onClick={() => runAndClose(command)}
                >
                  <ListItemIcon>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{command.label}</ListItemText>
                </MenuItem>
              );
            }),
            ...(showInsertImage && insertImageCommand
              ? (() => {
                  const InsertImageIcon = insertImageCommand.icon!;
                  return [
                    <Divider key="insert-divider" />,
                    <MenuItem
                      key={insertImageCommand.id}
                      onClick={() => runAndClose(insertImageCommand)}
                    >
                      <ListItemIcon>
                        <InsertImageIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>{insertImageCommand.label}</ListItemText>
                    </MenuItem>,
                  ];
                })()
              : []),
          ]}

      {annotationCommands.length > 0 && <Divider />}
      {annotationCommands.flatMap((command) => {
        const Icon = command.icon!;
        const isActive = command.isActive?.(editor) ?? false;
        const label =
          isActive && command.activeLabel ? command.activeLabel : command.label;
        const isEnabled = command.isEnabled?.(editor, commandContext) ?? true;
        const quickRemove = quickRemoveFor[command.id];
        const items = [
          <MenuItem
            key={command.id}
            disabled={!isEnabled}
            onClick={() => runAndClose(command)}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>,
        ];
        if (quickRemove) {
          items.push(
            <MenuItem
              key={`${command.id}-remove`}
              onClick={() => {
                onClose();
                quickRemove.onClick();
              }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{quickRemove.label}</ListItemText>
            </MenuItem>,
          );
        }
        return items;
      })}
    </Menu>
  );
}

function getColorClearCommand(
  commands: ReturnType<typeof wysiwygCommandsByGroup>,
) {
  const clear = commands.find((c) => c.id.endsWith("-clear"));
  if (!clear) {
    throw new Error("color clear command not found in registry");
  }
  return clear;
}
