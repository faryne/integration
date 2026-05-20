import { Typography, Divider } from "@mui/material";

export function Footer() {
  return (
    <footer>
      <Divider textAlign={"left"} />
      <Typography variant={"body2"} color="text.secondary">
        Powered By Faryne |{" "}
        <Typography
          component={"a"}
          variant={"body2"}
          href={"https://faryne.dev/"}
          sx={{ color: 'inherit', textDecoration: 'underline' }}
        >
          faryne.dev
        </Typography>
      </Typography>
    </footer>
  );
}
