import { Modal, type SxProps, Box } from "@mui/material";
import type { ReactElement, ReactNode } from "react";

export interface ICustomModal {
  open: boolean;
  sx?: SxProps;
  children: ReactElement | ReactNode;
}

export function CustomModal(props: ICustomModal) {
  return (
    <Modal open={props.open}>
      <Box
        sx={{
          position: "absolute" as const,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          // 以下可依專案調整
          width: 400,
          backgroundColor: "background.paper",
          boxShadow: 24,
          borderRadius: 2,
          p: 4,
          ...props.sx,
        }}
      >
        {props.children}
      </Box>
    </Modal>
  );
}
