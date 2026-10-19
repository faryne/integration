import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Trans, useTranslation } from "react-i18next";
import type { StorytellerAgentPanelAgent } from "@/pages/storyteller/StorytellerAgentPanel.tsx";
import { STORYTELLER_SKILL_USAGE_TEXT } from "@/pages/storyteller/storytellerSelectionAgentTrigger.ts";

interface StorytellerAgentReferenceDrawerProps {
  open: boolean;
  onClose: () => void;
  agents: StorytellerAgentPanelAgent[];
}

// 指令名稱即翻譯 key：web.agent.skills.<skill>.label／.usage
const skillCommands = ["rewrite", "expand", "translate", "continue", "custom"];

const agentPromptExcerptMaxLength = 60;

function agentPromptExcerpt(prompt: string, emptyLabel: string) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return emptyLabel;
  }
  if (trimmed.length <= agentPromptExcerptMaxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, agentPromptExcerptMaxLength)}…`;
}

// key 對應 web.agent.references.<key>.*；token 中括號內的佔位文字也走翻譯（placeholder）
const referenceExamples = [
  { key: "thisStory", token: () => "@thisStory" },
  { key: "story", token: (placeholder: string) => `@story:[${placeholder}]` },
  { key: "thisLore", token: () => "@thisLore" },
  { key: "lore", token: (placeholder: string) => `@lore:[${placeholder}]` },
];

export function StorytellerAgentReferenceDrawer(
  props: StorytellerAgentReferenceDrawerProps,
) {
  const { t } = useTranslation();
  return (
    <Drawer anchor="right" open={props.open} onClose={props.onClose}>
      <Box sx={{ width: { xs: 320, sm: 420 }, p: 2 }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="h6" fontWeight={800}>
              {t("web.agent.reference.title")}
            </Typography>
            <IconButton
              size="small"
              aria-label={t("web.common.close")}
              onClick={props.onClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Typography variant="subtitle2" fontWeight={800}>
            {t("web.agent.reference.commandsTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("web.agent.reference.commandsDescription")}
          </Typography>

          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t("web.agent.reference.skillsTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {/* 說明文字中的 <code> 由 Trans 的 components 對應 */}
            <Trans
              i18nKey="web.agent.reference.skillsFormat"
              components={{ code: <code /> }}
            />
          </Typography>
          <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("web.agent.reference.command")}</TableCell>
                  <TableCell>{t("web.agent.reference.usage")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {skillCommands.map((skill) => (
                  <TableRow key={skill}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Chip
                        size="small"
                        label={`/${skill}`}
                        sx={{
                          fontFamily:
                            '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        {t(`web.agent.skills.${skill}.label`)}
                      </Typography>
                    </TableCell>
                    <TableCell>{t(STORYTELLER_SKILL_USAGE_TEXT[skill])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {t("web.agent.reference.agentsTitle")}
          </Typography>
          {props.agents.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("web.agent.reference.noAgents")}
            </Typography>
          ) : (
            <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t("web.agent.reference.command")}</TableCell>
                    <TableCell>{t("web.agent.reference.promptExcerpt")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {props.agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        <Chip
                          size="small"
                          label={`/${agent.name}`}
                          sx={{
                            fontFamily:
                              '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {agentPromptExcerpt(
                          agent.prompt,
                          t("web.agent.reference.emptyPrompt"),
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="subtitle2" fontWeight={800}>
            {t("web.agent.reference.referencesTitle")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("web.agent.reference.referencesDescription")}
          </Typography>

          <Stack spacing={1.5}>
            {referenceExamples.map((item) => (
              <Box
                key={item.key}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 1.5,
                }}
              >
                <Stack spacing={1}>
                  <Chip
                    size="small"
                    label={item.token(
                      t(`web.agent.references.${item.key}.placeholder`, {
                        defaultValue: "",
                      }),
                    )}
                    sx={{
                      alignSelf: "flex-start",
                      fontFamily:
                        '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                    }}
                  />
                  <Typography variant="subtitle2" fontWeight={800}>
                    {t(`web.agent.references.${item.key}.title`)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t(`web.agent.references.${item.key}.description`)}
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
