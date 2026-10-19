import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PeopleIcon from "@mui/icons-material/People";
import PublicIcon from "@mui/icons-material/Public";
import {
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useSaveStorytellerProject,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type { StorytellerProject } from "@/types/storyteller.ts";

// 選單只需要這些欄位（切換公開狀態是整包 PUT，slug／rating／tags 一定要帶回去，否則會被清空）；
// Writer 的專案型別不是完整的 StorytellerProject，所以不要求整個物件。
export type StorytellerProjectMenuTarget = Pick<
  StorytellerProject,
  | "public_id"
  | "name"
  | "slug"
  | "description"
  | "visibility"
  | "rating"
  | "tags"
>;

const visibilityItems = [
  { value: "private", label: "writer.projectMenu.private", icon: <LockIcon fontSize="small" /> },
  {
    value: "unlisted",
    label: "writer.projectMenu.unlisted",
    icon: <PeopleIcon fontSize="small" />,
  },
  { value: "public", label: "writer.projectMenu.public", icon: <PublicIcon fontSize="small" /> },
] as const;

// 專案卡片右上的「⋯」：切換公開狀態、編輯、刪除（輸入專案名稱確認，後端 soft delete）。
// 網站首頁與 SteamLoom Writer 共用；Writer 不走網站路由，所以用 onEdit 取代連結、
// 用 onChanged 通知它重抓列表（網站靠 react-query invalidate，不需要傳）。
export function StorytellerProjectMenuButton({
  project,
  onEdit,
  onChanged,
  extraItems,
}: {
  project: StorytellerProjectMenuTarget;
  onEdit?: () => void;
  onChanged?: () => void;
  // 宿主（SteamLoom Writer）額外的項目，例如「在網站上開啟」「匯出備份」；放在選單最上方
  extraItems?: {
    key: string;
    label: string;
    icon: ReactNode;
    onClick: () => void;
  }[];
}) {
  const { t } = useTranslation();
  const saveProject = useSaveStorytellerProject();
  const deleteProject = useDeleteStorytellerProject();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState<{
    message: string;
    severity: "success" | "error";
  }>({ message: "", severity: "success" });
  const close = () => setAnchorEl(null);

  // PUT 是整包覆蓋：帶回目前的欄位、不帶封面欄位（省略＝不變更）
  function changeVisibility(visibility: StorytellerProject["visibility"]) {
    close();
    if (visibility === project.visibility) return;
    saveProject.mutate(
      {
        publicId: project.public_id,
        input: {
          name: project.name,
          slug: project.slug,
          description: project.description,
          visibility,
          rating: project.rating,
          tags: project.tags ?? [],
        },
      },
      {
        onSuccess: () => {
          setSnack({
            message: t("writer.projectMenu.statusUpdated", { visibility: t(`writer.projectForm.visibilitySummary.${visibility}`) }),
            severity: "success",
          });
          onChanged?.();
        },
        onError: () =>
          setSnack({
            message: t("writer.projectMenu.statusFailed"),
            severity: "error",
          }),
      },
    );
  }

  return (
    <>
      <IconButton
        aria-label={t("writer.projectMenu.actions", { name: project.name })}
        onClick={(event) => {
          // 卡片本身可點擊進入專案，選單按鈕不能把點擊傳上去
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={close}
        onClick={(event) => event.stopPropagation()}
        slotProps={{ paper: { sx: { minWidth: 210 } } }}
      >
        {extraItems?.length
          ? [
              ...extraItems.map((item) => (
                <MenuItem
                  key={item.key}
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText>{item.label}</ListItemText>
                </MenuItem>
              )),
              <Divider key="extra-divider" />,
            ]
          : null}
        {visibilityItems.map((item) => (
          <MenuItem
            key={item.value}
            selected={project.visibility === item.value}
            disabled={saveProject.isPending}
            onClick={() => changeVisibility(item.value)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{t(item.label)}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        {onEdit ? (
          <MenuItem
            onClick={() => {
              close();
              onEdit();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("writer.projectMenu.edit")}</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem
            component={RouterLink}
            to={steamloomPath(`my/workspace/${project.public_id}/edit`)}
            onClick={close}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t("writer.projectMenu.edit")}</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            close();
            setDeleting(true);
          }}
        >
          <ListItemIcon sx={{ color: "inherit" }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("writer.projectMenu.delete")}</ListItemText>
        </MenuItem>
      </Menu>
      {deleting && (
        <StorytellerConfirmNameDialog
          open
          title={t("writer.projectMenu.delete")}
          description={t("writer.projectMenu.deleteDescription")}
          confirmName={project.name}
          confirmLabel={t("writer.projectMenu.delete")}
          loading={deleteProject.isPending}
          onClose={() => setDeleting(false)}
          onConfirm={() => {
            deleteProject.mutate(project.public_id, {
              onSuccess: () => {
                setDeleting(false);
                onChanged?.();
              },
            });
          }}
        />
      )}
      <CustomSnackbar
        open={Boolean(snack.message)}
        message={snack.message}
        severity={snack.severity}
        onClose={() => setSnack((prev) => ({ ...prev, message: "" }))}
      />
      <CustomSnackbar
        open={deleteProject.isError}
        message={t("writer.projectMenu.deleteFailed")}
        severity="error"
        onClose={() => deleteProject.reset()}
      />
    </>
  );
}
