import {
  Box,
  Button,
  Chip,
  Container,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import DataObjectIcon from "@mui/icons-material/DataObject";
import NorthEastIcon from "@mui/icons-material/NorthEast";
import PublicIcon from "@mui/icons-material/Public";
import ScienceIcon from "@mui/icons-material/Science";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useState } from "react";
import { Link } from "react-router-dom";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation";
import { useTitle } from "@/helpers/title";
import type { LayoutMenuItem } from "@/types/layout";

type LabProject = LayoutMenuItem & {
  group: string;
  index: number;
};

const labProjects: LabProject[] = headerNavigationItems
  .flatMap((item) => {
    if (isLayoutDropMenu(item)) {
      return item.items.map((child) => ({
        ...child,
        group: item.title,
      }));
    }

    return [
      {
        ...item,
        group: item.external ? "外部訊號" : "站內入口",
      },
    ];
  })
  .filter((item) => item.href !== "/" && item.title !== "部落格")
  .map((item, index) => ({ ...item, index }));

const groupIcon = (group: string) => {
  if (group.includes("資料")) return <DataObjectIcon fontSize="small" />;
  if (group.includes("工具")) return <TerminalIcon fontSize="small" />;
  if (group.includes("喜好")) return <ScienceIcon fontSize="small" />;
  return <PublicIcon fontSize="small" />;
};

const projectDescription = (project: LabProject) => {
  if (project.external) return "外部觀測站，收錄長篇筆記與研究紀錄。";
  if (project.group.includes("資料")) return "將公開資料清洗、比對並轉換成可查詢的操作面板。";
  if (project.group.includes("工具")) return "替日常流程封裝的實用工具，偏向自動化與快速驗證。";
  if (project.group.includes("喜好")) return "影像、標籤與收藏資料的探索型實驗項目。";
  return "主要入口與個人站台資訊。";
};

const projectGroups = [
  "全部",
  ...Array.from(new Set(labProjects.map((project) => project.group))),
];

export default function LabHome() {
  const [selectedGroup, setSelectedGroup] = useState("全部");
  useTitle("暗黑實驗室首頁預覽");

  const filteredProjects =
    selectedGroup === "全部"
      ? labProjects
      : labProjects.filter((project) => project.group === selectedGroup);

  return (
    <Box sx={{ position: "relative", overflow: "hidden" }}>
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(130, 255, 244, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(130, 255, 244, 0.1) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(180deg, #000 0%, transparent 82%)",
        }}
      />

      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
        <Box
          component="section"
          sx={{
            minHeight: { xs: "auto", md: "calc(100vh - 72px)" },
            py: { xs: 7, md: 9 },
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 0.95fr) 420px" },
            gap: { xs: 5, lg: 8 },
            alignItems: "center",
          }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{
                maxWidth: 900,
                fontSize: { xs: 42, sm: 58, md: 74 },
                lineHeight: 0.94,
                fontWeight: 900,
                letterSpacing: 0,
              }}
            >
              Faryne.dev
            </Typography>
            <Typography
              sx={{
                mt: 3,
                maxWidth: 680,
                color: "#b8ccd0",
                fontSize: { xs: 17, md: 19 },
                lineHeight: 1.8,
              }}
            >
              將站內作品、資料面板與工具集中成一個可掃描的實驗索引。每個項目像一個正在運作的模組，保留技術感，也讓入口更容易被理解。
            </Typography>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ mt: 4, flexWrap: "wrap", alignItems: "center" }}
            >
              <Button
                component="a"
                href="#projects"
                variant="contained"
                endIcon={<NorthEastIcon />}
                sx={{
                  minHeight: 42,
                  px: 2.25,
                  color: "#001617",
                  bgcolor: "#72fff0",
                  fontWeight: 800,
                  "&:hover": { bgcolor: "#b6fff7" },
                }}
              >
                查看項目
              </Button>
              <Typography
                sx={{
                  minHeight: 42,
                  display: "flex",
                  alignItems: "center",
                  color: "#b8ccd0",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                或是觀看我的
              </Typography>
              <Button
                component="a"
                href="https://faryne.github.io/"
                variant="outlined"
                sx={{
                  minHeight: 42,
                  px: 2.25,
                  color: "#e8fbff",
                  borderColor: "rgba(232, 251, 255, 0.35)",
                  fontWeight: 800,
                }}
              >
                簡歷
              </Button>
            </Stack>
          </Box>
        </Box>

        <Box id="projects" component="section" sx={{ pb: { xs: 7, md: 10 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
            sx={{ mb: 4 }}
          >
            <Typography
              component="h2"
              sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 900 }}
            >
              項目
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {projectGroups.map((group) => (
                <Chip
                  key={group}
                  label={group}
                  icon={group === "全部" ? undefined : groupIcon(group)}
                  clickable
                  onClick={() => setSelectedGroup(group)}
                  variant={selectedGroup === group ? "filled" : "outlined"}
                  sx={{
                    height: 34,
                    color: selectedGroup === group ? "#001617" : "#d9f8fa",
                    borderColor: "rgba(114, 255, 240, 0.34)",
                    background:
                      selectedGroup === group
                        ? "#72fff0"
                        : "rgba(9, 22, 28, 0.72)",
                    "& .MuiChip-icon": {
                      color: selectedGroup === group ? "#001617" : "#9afff4",
                    },
                    "&:hover": {
                      background:
                        selectedGroup === group
                          ? "#b6fff7"
                          : "rgba(114, 255, 240, 0.12)",
                    },
                  }}
                />
              ))}
            </Stack>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {filteredProjects.map((project) => (
              <MuiLink
                key={`${project.group}-${project.title}`}
                component={project.external ? "a" : Link}
                href={project.external ? project.href : undefined}
                to={!project.external ? project.href : undefined}
                target={project.external ? "_blank" : undefined}
                rel={project.external ? "noopener noreferrer" : undefined}
                underline="none"
                sx={{
                  minHeight: 216,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  p: 2.5,
                  border: "1px solid rgba(138, 255, 244, 0.2)",
                  borderRadius: 2,
                  color: "#e8fbff",
                  background:
                    "linear-gradient(145deg, rgba(10, 21, 29, 0.92), rgba(6, 10, 16, 0.82))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  transition:
                    "transform 160ms ease, border-color 160ms ease, background 160ms ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: "rgba(114, 255, 240, 0.62)",
                    background:
                      "linear-gradient(145deg, rgba(15, 39, 48, 0.96), rgba(7, 13, 20, 0.92))",
                  },
                }}
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Chip
                    icon={groupIcon(project.group)}
                    label={project.group}
                    size="small"
                    sx={{
                      color: "#9afff4",
                      background: "rgba(114, 255, 240, 0.08)",
                      border: "1px solid rgba(114, 255, 240, 0.24)",
                    }}
                  />
                  <Typography
                    sx={{
                      color: "rgba(232, 251, 255, 0.42)",
                      fontFamily: "monospace",
                      fontSize: 13,
                    }}
                  >
                    #{project.index.toString().padStart(2, "0")}
                  </Typography>
                </Stack>
                <Box>
                  <Typography
                    component="h3"
                    sx={{ fontSize: 24, fontWeight: 850, mb: 1.5 }}
                  >
                    {project.title}
                  </Typography>
                  <Typography sx={{ color: "#9fb7bc", lineHeight: 1.7 }}>
                    {projectDescription(project)}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography sx={{ color: "#72fff0", fontWeight: 800 }}>
                    前往
                  </Typography>
                  <NorthEastIcon sx={{ fontSize: 18, color: "#72fff0" }} />
                </Stack>
              </MuiLink>
            ))}
          </Box>
        </Box>
      </Container>

    </Box>
  );
}
