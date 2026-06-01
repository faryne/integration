import { IconButton, Stack, Tooltip } from "@mui/material";
import FacebookIcon from "@mui/icons-material/Facebook";
import XIcon from "@mui/icons-material/X";

const socialLinks = [
  {
    title: "Facebook",
    href: "https://www.facebook.com/faryne",
    icon: <FacebookIcon fontSize="small" />,
  },
  {
    title: "X",
    href: "https://x.com/Faryne",
    icon: <XIcon fontSize="small" />,
  },
];

export function SocialLinks() {
  return (
    <Stack direction="row" spacing={0.5} aria-label="social links">
      {socialLinks.map((link) => (
        <Tooltip key={link.title} title={link.title}>
          <IconButton
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.title}
            size="small"
            sx={{
              color: "text.secondary",
              "&:hover": {
                color: "primary.main",
                bgcolor: "action.hover",
              },
            }}
          >
            {link.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
