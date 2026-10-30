import { Button, IconButton, Stack, TextField } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import type { ActressLink } from "@/types/av.ts";

/**
 * 參考連結（多筆）：每列名稱（選填）＋網址。核准後直接成為女優頁的「連結」。
 * baseUrls 有給時（修改模式），新加的連結會標色
 */
export function ActressLinksEditor({
  links,
  baseUrls,
  onChange,
}: {
  links: ActressLink[];
  baseUrls?: string[];
  onChange: (links: ActressLink[]) => void;
}) {
  const update = (index: number, patch: Partial<ActressLink>) =>
    onChange(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  const isNew = (url: string) =>
    Boolean(baseUrls && url && !baseUrls.includes(url));

  return (
    <Stack spacing={1}>
      {links.map((link, index) => (
        <Stack
          key={index}
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ alignItems: { sm: "center" } }}
        >
          <TextField
            label="名稱（選填）"
            onChange={(e) => update(index, { title: e.target.value })}
            size="small"
            sx={{ width: { sm: 200 } }}
            value={link.title}
          />
          <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
            <TextField
              color={isNew(link.url) ? "success" : undefined}
              focused={isNew(link.url) || undefined}
              fullWidth
              label="網址"
              onChange={(e) => update(index, { url: e.target.value })}
              placeholder="https://"
              size="small"
              type="url"
              value={link.url}
            />
            <IconButton
              aria-label="移除連結"
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      ))}
      <Button
        onClick={() => onChange([...links, { title: "", url: "" }])}
        startIcon={<AddIcon />}
        sx={{ alignSelf: "flex-start" }}
        variant="outlined"
      >
        新增連結
      </Button>
    </Stack>
  );
}
