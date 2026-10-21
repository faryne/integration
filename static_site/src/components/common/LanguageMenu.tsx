import CheckIcon from "@mui/icons-material/Check";
import LanguageIcon from "@mui/icons-material/Language";
import { Box, IconButton, MenuItem, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  normalizeInterfaceLanguage,
  persistInterfaceLanguage,
  interfaceLanguages,
  type InterfaceLanguage,
} from "@/i18n/interfaceLanguage.ts";

/** 與外觀切換並列的全站語言入口；選擇後立即套用並記住，不另設儲存流程。 */
export function LanguageMenu() {
  const { t, i18n } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // language 會在 languageChanged 事件前更新；resolvedLanguage 在同一輪 render 仍可能是舊值。
  const current = normalizeInterfaceLanguage(i18n.language) ?? "zh-TW";

  async function selectLanguage(language: InterfaceLanguage) {
    persistInterfaceLanguage(language);
    await i18n.changeLanguage(language);
    setAnchor(null);
  }

  return (
    <>
      <Tooltip title={t("common.language.buttonLabel")}>
        <IconButton
          aria-label={t("common.language.current", { language: t(`common.language.options.${current}`) })}
          aria-expanded={Boolean(anchor)}
          color="inherit"
          size="small"
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <LanguageIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ minWidth: 220, py: 1 }}>
          <Typography fontWeight={700} sx={{ px: 2, py: 1 }}>
            {t("common.language.title")}
          </Typography>
          {interfaceLanguages.map((language) => (
            <MenuItem key={language} selected={current === language} onClick={() => void selectLanguage(language)}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: 1 }}>
                <span>{t(`common.language.options.${language}`)}</span>
                {current === language && <CheckIcon color="primary" fontSize="small" />}
              </Stack>
            </MenuItem>
          ))}
        </Box>
      </Popover>
    </>
  );
}
