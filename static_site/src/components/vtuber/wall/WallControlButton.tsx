import { IconButton } from "@mui/material";
import type { ReactNode } from "react";

interface WallControlButtonProps {
  label: string;
  icon: ReactNode;
  active?: boolean; // 開著的狀態（有聲音、暫停中）：換成主題色，一眼看得出來
  size?: "small" | "medium";
  className?: string;
  onClick: () => void;
}

/** 電視牆格子上的圓形控制鈕（聲音、暫停、移除、關閉）；擋掉點擊冒泡，按鈕不會順便觸發格子全螢幕 */
export function WallControlButton({
  label,
  icon,
  active,
  size = "small",
  className,
  onClick,
}: WallControlButtonProps) {
  return (
    <IconButton
      size={size}
      aria-label={label}
      title={label}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        color: active ? "common.black" : "common.white",
        bgcolor: active ? "primary.main" : "rgba(0,0,0,.6)",
        "&:hover": { bgcolor: active ? "primary.light" : "rgba(0,0,0,.8)" },
      }}
    >
      {icon}
    </IconButton>
  );
}
