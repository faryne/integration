import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import i18n from "@writer/i18n/index.ts";
import { backend, errorMessage } from "@writer/lib/backend.ts";
import { useSettingsForm } from "@writer/pages/settings/settingsForm.tsx";

const languages = ["zh-TW", "zh-CN", "en", "ja", "ko"] as const;
type Language = (typeof languages)[number];

const currentLanguage = (): Language => languages.includes(i18n.resolvedLanguage as Language) ? i18n.resolvedLanguage as Language : "zh-TW";

export function GeneralSettingsPage() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const [savedLanguage, setSavedLanguage] = useState<Language>(currentLanguage);
  const [language, setLanguage] = useState<Language>(savedLanguage);
  const [saving, setSaving] = useState(false);
  const save = useCallback(async () => {
    setSaving(true);
    try {
      const settings = await backend.SaveApplicationSettings({ language });
      const saved = languages.includes(settings.language as Language) ? settings.language as Language : "zh-TW";
      await i18n.changeLanguage(saved);
      setSavedLanguage(saved);
      setLanguage(saved);
      showSuccess(i18n.t("settings.general.saved"));
    } catch (error) {
      showError(errorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  }, [language, showError, showSuccess]);
  const controller = useMemo(() => ({
    dirty: language !== savedLanguage,
    canSave: true,
    saving,
    save,
    discard: () => setLanguage(savedLanguage),
  }), [language, save, savedLanguage, saving]);
  useSettingsForm(controller);

  return (
    <Box sx={{ flex: 1, overflow: "auto", p: 3, pb: 12 }}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography variant="h5" sx={{ fontSize: 21 }}>{t("settings.general.title")}</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, mb: 4 }}>{t("settings.general.description")}</Typography>
        <Typography fontWeight={700} sx={{ mb: 1.5 }}>{t("settings.general.interface")}</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "210px minmax(260px, 1fr)", gap: 3, alignItems: "start", p: 2.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
          <Box>
            <Typography fontWeight={650} variant="body2">{t("settings.general.language")}</Typography>
            <Typography color="text.secondary" variant="caption">{t("settings.general.languageHelp")}</Typography>
          </Box>
          <FormControl fullWidth>
            <InputLabel id="interface-language-label">{t("settings.general.language")}</InputLabel>
            <Select labelId="interface-language-label" label={t("settings.general.language")} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              {languages.map((item) => <MenuItem key={item} value={item}>{t(`settings.general.languages.${item}`)}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <Alert severity="info" sx={{ mt: 3 }}>
          <Stack component="span" spacing={0.25}>
            <strong>{t("settings.general.storageTitle")}</strong>
            <span>{t("settings.general.storageDescription")}</span>
          </Stack>
        </Alert>
      </Box>
    </Box>
  );
}
