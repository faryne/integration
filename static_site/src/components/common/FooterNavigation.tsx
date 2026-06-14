import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import type { LayoutMenuItem } from "@/types/layout.ts";

const directNavigationItems = headerNavigationItems.filter(
  (item): item is LayoutMenuItem => !isLayoutDropMenu(item),
);

export function FooterNavigation() {
  return (
    <Box
      component="nav"
      aria-label="footer navigation"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(140px, 1fr))",
        },
        columnGap: { xs: 1.5, md: 2.5, lg: 4 },
        rowGap: { xs: 1.5, md: 2 },
      }}
    >
      <NavigationList title="主要連結" items={directNavigationItems} />
      {headerNavigationItems.map((item) =>
        isLayoutDropMenu(item) ? (
          <NavigationList
            key={item.title}
            title={item.title}
            items={item.items}
          />
        ) : null,
      )}
    </Box>
  );
}

function NavigationList({
  title,
  items,
}: {
  title: string;
  items: LayoutMenuItem[];
}) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>
        {title}
      </Typography>
      <List dense disablePadding>
        {items.map((item) => (
          <ListItem key={item.title} disablePadding>
            <ListItemButton
              component="a"
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              sx={{
                px: 0,
                py: 0.25,
                minHeight: 28,
              }}
            >
              <ListItemText
                primary={item.title}
                primaryTypographyProps={{ variant: "body2" }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
