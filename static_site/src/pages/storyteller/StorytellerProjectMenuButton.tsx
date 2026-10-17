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
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  useDeleteStorytellerProject,
  useSaveStorytellerProject,
} from "@/apis/storyteller.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerConfirmNameDialog } from "@/components/storyteller/StorytellerConfirmNameDialog.tsx";
import { STORYTELLER_VISIBILITY_LABELS } from "@/data/storyteller.ts";
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
  { value: "private", label: "設為私密", icon: <LockIcon fontSize="small" /> },
  {
    value: "unlisted",
    label: "設為分享",
    icon: <PeopleIcon fontSize="small" />,
  },
  { value: "public", label: "設為公開", icon: <PublicIcon fontSize="small" /> },
] as const;

// 專案卡片右上的「⋯」：切換公開狀態、編輯、刪除（輸入專案名稱確認，後端 soft delete）。
// 網站首頁與 SteamLoom Writer 共用；Writer 不走網站路由，所以用 onEdit 取代連結、
// 用 onChanged 通知它重抓列表（網站靠 react-query invalidate，不需要傳）。
export function StorytellerProjectMenuButton({
  project,
  onEdit,
  onChanged,
}: {
  project: StorytellerProjectMenuTarget;
  onEdit?: () => void;
  onChanged?: () => void;
}) {
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
            message: `專案已設為${STORYTELLER_VISIBILITY_LABELS[visibility]}。`,
            severity: "success",
          });
          onChanged?.();
        },
        onError: () =>
          setSnack({
            message: "專案公開狀態更新失敗，請重試。",
            severity: "error",
          }),
      },
    );
  }

  return (
    <>
      <IconButton
        aria-label={`${project.name}專案操作`}
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
        {visibilityItems.map((item) => (
          <MenuItem
            key={item.value}
            selected={project.visibility === item.value}
            disabled={saveProject.isPending}
            onClick={() => changeVisibility(item.value)}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
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
            <ListItemText>編輯專案</ListItemText>
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
            <ListItemText>編輯專案</ListItemText>
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
          <ListItemText>刪除專案</ListItemText>
        </MenuItem>
      </Menu>
      {deleting && (
        <StorytellerConfirmNameDialog
          open
          title="刪除專案"
          description="刪除後會移除專案與底下故事資料。請輸入專案名稱確認。"
          confirmName={project.name}
          confirmLabel="刪除專案"
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
        message="刪除專案失敗，請確認登入狀態後再試一次。"
        severity="error"
        onClose={() => deleteProject.reset()}
      />
    </>
  );
}
