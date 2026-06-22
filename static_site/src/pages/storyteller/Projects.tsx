import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
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
  projectStatusLabel,
  storytellerProjects,
} from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import { StorytellerShell } from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerProjects() {
  useTitle("Storyteller 專案列表", {
    path: "/storyteller/project",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="專案列表"
      description="集中管理故事企劃、章節與設定資料。列表目前使用前端假資料。"
      breadcrumbs={[
        { label: "Storyteller", to: "/storyteller" },
        { label: "專案列表" },
      ]}
      action={
        <Button
          component={RouterLink}
          to="/storyteller/project/new"
          variant="contained"
          startIcon={<AddIcon />}
        >
          建立專案
        </Button>
      }
    >
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>專案</TableCell>
              <TableCell>特殊網址</TableCell>
              <TableCell>故事數</TableCell>
              <TableCell>狀態</TableCell>
              <TableCell>更新時間</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {storytellerProjects.map((project) => (
              <TableRow key={project.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <FolderOpenIcon color="primary" />
                    <Stack spacing={0.5}>
                      <Typography fontWeight={800}>{project.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {project.description}
                      </Typography>
                    </Stack>
                  </Stack>
                </TableCell>
                <TableCell>{project.slug}</TableCell>
                <TableCell>{project.storiesCount}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={projectStatusLabel(project.status)}
                    color={project.status === "drafting" ? "primary" : "default"}
                  />
                </TableCell>
                <TableCell>{formatStorytellerDate(project.updatedAt)}</TableCell>
                <TableCell align="right">
                  <Button
                    component={RouterLink}
                    to={`/storyteller/project/${project.id}`}
                    size="small"
                    variant="outlined"
                  >
                    開啟
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </StorytellerShell>
  );
}
