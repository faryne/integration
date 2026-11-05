import { Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export interface IndependentFooterProps {
  service_name: string; // 服務名稱
  // 獨立服務可自行補品牌首頁與社群入口，不把特定站台連結寫死在共用 footer。
  service_href?: string;
  links?: ReadonlyArray<{
    href: string;
    label: string;
    /** 站內頁面：同一頁切換（SPA 路由），不開新分頁 */
    internal?: boolean;
  }>;
}

export default function IndependentFooter(props: IndependentFooterProps) {
  return (
    <Stack
      spacing={0.75}
      alignItems="flex-start"
      sx={{
        width: "100%",
        py: 2,
        textAlign: "left",
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: "100%" }}
      >
        {props.service_href ? (
          <Typography
            component="a"
            variant="body2"
            href={props.service_href}
            sx={{ color: "inherit", textDecoration: "underline" }}
          >
            {props.service_name}
          </Typography>
        ) : (
          props.service_name
        )}{" "}
        powered by Faryne |{" "}
        <Typography
          component="a"
          variant="body2"
          href="https://faryne.dev/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", textDecoration: "underline" }}
        >
          faryne.dev
        </Typography>
      </Typography>
      {props.links?.map((link) =>
        link.internal ? (
          <Typography
            key={link.href}
            component={RouterLink}
            variant="body2"
            to={link.href}
            sx={{ color: "text.secondary", textDecoration: "underline" }}
          >
            {link.label}
          </Typography>
        ) : (
          <Typography
            key={link.href}
            component="a"
            variant="body2"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: "text.secondary", textDecoration: "underline" }}
          >
            {link.label}
          </Typography>
        ),
      )}
    </Stack>
  );
}
