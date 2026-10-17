import StorytellerNewProject from "@/pages/storyteller/NewProject.tsx";
import { StorytellerEditorDataContext, type StorytellerEditorData } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { Box, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppBreadcrumbs } from "@writer/components/AppBreadcrumbs.tsx";
import { backend, type Project } from "@writer/lib/backend.ts";
import { invalidateEditorAssets, writerEditorData } from "@writer/lib/editorData.ts";

// 封面上傳改走 Go（原生選檔＋上傳）：網站的 S3 直傳無法經 ApiProxy 轉發
const formEditorData: StorytellerEditorData = {
  ...writerEditorData,
  pickAndUploadImage: async (project) => {
    const uploaded = await backend.UploadImageAsset(project);
    if (!uploaded) return null;
    invalidateEditorAssets(project);
    return { ...uploaded, alt_text: "", mime_type: "" };
  },
};

// 建立／編輯專案：直接沿用網站的 NewProject 表單（欄位、封面、變更網址確認、上限警告都一樣），
// Writer 只換掉存完要去哪、返回與麵包屑。project 為 null 時是建立模式。
export function ProjectFormPage({ project, onBack, onCreated }: {
  project: Project | null;
  onBack: () => void;
  onCreated: (projectId: string, next: "story" | "home") => void;
}) {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState<string>();
  useEffect(() => {
    void backend.SiteOrigin().then(setOrigin);
  }, []);
  const title = t(project ? "projects.edit" : "projects.create");
  const crumbs = project
    ? [{ label: t("projects.title"), onClick: onBack }, { label: project.name }, { label: title }]
    : [{ label: t("projects.title"), onClick: onBack }, { label: title }];

  return (
    <>
      <AppBreadcrumbs items={crumbs} />
      <Box sx={{ flex: 1, overflow: "auto", px: 3.5, py: 2.75 }}>
        <Typography variant="h5" sx={{ fontSize: 18, mb: 2 }}>{title}</Typography>
        <StorytellerEditorDataContext.Provider value={formEditorData}>
          <StorytellerNewProject embedded projectId={project?.public_id} publicOrigin={origin} onCreated={onCreated} onSaved={onBack} onCancel={onBack} />
        </StorytellerEditorDataContext.Provider>
      </Box>
    </>
  );
}
