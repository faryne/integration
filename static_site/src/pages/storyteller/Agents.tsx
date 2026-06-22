import AddIcon from "@mui/icons-material/Add";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import {
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import {
  formatStorytellerDate,
  storytellerAgents,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerAgents() {
  useTitle("Storyteller AI Agent 列表", {
    path: "/storyteller/agent",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="AI Agent 列表"
      description="管理可供故事專案使用的 AI Agent。此頁先保留多供應商與不同模型的畫面結構。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "AI Agent 列表" },
      ]}
      action={
        <Button
          component={RouterLink}
          to="/storyteller/agent/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          建立 AI Agent
        </Button>
      }
    >
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Agent</TableCell>
              <TableCell>供應商</TableCell>
              <TableCell>模型</TableCell>
              <TableCell>連結專案</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>更新時間</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {storytellerAgents.map((agent) => (
              <TableRow key={agent.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <SmartToyIcon color={agent.enabled ? "primary" : "disabled"} />
                    <Stack spacing={0.5}>
                      <Typography fontWeight={800}>{agent.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {agent.purpose}
                      </Typography>
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell>{agent.provider}</TableCell>
                <TableCell>{agent.model}</TableCell>
                <TableCell>{agent.projectCount}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={agent.enabled ? "啟用" : "停用"}
                    color={agent.enabled ? "success" : "default"}
                  />
                </TableCell>
                <TableCell>{formatStorytellerDate(agent.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </StorytellerShell>
  );
}
