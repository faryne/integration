import CheckIcon from "@mui/icons-material/Check";
import LanguageIcon from "@mui/icons-material/Language";
import { Box, IconButton, MenuItem, Popover, Stack, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/index.ts";
import {
  normalizeStorytellerLanguage,
  persistStorytellerLanguage,
  storytellerLanguages,
  type StorytellerLanguage,
} from "@/i18n/storytellerLanguage.ts";

/** 與外觀切換並列的全站語言入口；選擇後立即套用並記住，不另設儲存流程。 */
export function StorytellerLanguageMenu() {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = normalizeStorytellerLanguage(i18n.resolvedLanguage) ?? "zh-TW";

  async function selectLanguage(language: StorytellerLanguage) {
    persistStorytellerLanguage(language);
    await i18n.changeLanguage(language);
    setAnchor(null);
  }

  return (
    <>
      <Tooltip title={t("web.language.buttonLabel")}>
        <IconButton
          aria-label={t("web.language.current", { language: t(`web.language.options.${current}`) })}
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
            {t("web.language.title")}
          </Typography>
          {storytellerLanguages.map((language) => (
            <MenuItem key={language} selected={current === language} onClick={() => void selectLanguage(language)}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: 1 }}>
                <span>{t(`web.language.options.${language}`)}</span>
                {current === language && <CheckIcon color="primary" fontSize="small" />}
              </Stack>
            </MenuItem>
          ))}
        </Box>
      </Popover>
    </>
  );
}
