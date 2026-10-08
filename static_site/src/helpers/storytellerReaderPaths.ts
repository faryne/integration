import { steamloomPath } from "@/helpers/steamloom.ts";

// 閱讀頁網址集中在這裡產生，避免各頁面各自手刻 work/... 字串，改版時漏改。
// 結構：work/:projectPath（作品首頁＝故事 Tab）、/lores（設定 Tab）、/discussions（討論 Tab）、/story/:id、/lore/:id；
// 分享連結把 work/:projectPath 換成 work/share/:token，其餘相同。

export const readerProjectBasePath = (projectPath: string) =>
  steamloomPath(`work/${projectPath}`);

export const readerShareBasePath = (shareToken: string) =>
  steamloomPath(`work/share/${shareToken}`);

export const readerLoresPath = (basePath: string) => `${basePath}/lores`;

// 作品首頁的「討論」分頁；?thread= 帶上時自動展開那一串
export const readerDiscussionsPath = (basePath: string) =>
  `${basePath}/discussions`;

export const readerStoryPath = (basePath: string, storyPublicId: string) =>
  `${basePath}/story/${storyPublicId}`;

export const readerStoryVersionPath = (
  basePath: string,
  storyPublicId: string,
  versionId: number,
) => `${readerStoryPath(basePath, storyPublicId)}/versions/${versionId}`;

export const readerLorePath = (basePath: string, lorePublicId: string) =>
  `${basePath}/lore/${lorePublicId}`;
