import SendIcon from "@mui/icons-material/Send";
import { Box, Button, CircularProgress, IconButton, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@/components/SnackProvider.tsx";
import { backend, errorMessage } from "@/lib/backend.ts";
import { useBackendData } from "@/lib/useBackendData.ts";
import { AssistantSetup } from "@/pages/workspace/AssistantSetup.tsx";
import { useChatLog } from "@/pages/workspace/useChatLog.ts";

// 專案層的 AI 助理。Agent 選單只列有安裝的 CLI，對話存在 [agent]/[project]。
export function ChatPanel({ projectID, projectName }: { projectID: string; projectName: string }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const agents = useBackendData(() => backend.Agents(), []);
  const [agentID, setAgentID] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const selected = agents?.some((agent) => agent.id === agentID) ? agentID : (agents?.[0]?.id ?? "");
  const chat = useChatLog(projectID, selected);
  const threadLabel = (title: string) => title || t("workspace.chat.newThread");

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || !selected || sending || chat.page === null) return;
    setSending(true);
    try {
      const reply = await backend.Ask(selected, {
        thread_id: chat.page.current_id,
        session_id: "",
        project_id: projectID,
        kind: "",
        document_id: "",
        title: projectName,
        prompt,
      });
      setDraft("");
      chat.appendTurn(prompt, reply);
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box ref={chat.box} sx={{ flex: 1, overflow: "auto" }}>
        <Stack spacing={1.25} sx={{ maxWidth: 780, mx: "auto", px: 2.5, py: 2.5 }}>
          {selected && <AssistantSetup agentID={selected} />}
          {agents?.length === 0 && (
            <Typography color="text.secondary" sx={{ fontSize: 13.5, textAlign: "center", pt: 6 }}>
              {t("workspace.chat.noAgent")}
            </Typography>
          )}
          {chat.page && chat.page.start > 0 && (
            <Button size="small" disabled={chat.loadingOlder || sending} onClick={() => void chat.loadOlder()} sx={{ alignSelf: "center" }}>
              {chat.loadingOlder ? <CircularProgress size={14} /> : t("workspace.chat.older")}
            </Button>
          )}
          {chat.page === null && selected && <CircularProgress size={18} sx={{ alignSelf: "center", mt: 4 }} />}
          {chat.page?.messages.map((message, index) => (
            <Box key={`${chat.page?.start ?? 0}:${index}`} sx={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
              <Paper
                variant="outlined"
                sx={{ px: 1.5, py: 1, maxWidth: "80%", borderRadius: 2, bgcolor: message.role === "user" ? "action.selected" : "transparent" }}
              >
                <Typography sx={{ fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</Typography>
              </Paper>
            </Box>
          ))}
          {sending && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
              <CircularProgress size={14} />
              <Typography sx={{ fontSize: 13 }}>{t("workspace.chat.sending")}</Typography>
            </Stack>
          )}
        </Stack>
      </Box>
      <Box sx={{ px: 2.5, pt: 1.25, pb: 2.25 }}>
        <Paper variant="outlined" sx={{ maxWidth: 780, mx: "auto", px: 1.5, pt: 1.25, pb: 1, borderRadius: 3, "&:focus-within": { borderColor: "primary.main" } }}>
          <TextField
            multiline
            minRows={2}
            maxRows={8}
            fullWidth
            variant="standard"
            placeholder={t("workspace.chat.placeholder")}
            value={draft}
            disabled={sending || !selected}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            slotProps={{ input: { disableUnderline: true, sx: { fontSize: 14 } } }}
          />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Select
              size="small"
              displayEmpty
              value={selected}
              disabled={!agents?.length || sending}
              onChange={(e) => setAgentID(e.target.value)}
              sx={{ fontSize: 12.5, "& .MuiSelect-select": { py: 0.5 } }}
            >
              {!agents?.length && (
                <MenuItem value="" sx={{ fontSize: 13 }}>
                  {agents === null ? t("workspace.chat.detecting") : t("workspace.chat.noAgent")}
                </MenuItem>
              )}
              {agents?.map((agent) => (
                <MenuItem key={agent.id} value={agent.id} sx={{ fontSize: 13 }}>
                  {agent.display_name}
                </MenuItem>
              ))}
            </Select>
            <Select
              size="small"
              displayEmpty
              value={chat.page?.current_id || ""}
              disabled={!chat.page?.threads.length || sending}
              onChange={(e) => void chat.selectThread(e.target.value)}
              sx={{ fontSize: 12.5, maxWidth: 220, "& .MuiSelect-select": { py: 0.5 } }}
            >
              {!chat.page?.threads.length && (
                <MenuItem value="" sx={{ fontSize: 13 }}>
                  {t("workspace.chat.noThread")}
                </MenuItem>
              )}
              {chat.page?.threads.map((thread) => (
                <MenuItem key={thread.id} value={thread.id} sx={{ fontSize: 13, maxWidth: 360 }}>
                  <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{threadLabel(thread.title)}</Box>
                </MenuItem>
              ))}
            </Select>
            <Button size="small" disabled={!selected || sending || chat.page === null} onClick={() => void chat.startNew()} sx={{ flex: "none", fontSize: 12.5 }}>
              {t("workspace.chat.newThread")}
            </Button>
            <Box sx={{ flex: 1 }} />
            <IconButton color="primary" disabled={!selected || sending || chat.page === null || !draft.trim()} aria-label={t("workspace.chat.send")} onClick={() => void send()}>
              {sending ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
