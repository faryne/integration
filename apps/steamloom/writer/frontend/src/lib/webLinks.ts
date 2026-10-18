import { steamloomUrlForOrigin } from "@/helpers/steamloom.ts";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";
import { backend, type DocumentItem, type Project } from "@writer/lib/backend.ts";

// 「在網站上開啟」的目標：讀者看得到的開閱讀頁（看讀者實際看到的樣子），其他開網站工作台的同一頁（作者在瀏覽器登入就能看）。
// 讀者看得到＝公開專案，或分享中且有分享 token 的專案；單篇故事還要已發布（completed）。設定一律開工作台。
function readerBase(project: Project) {
  if (project.visibility === "public") return `work/${project.public_id}-${project.slug}`;
  if (project.visibility === "unlisted" && project.share_token) return `work/share/${project.share_token}`;
  return "";
}

export function projectWebPath(project: Project) {
  return readerBase(project) || `my/workspace/${project.public_id}`;
}

export function documentWebPath(project: Project, item: Pick<DocumentItem, "kind" | "public_id" | "content_type" | "status">) {
  const base = readerBase(project);
  if (base && item.kind === "story" && item.status === "completed") return `${base}/story/${item.public_id}`;
  const segment = item.kind === "lore" ? "lore" : item.content_type === "image" ? "image" : "story";
  return `my/workspace/${project.public_id}/${segment}/${item.public_id}`;
}

// 依 Writer 連線的網站 origin（正式版 https://steamloom.works）組網址，用系統預設瀏覽器打開
export async function openOnWeb(path: string) {
  BrowserOpenURL(steamloomUrlForOrigin(await backend.SiteOrigin(), path));
}
