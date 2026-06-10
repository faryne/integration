import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Avatar,
  Grid,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Stack,
  Link,
  useTheme,
} from "@mui/material";
import {
  GitHub,
  Language,
  Email,
  School,
  Build,
  Work,
  Star,
  OpenInNew,
} from "@mui/icons-material";
import { useTitle } from "@/helpers/title";

type LanguageType = "zh" | "en";

interface ResumeData {
  name: string;
  title: string;
  intro: string;
  education: {
    school: string;
    degree: string;
    period: string;
  }[];
  skills: {
    category: string;
    items: string[];
  }[];
  experience: {
    company: string;
    role: string;
    period: string;
    description: string[];
    link?: string;
  }[];
  projects: {
    name: string;
    category: string;
    description: string[];
    link?: string;
  }[];
}

const dataZh: ResumeData = {
  name: "謝育典 (Faryne Hsieh)",
  title: "Senior Backend / SRE Engineer",
  intro:
    "主要專長為網站開發及系統管理。前後端皆有豐富經驗，但多以後端與系統架構設計為主。早期深耕 PHP，近年轉向 Golang 與 Python。擁有豐富的 AWS/GCP 雲端架構設計、SRE/DevOps 實踐經驗。",
  education: [
    {
      school: "國立空中大學",
      degree: "管理資訊學系畢業",
      period: "2010/09 ~ 2024/06",
    },
    {
      school: "天主教輔仁大學",
      degree: "歷史學系肄業",
      period: "2001/09 ~ 2003/06",
    },
    {
      school: "臺北市立陽明高中",
      degree: "畢業",
      period: "1998/09 ~ 2001/06",
    },
  ],
  skills: [
    {
      category: "程式語言",
      items: [
        "Golang",
        "PHP",
        "Python",
        "TypeScript",
        "JavaScript",
        "HTML/CSS",
        "Shell Script",
      ],
    },
    {
      category: "資料庫",
      items: ["MySQL", "Oracle", "Redis"],
    },
    {
      category: "技術與工具",
      items: [
        "Fiber",
        "Gin",
        "Laravel",
        "Codeigniter",
        "React",
        "Vue",
        "RabbitMQ",
        "Docker",
        "K8s",
        "ELK",
      ],
    },
    {
      category: "雲端服務 / CI/CD",
      items: ["AWS", "GCP", "GitHub Actions", "TravisCI"],
    },
  ],
  experience: [
    {
      company: "眾鼎科技有限公司",
      role: "Golang 開發工程師",
      period: "2022/10 ~ 2025/06",
      description: [
        "設計並維護虛擬貨幣交易所後台系統與服務。",
        "使用 Golang / Gin 框架開發高效能後端 API 與 Cron Jobs。",
        "串接主流交易所 API 處理對沖交易邏輯。",
        "使用 Vue 3 與 Ant Design 建立管理介面。",
      ],
    },
    {
      company: "酷堤康科技 (IndoChat)",
      role: "Senior Backend Engineer",
      period: "2019/10 ~ 2021/11",
      link: "https://www.indochat.co.id",
      description: [
        "使用 AWS CloudFormation / CDK (Golang) 設計與維護雲端基礎架構。",
        "在 ECS Fargate 上部署高效能 API 服務，並導入 AutoScaling 與 CloudFront 快取機制。",
        "建置 MQTT 叢集與監控系統，並透過 Global Accelerator 優化全球連線。",
        "設計基於 EventBridge 與 ECS 的自動化任務排程機制。",
        "使用 Grafana 與 CloudWatch 建立完善的監控與告警系統。",
      ],
    },
    {
      company: "香港商台灣邏輯媒體 (PressLogic)",
      role: "Web / Backend Engineer",
      period: "2018/07 ~ 2019/08",
      link: "https://presslogic.com",
      description: [
        "在 GCP 上設計並建置 GCE / Cloud SQL 基礎架構。",
        "使用 ELK (Elasticsearch, Logstash) 建立高效的資料同步與搜尋機制。",
        "使用 PHP 7.3 開發後端 API 並維護 GitLab CI/CD 流程。",
      ],
    },
    {
      company: "風尚數位科技 (FashionGuide)",
      role: "資深工程師",
      period: "2017/10 ~ 2018/07",
      link: "https://www.fashionguide.com.tw/",
      description: [
        "維護 AWS EC2/RDS 雲端服務與內部 CI/CD 機制。",
        "開發核心系統，主要技術棧為 PHP 7、Laravel 與 MySQL。",
      ],
    },
  ],
  projects: [
    {
      name: "Threads 截圖工具",
      category: "Golang, Headless Chrome",
      link: "/tools/thread/capture",
      description: [
        "傳入 Threads 貼文網址，自動擷取圖片並附加 QR Code。",
        "使用 ChromeDP 驅動 Headless Chrome 進行精準網頁擷圖。",
      ],
    },
    {
      name: "難以名狀的抓圖器 (NekoMaid)",
      category: "Vue, Golang, S3, ES",
      link: "/nekomaid",
      description: [
        "高效能圖片爬蟲，整合 AWS S3 儲存與 CloudFront 分發。",
        "整合 Elasticsearch 提供快速的作品搜尋功能。",
      ],
    },
    {
      name: "主要銀行匯率查詢",
      category: "Laravel, Vue, Firebase",
      link: "/data/rates",
      description: [
        "自動化爬取各大銀行即時匯率。",
        "提供直觀的 Vue 前端介面進行試算與查詢。",
      ],
    },
  ],
};

const dataEn: ResumeData = {
  name: "Faryne Hsieh",
  title: "Senior Backend / SRE Engineer",
  intro:
    "Experienced software engineer specializing in Backend development and Systems Engineering (SRE). Proficient in designing scalable cloud architectures and building high-performance systems. Transitioned from PHP to Golang/Python as core languages. Strong expertise in AWS/GCP and DevOps practices.",
  education: [
    {
      school: "National Open University",
      degree: "B.S. in Management Information Systems",
      period: "Sep 2010 ~ Jun 2024",
    },
  ],
  skills: [
    {
      category: "Languages",
      items: [
        "Golang",
        "PHP",
        "Python",
        "TypeScript",
        "JavaScript",
        "HTML/CSS",
        "Shell Script",
      ],
    },
    {
      category: "Databases",
      items: ["MySQL", "Oracle", "Redis"],
    },
    {
      category: "Tech & Tools",
      items: [
        "Fiber",
        "Gin",
        "Laravel",
        "Codeigniter",
        "React",
        "Vue",
        "RabbitMQ",
        "Docker",
        "K8s",
        "ELK",
      ],
    },
    {
      category: "Cloud / CI/CD",
      items: ["AWS", "GCP", "GitHub Actions", "TravisCI"],
    },
  ],
  experience: [
    {
      company: "Zhong Ding Technology",
      role: "Golang Developer",
      period: "Oct 2022 ~ Jun 2025",
      description: [
        "Designed and maintained cryptocurrency exchange backend systems.",
        "Developed high-performance APIs and Cron jobs using Golang/Gin.",
        "Integrated exchange APIs for automated hedging strategies.",
        "Built administrative dashboards with Vue 3 and Ant Design.",
      ],
    },
    {
      company: "IndoChat",
      role: "Senior Backend Engineer",
      period: "Oct 2019 ~ Nov 2021",
      link: "https://www.indochat.co.id",
      description: [
        "Architected and maintained AWS infrastructure using CloudFormation and CDK (Golang).",
        "Deployed containerized services on ECS Fargate with AutoScaling and CloudFront.",
        "Built and monitored MQTT clusters for real-time messaging.",
        "Implemented automated task scheduling systems using EventBridge and ECS.",
        "Established observability with Grafana and CloudWatch alerts.",
      ],
    },
    {
      company: "PressLogic",
      role: "Web / Backend Engineer",
      period: "Jul 2018 ~ Aug 2019",
      link: "https://presslogic.com",
      description: [
        "Built GCP-based infrastructure (GCE, Cloud SQL).",
        "Implemented search and sync mechanisms using Elasticsearch and Logstash.",
        "Developed backend APIs with PHP 7.3 and managed GitLab CI/CD.",
      ],
    },
  ],
  projects: [
    {
      name: "Threads Capturer",
      category: "Golang, Headless Chrome",
      link: "/tools/thread/capture",
      description: [
        "Automated screenshot tool for Threads posts with QR code generation.",
        "Utilizes ChromeDP and Headless Chrome for web rendering.",
      ],
    },
    {
      name: "NekoMaid Crawler",
      category: "Vue, Golang, S3, ES",
      link: "/nekomaid",
      description: [
        "High-performance image crawler with AWS S3 storage and CloudFront delivery.",
        "Elasticsearch integration for fast full-text search.",
      ],
    },
  ],
};

const About: React.FC = () => {
  const [lang, setLang] = useState<LanguageType>("zh");
  const theme = useTheme();
  const data = lang === "zh" ? dataZh : dataEn;
  useTitle(lang === "zh" ? "關於我" : "About Me");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.credly.com/assets/utilities/embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleLangChange = (
    _event: React.MouseEvent<HTMLElement>,
    newLang: LanguageType | null,
  ) => {
    if (newLang !== null) {
      setLang(newLang);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {/* Header Section */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: "primary.contrastText",
          mb: 4,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 150,
            height: 150,
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "50%",
          }}
        />
        <Grid container spacing={3} alignItems="center">
          <Grid size={12}>
            <Avatar
              src="//www.gravatar.com/avatar/6ea548a4a4679eb99055d00a80a593c3?s=300"
              sx={{
                width: 140,
                height: 140,
                border: "4px solid rgba(255, 255, 255, 0.3)",
                boxShadow: theme.shadows[10],
              }}
            />
          </Grid>
          <Grid size={12}>
            <Typography variant="h3" fontWeight={800} gutterBottom>
              {data.name}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
              {data.title}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Tooltip title="GitHub">
                <IconButton
                  color="inherit"
                  component="a"
                  href="https://github.com/faryne"
                  target="_blank"
                >
                  <GitHub />
                </IconButton>
              </Tooltip>
              <Tooltip title="Lab Site">
                <IconButton color="inherit" component="a" href="/">
                  <Language />
                </IconButton>
              </Tooltip>
              <Tooltip title="Email">
                <IconButton
                  color="inherit"
                  component="a"
                  href="mailto:faryne@gmail.com"
                >
                  <Email />
                </IconButton>
              </Tooltip>
            </Stack>
          </Grid>
          <Grid size={12}>
            <ToggleButtonGroup
              value={lang}
              exclusive
              onChange={handleLangChange}
              size="small"
              sx={{
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                "& .MuiToggleButton-root": {
                  color: "white",
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  "&.Mui-selected": {
                    backgroundColor: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                  },
                },
              }}
            >
              <ToggleButton value="zh">中</ToggleButton>
              <ToggleButton value="en">EN</ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={4}>
        {/* Left Column: Intro & Skills */}
        <Grid size={12}>
          <Stack spacing={4}>
            {/* Intro */}
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <Star sx={{ mr: 1, color: "primary.main" }} />
                {lang === "zh" ? "個人簡介" : "Summary"}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                lineHeight={1.8}
              >
                {data.intro}
              </Typography>
            </Box>

            {/* Skills */}
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <Build sx={{ mr: 1, color: "primary.main" }} />
                {lang === "zh" ? "專業技能" : "Skills"}
              </Typography>
              <Stack spacing={2}>
                {data.skills.map((skill) => (
                  <Card
                    key={skill.category}
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                  >
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        color="primary"
                        gutterBottom
                      >
                        {skill.category}
                      </Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {skill.items.map((item) => (
                          <Chip
                            key={item}
                            label={item}
                            size="small"
                            variant="outlined"
                            sx={{ borderRadius: 1 }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>

            {/* Education */}
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <School sx={{ mr: 1, color: "primary.main" }} />
                {lang === "zh" ? "學歷" : "Education"}
              </Typography>
              <List disablePadding>
                {data.education.map((edu, idx) => (
                  <ListItem key={idx} disablePadding sx={{ mb: 2 }}>
                    <ListItemText
                      primary={edu.school}
                      secondary={`${edu.degree} | ${edu.period}`}
                      primaryTypographyProps={{ fontWeight: 700 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            {/* Certifications */}
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <Star sx={{ mr: 1, color: "primary.main" }} />
                {lang === "zh" ? "專業證照" : "Certifications"}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="center"
                flexWrap="wrap"
              >
                <div
                  data-iframe-width="150"
                  data-iframe-height="270"
                  data-share-badge-id="4356d6ac-42bb-48b6-8d90-75e6978a8d77"
                  data-share-badge-host="https://www.credly.com"
                ></div>
                <div
                  data-iframe-width="150"
                  data-iframe-height="270"
                  data-share-badge-id="076b834c-57e4-4e76-a1ca-e2e98b4117ee"
                  data-share-badge-host="https://www.credly.com"
                ></div>
              </Stack>
            </Box>
          </Stack>
        </Grid>

        {/* Right Column: Experience & Projects */}
        <Grid size={12}>
          <Stack spacing={6}>
            {/* Experience */}
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <Work sx={{ mr: 1, color: "primary.main" }} />
                {lang === "zh" ? "工作經歷" : "Experience"}
              </Typography>
              <Box sx={{ mt: 3 }}>
                {data.experience.map((exp, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      position: "relative",
                      pb: 4,
                      pl: 3,
                      borderLeft: "2px solid",
                      borderColor: "divider",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: -9,
                        top: 0,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        bgcolor: "primary.main",
                        border: "4px solid",
                        borderColor: "background.paper",
                      },
                    }}
                  >
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      color="text.primary"
                    >
                      {exp.role}
                    </Typography>
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{ mb: 1 }}
                    >
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        color="primary"
                      >
                        {exp.company}
                      </Typography>
                      {exp.link && (
                        <IconButton
                          size="small"
                          component="a"
                          href={exp.link}
                          target="_blank"
                        >
                          <OpenInNew fontSize="inherit" />
                        </IconButton>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        | {exp.period}
                      </Typography>
                    </Stack>
                    <List dense sx={{ listStyleType: "disc", pl: 2 }}>
                      {exp.description.map((desc, i) => (
                        <ListItem
                          key={i}
                          disablePadding
                          sx={{ display: "list-item", mb: 0.5 }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            {desc}
                          </Typography>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Projects */}
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <Star sx={{ mr: 1, color: "primary.main" }} />
                {lang === "zh" ? "個人作品" : "Projects"}
              </Typography>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {data.projects.map((proj, idx) => (
                  <Grid size={12} key={idx}>
                    <Card
                      variant="outlined"
                      sx={{
                        height: "100%",
                        borderRadius: 3,
                        transition: "transform 0.2s",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: theme.shadows[4],
                          borderColor: "primary.light",
                        },
                      }}
                    >
                      <CardContent>
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          color="primary"
                          sx={{
                            textTransform: "uppercase",
                            letterSpacing: 1,
                            mb: 1,
                            display: "block",
                          }}
                        >
                          {proj.category}
                        </Typography>
                        <Typography variant="h6" fontWeight={700} gutterBottom>
                          {proj.name}
                        </Typography>
                        <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                          {proj.description.map((d, i) => (
                            <Typography
                              key={i}
                              component="li"
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 0.5 }}
                            >
                              {d}
                            </Typography>
                          ))}
                        </Box>
                        {proj.link && (
                          <Link
                            href={proj.link}
                            underline="none"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              fontWeight: 700,
                              fontSize: "0.875rem",
                            }}
                          >
                            {lang === "zh" ? "查看專案" : "View Project"}
                            <OpenInNew sx={{ ml: 0.5, fontSize: 16 }} />
                          </Link>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
};

export default About;
