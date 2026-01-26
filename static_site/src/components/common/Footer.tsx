import { Typography } from "@mui/material";

export function Footer() {
  return (
    <footer style={{ textAlign: "left", width: "100%" }}>
      <Typography component={"a"} variant={"body2"} href={"https://ha2.tw/"}>
        ha2.tw
      </Typography>
      &nbsp; / &nbsp;
      <Typography
        component={"a"}
        variant={"body2"}
        href={"https://faryne.dev/"}
      >
        Faryne
      </Typography>
    </footer>
  );
}
