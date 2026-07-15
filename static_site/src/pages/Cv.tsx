import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Link as MuiLink,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import SchoolIcon from "@mui/icons-material/School";
import VerifiedIcon from "@mui/icons-material/Verified";
import CodeIcon from "@mui/icons-material/Code";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import GitHubIcon from "@mui/icons-material/GitHub";
import LanguageIcon from "@mui/icons-material/Language";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTitle } from "@/helpers/title";
import { ce } from "@/helpers/contactEncoder";
import XIcon from "@mui/icons-material/X";
import FacebookIcon from "@mui/icons-material/Facebook";

type Experience = {
  company: string;
  role: string;
  period: string;
  link?: string;
  highlights: string[];
};

type Project = {
  name: string;
  type: string;
  link?: string;
  highlights: string[];
};

type ContactMethod =
  | {
      label: string;
      icon: React.ReactNode;
      action: "copy";
      value: string;
    }
  | {
      label: string;
      icon: React.ReactNode;
      action: "open";
      href: string;
    };

const skills = [
  {
    title: "Backend / Languages",
    items: [
      "Golang",
      "PHP",
      "Python",
      "Shell Script",
      "JavaScript",
      "HTML",
      "CSS",
    ],
  },
  {
    title: "Frameworks / Frontend",
    items: [
      "Gin",
      "Fiber",
      "Laravel",
      "CodeIgniter",
      "Vue.js",
      "React",
      "jQuery",
    ],
  },
  {
    title: "Data / Search",
    items: ["MySQL", "Oracle", "Redis", "Elasticsearch", "Logstash"],
  },
  {
    title: "Cloud / DevOps / SRE",
    items: [
      "AWS",
      "GCP",
      "Docker",
      "K8S",
      "CloudWatch",
      "Grafana",
      "GitHub Actions",
      "TravisCI",
    ],
  },
];

const experiences: Experience[] = [
  {
    company: "眾鼎科技有限公司",
    role: "Golang 開發工程師",
    period: "2022/10 - 2025/06",
    highlights: [
      "設計並維護虛擬貨幣交易所後台系統與服務，涵蓋後端 API、cron 工作與前端管理頁面。",
      "使用 Golang / Gin Framework 開發後台服務，串接主要虛擬貨幣交易所 API 處理對沖交易流程。",
      "以 Vue 3 / Ant Design Vue 建置後台操作介面。",
    ],
  },
  {
    company: "酷堤康科技股份有限公司",
    role: "Senior Backend Engineer",
    period: "2019/10 - 2021/11",
    link: "https://www.indochat.co.id",
    highlights: [
      "負責 AWS 雲端架構設計與維護，使用 CloudFormation / CDK (Golang) 管理基礎設施。",
      "建置 ECS Fargate API 服務，搭配 Load Balancer、CloudFront cache 與 Auto Scaling 調整流量負載。",
      "部署 MQTT cluster，完成 image 打包、EC2 部署、CloudWatch 指標收集與 Global Accelerator 連線優化。",
      "以 EventBridge + ECS 設計內部 job 排程機制，讓工程師依規範撰寫 job 即可部署執行。",
      "使用 Grafana / CloudWatch 建立服務監控與告警，並維護 TravisCI / GitHub Actions CI/CD 流程。",
    ],
  },
  {
    company: "香港商台灣邏輯媒體科技有限公司台灣分公司",
    role: "Web / Backend Engineer",
    period: "2018/07 - 2019/08",
    link: "https://presslogic.com",
    highlights: [
      "使用 GCP 建置 GCE / Cloud SQL 等雲端服務，並以 shell script 輔助主機初始化。",
      "部署 Elasticsearch / Logstash，建立 MySQL 至 Elasticsearch 的資料同步與查詢機制。",
      "使用 PHP 7.3 支援後端 API 開發，並維護 GitLab CI/CD 流程。",
    ],
  },
  {
    company: "風尚數位科技股份有限公司（FashionGuide）",
    role: "資深工程師",
    period: "2017/10 - 2018/07",
    link: "https://www.fashionguide.com.tw",
    highlights: [
      "維護 AWS EC2 / RDS 等雲端服務與內部 CI/CD 流程。",
      "協助核心系統開發，主要使用 PHP 7、Laravel 5 與 MySQL。",
    ],
  },
  {
    company: "全音樂股份有限公司（friDay 音樂）",
    role: "資深工程師",
    period: "2016/06 - 2017/09",
    link: "https://omusic.friday.tw",
    highlights: [
      "參與舊系統遷移至新平台，主要使用 PHP、MySQL、Redis、RabbitMQ 與 ELK。",
      "使用 ELK 與 RabbitMQ 建立 log 分析機制。",
    ],
  },
  {
    company: "新加坡商葆光資訊有限公司台灣分公司（ASAP 閃電購物網）",
    role: "ERP 工程師",
    period: "2013/05 - 2015/07",
    highlights: [
      "使用 PHP 與 Oracle 撰寫營運報表 SQL，提供財會單位日常查閱。",
      "維護與開發供應商關係管理系統。",
    ],
  },
  {
    company: "雅虎數位行銷有限公司（Yahoo! 奇摩）",
    role: "工程師（派遣）",
    period: "2012/05 - 2013/02",
    link: "https://yahoo-emarketing.tumblr.com",
    highlights: [
      "使用 PHP / MySQL 產生業績報表並輸出 Excel 寄送給經銷商。",
      "開發活動網頁與內部工具。",
    ],
  },
  {
    company: "露天市集國際資訊股份有限公司（露天拍賣）",
    role: "工程師",
    period: "2011/05 - 2012/04",
    link: "https://www.ruten.com.tw",
    highlights: [
      "使用 PHP 與 Oracle 進行網站功能開發維護。",
      "處理與合作企業間的資料交換流程，包含 FTP 等資料傳輸。",
    ],
  },
  {
    company: "樂屋國際資訊股份有限公司（樂屋網）",
    role: "工程師",
    period: "2008/08 - 2011/04",
    link: "https://www.rakuya.com.tw",
    highlights: [
      "使用 PHP 與 MySQL 開發維護網站前後端功能。",
      "處理與房仲商的物件資料交換，包含 FTP、HTTP POST 與 SOAP。",
    ],
  },
  {
    company: "亞普達國際電子商務股份有限公司",
    role: "工程師",
    period: "2007/03 - 2008/06",
    link: "https://chinese.allproducts.com.tw",
    highlights: ["使用 PHP 與 MySQL 開發公司內部工具。"],
  },
  {
    company: "瑞奇科技",
    role: "工程師",
    period: "2006/09 - 2007/02",
    highlights: ["負責公司網站主機維護與網站內容更新。"],
  },
];

const projects: Project[] = [
  {
    name: "主要銀行匯率查詢",
    type: "Web crawler / Data product",
    link: "/data/rates/",
    highlights: [
      "後端使用 PHP / Laravel 爬取主要銀行匯率資料並存入資料庫。",
      "前端透過 Vue 與 API 顯示資料，部署於 Firebase Hosting。",
    ],
  },
  {
    name: "主計總處各縣市指標",
    type: "Open data / Web crawler",
    link: "/data/tw-stats/",
    highlights: [
      "使用 Golang 抓取主計總處 XML，整理為 JSON 後存放於 GitHub。",
      "前端使用 Vue.js / Axios 即時讀取 GitHub 上的資料檔案。",
    ],
  },
  {
    name: "DMM 影片",
    type: "Search / Data pipeline",
    link: "/av/video",
    highlights: [
      "使用 Golang 撰寫爬蟲擷取 Fanza 影片資料。",
      "透過 Logstash 定期從 MySQL 同步資料到 Elasticsearch，並以 Golang / React 建立前端網站。",
    ],
  },
  {
    name: "女優搜尋",
    type: "Search / Data pipeline",
    link: "/av/actress",
    highlights: [
      "使用 Golang 撰寫爬蟲擷取女優資料。",
      "透過 Logstash 定期從 MySQL 同步資料到 Elasticsearch，並以 Golang / React 建立前端網站。",
    ],
  },
  {
    name: "難以名狀的抓圖器",
    type: "Crawler / Image delivery",
    link: "https://neko.maid.tw",
    highlights: [
      "即時解析作品圖片位址與標題，抓取圖片後儲存至 AWS S3。",
      "透過 AWS CloudFront 提供圖片存取，並使用 Elasticsearch 處理站內搜尋。",
    ],
  },
  {
    name: "galgame.tv",
    type: "Search / Data pipeline",
    link: "https://galgame.tv",
    highlights: [
      "以 Golang 撰寫爬蟲定時爬取指定 YouTube 頻道中特定主題的影片。分為增量以及全量爬取",
      "同步資料到 Elasticsearch，並以 Golang / React 建立前端網站。",
    ],
  }
];

const education = [
  "國立空中大學 管理資訊學系畢業（2010/09 - 2024/06）",
  "天主教輔仁大學 歷史學系肄業（2001/09 - 2003/06）",
  "臺北市立陽明高中畢業（1998/09 - 2001/06）",
];

const certifications = [
  {
    name: "AWS Certified Solutions Architect - Associate（已過期）",
    link: "https://www.credly.com",
    badgeId: "4356d6ac-42bb-48b6-8d90-75e6978a8d77",
  },
  {
    name: "AWS Certified Solutions Architect - Professional（已過期）",
    link: "https://www.credly.com",
    badgeId: "076b834c-57e4-4e76-a1ca-e2e98b4117ee",
  },
];

const contacts: ContactMethod[] = [
  {
    label: "電子郵件",
    icon: <ContactMailIcon />,
    action: "copy",
    value: ce("v1.LSU4SxYMKDAGICU2agkgHg"),
  },
  {
    label: "GitHub",
    icon: <GitHubIcon />,
    action: "open",
    href: "https://github.com/faryne",
  },
  {
    label: "Blog",
    icon: <LanguageIcon />,
    action: "open",
    href: "https://blog.faryne.dev",
  },
  {
    label: "X / Twitter",
    icon: <XIcon />,
    action: "open",
    href: "https://x.com/faryne",
  },
  {
    label: "Facebook",
    icon: <FacebookIcon />,
    action: "open",
    href: "https://facebook.com/faryne",
  },
];

const tabs = [
  { value: "skills", label: "核心技能", icon: <CodeIcon fontSize="small" /> },
  {
    value: "experience",
    label: "工作經歷",
    icon: <WorkOutlineIcon fontSize="small" />,
  },
  { value: "education", label: "學歷", icon: <SchoolIcon fontSize="small" /> },
  {
    value: "certifications",
    label: "證照",
    icon: <VerifiedIcon fontSize="small" />,
  },
  {
    value: "projects",
    label: "個人作品 / 專案",
    icon: <CodeIcon fontSize="small" />,
  },
  {
    value: "contact",
    label: "聯絡方式",
    icon: <ContactMailIcon fontSize="small" />,
  },
];

type CvTab = (typeof tabs)[number]["value"];

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
      <Box
        sx={{ color: "primary.main", display: "grid", placeItems: "center" }}
      >
        {icon}
      </Box>
      <Typography component="h2" variant="h4" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
    </Stack>
  );
}

function SmartLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const isInternal = href.startsWith("/");

  if (isInternal) {
    return (
      <Button
        component={Link}
        to={href}
        size="small"
        endIcon={<OpenInNewIcon />}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      size="small"
      endIcon={<OpenInNewIcon />}
    >
      {children}
    </Button>
  );
}

export default function Cv() {
  const [selectedTab, setSelectedTab] = useState<CvTab>("skills");
  const [showAllExperience, setShowAllExperience] = useState(false);
  const [copiedContact, setCopiedContact] = useState("");
  useTitle("謝育典 Faryne Hsieh 簡歷");

  const visibleExperiences = showAllExperience
    ? experiences
    : experiences.slice(0, 3);

  useEffect(() => {
    if (selectedTab !== "certifications") return;
    if (!certifications.some((cert) => cert.badgeId)) return;

    document
      .querySelectorAll(
        'script[src="https://cdn.credly.com/assets/utilities/embed.js"]',
      )
      .forEach((script) => script.remove());
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://cdn.credly.com/assets/utilities/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, [selectedTab]);

  return (
    <Box sx={{ py: 5 }}>
      <Stack spacing={5}>
        <Box
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 3,
            color: "common.white",
            background:
              "linear-gradient(135deg, rgba(25, 118, 210, 0.96), rgba(63, 81, 181, 0.92))",
          }}
        >
          <Stack spacing={2.5}>
            <Chip
              label="Senior Backend / SRE / DevOps"
              sx={{
                alignSelf: "flex-start",
                color: "common.white",
                borderColor: "rgba(255,255,255,0.52)",
              }}
              variant="outlined"
            />
            <Box>
              <Typography component="h1" variant="h2" sx={{ fontWeight: 900 }}>
                謝育典
              </Typography>
              <Typography variant="h5" sx={{ mt: 1, opacity: 0.92 }}>
                Faryne Hsieh
              </Typography>
            </Box>
            <Typography sx={{ maxWidth: 820, fontSize: 18, lineHeight: 1.9 }}>
              主要專長為網站開發與系統管理，具備前後端開發經驗，職涯重心以後端服務、
              雲端架構、CI/CD、監控告警與 SRE / DevOps 實務為主。熟悉 PHP /
              MySQL 技術棧，近年以 Golang、AWS / GCP
              與雲端服務維運為主要工作領域。
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
              <Button
                component="a"
                href="https://blog.faryne.dev"
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                sx={{
                  color: "common.white",
                  borderColor: "rgba(255,255,255,0.56)",
                }}
              >
                Blog
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box>
          <Card variant="outlined">
            <Tabs
              value={selectedTab}
              onChange={(_, value: CvTab) => setSelectedTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="CV sections"
              sx={{
                px: 2,
                borderBottom: 1,
                borderColor: "divider",
                "& .MuiTab-root": {
                  minHeight: 64,
                  fontWeight: 800,
                },
              }}
            >
              {tabs.map((tab) => (
                <Tab
                  key={tab.value}
                  value={tab.value}
                  label={tab.label}
                  icon={tab.icon}
                  iconPosition="start"
                />
              ))}
            </Tabs>

            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {selectedTab === "skills" && (
                <Box>
                  <PanelTitle icon={<CodeIcon />} title="核心技能" />
                  <Grid container spacing={2}>
                    {skills.map((group) => (
                      <Grid size={{ xs: 12, md: 6 }} key={group.title}>
                        <Card variant="outlined" sx={{ height: "100%" }}>
                          <CardContent>
                            <Typography
                              variant="h6"
                              sx={{ fontWeight: 800, mb: 1.5 }}
                            >
                              {group.title}
                            </Typography>
                            <Stack
                              direction="row"
                              spacing={1}
                              sx={{ flexWrap: "wrap", gap: 1 }}
                            >
                              {group.items.map((item) => (
                                <Chip key={item} label={item} size="small" />
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {selectedTab === "experience" && (
                <Box>
                  <PanelTitle icon={<WorkOutlineIcon />} title="工作經歷" />
                  <Stack spacing={2.5}>
                    {visibleExperiences.map((experience) => (
                      <Card
                        key={`${experience.company}-${experience.period}`}
                        variant="outlined"
                      >
                        <CardContent>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", md: "center" }}
                            spacing={1}
                          >
                            <Box>
                              <Typography variant="h5" sx={{ fontWeight: 850 }}>
                                {experience.role}
                              </Typography>
                              <Typography
                                color="text.secondary"
                                sx={{ mt: 0.5 }}
                              >
                                {experience.company}
                              </Typography>
                            </Box>
                            <Chip
                              label={experience.period}
                              variant="outlined"
                            />
                          </Stack>
                          <Stack
                            component="ul"
                            spacing={1}
                            sx={{ pl: 2.5, mt: 2 }}
                          >
                            {experience.highlights.map((item) => (
                              <Typography
                                component="li"
                                key={item}
                                sx={{ lineHeight: 1.8 }}
                              >
                                {item}
                              </Typography>
                            ))}
                          </Stack>
                          {experience.link && (
                            <Box sx={{ mt: 1.5 }}>
                              <SmartLink href={experience.link}>
                                公司網站
                              </SmartLink>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {experiences.length > 3 && (
                      <Button
                        variant="outlined"
                        onClick={() => setShowAllExperience((value) => !value)}
                        sx={{ alignSelf: "center", px: 4 }}
                      >
                        {showAllExperience
                          ? "收合"
                          : `更多 ${experiences.length - 3} 筆經歷`}
                      </Button>
                    )}
                  </Stack>
                </Box>
              )}

              {selectedTab === "education" && (
                <Box>
                  <PanelTitle icon={<SchoolIcon />} title="學歷" />
                  <Card variant="outlined">
                    <CardContent>
                      <Stack spacing={1.5}>
                        {education.map((item) => (
                          <Typography key={item}>{item}</Typography>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {selectedTab === "certifications" && (
                <Box>
                  <PanelTitle icon={<VerifiedIcon />} title="證照" />
                  <Card variant="outlined">
                    <CardContent>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={3}
                        alignItems="center"
                        justifyContent="center"
                      >
                        {certifications.map((cert) =>
                          cert.badgeId ? (
                            <Box
                              key={`${cert.badgeId}-${selectedTab}`}
                              data-iframe-width="150"
                              data-iframe-height="270"
                              data-share-badge-id={cert.badgeId}
                              data-share-badge-host="https://www.credly.com"
                              sx={{
                                width: 150,
                                minHeight: 270,
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <Stack key={cert.name} spacing={1.5}>
                              <Typography variant="h6" sx={{ fontWeight: 850 }}>
                                {cert.name}
                              </Typography>
                              <MuiLink
                                href={cert.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                              >
                                查看 Credly
                              </MuiLink>
                            </Stack>
                          ),
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              )}

              {selectedTab === "projects" && (
                <Box>
                  <PanelTitle icon={<CodeIcon />} title="個人作品與專案" />
                  <Grid container spacing={2}>
                    {projects.map((project) => (
                      <Grid size={{ xs: 12, md: 6 }} key={project.name}>
                        <Card variant="outlined" sx={{ height: "100%" }}>
                          <CardContent>
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="flex-start"
                              spacing={2}
                            >
                              <Box>
                                <Typography
                                  variant="h6"
                                  sx={{ fontWeight: 850 }}
                                >
                                  {project.name}
                                </Typography>
                                <Typography
                                  color="text.secondary"
                                  sx={{ mt: 0.5 }}
                                >
                                  {project.type}
                                </Typography>
                              </Box>
                              {project.link && (
                                <SmartLink href={project.link}>查看</SmartLink>
                              )}
                            </Stack>
                            <Divider sx={{ my: 2 }} />
                            <Stack component="ul" spacing={1} sx={{ pl: 2.5 }}>
                              {project.highlights.map((item) => (
                                <Typography
                                  component="li"
                                  key={item}
                                  sx={{ lineHeight: 1.8 }}
                                >
                                  {item}
                                </Typography>
                              ))}
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {selectedTab === "contact" && (
                <Box>
                  <PanelTitle icon={<ContactMailIcon />} title="聯絡方式" />
                  <Grid container spacing={2}>
                    {contacts.map((contact) => (
                      <Grid size={{ xs: 12, md: 4 }} key={contact.label}>
                        <Card variant="outlined" sx={{ height: "100%" }}>
                          <CardContent>
                            <Stack
                              spacing={2}
                              alignItems="center"
                              sx={{ py: 1 }}
                            >
                              <Box
                                sx={{
                                  width: 56,
                                  height: 56,
                                  display: "grid",
                                  placeItems: "center",
                                  borderRadius: "50%",
                                  color: "primary.main",
                                  bgcolor: "action.hover",
                                }}
                              >
                                {contact.icon}
                              </Box>
                              <Typography sx={{ fontWeight: 850 }}>
                                {contact.label}
                              </Typography>
                              {contact.action === "copy" ? (
                                <Button
                                  variant="outlined"
                                  startIcon={<ContentCopyIcon />}
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(
                                      contact.value,
                                    );
                                    setCopiedContact(contact.label);
                                  }}
                                >
                                  {copiedContact === contact.label
                                    ? "已複製"
                                    : "複製"}
                                </Button>
                              ) : (
                                <Button
                                  component="a"
                                  href={contact.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  variant="outlined"
                                  endIcon={<OpenInNewIcon />}
                                >
                                  開啟
                                </Button>
                              )}
                            </Stack>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          </Card>
        </Box>
      </Stack>
    </Box>
  );
}
