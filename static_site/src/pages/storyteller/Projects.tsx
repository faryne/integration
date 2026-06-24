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
import { useStorytellerProjects } from "@/apis/storyteller.ts";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import { useTitle } from "@/helpers/title.tsx";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";

export default function StorytellerProjects() {
  const { data: apiProjects = [], isLoading } = useStorytellerProjects();
  const projects = apiProjects.map((project) => ({
    id: project.public_id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    storiesCount: project.stories?.length ?? 0,
    statusLabel:
      project.visibility === "public"
        ? "已公開"
        : project.visibility === "unlisted"
          ? "與親友分享"
          : "完全不公開",
    statusColor: project.visibility === "private" ? "default" : "primary",
    updatedAt: project.updated_at,
  }));

  useTitle("Storyteller 專案列表", {
    path: "/storyteller/project",
    robots: "noindex, nofollow",
  });

  return (
    <StorytellerShell
      title="專案列表"
      description="集中管理故事企劃、章節與設定資料。"
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
      {isLoading ? (
        <StorytellerLoading label="正在載入專案列表..." />
      ) : (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: 1 }}
        >
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
              {projects.map((project) => (
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
                      label={project.statusLabel}
                      color={project.statusColor as "primary" | "default"}
                    />
                  </TableCell>
                  <TableCell>
                    {formatStorytellerDate(project.updatedAt)}
                  </TableCell>
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
      )}
    </StorytellerShell>
  );
}
