// 圖像作品上傳流程的前端 mockup：後端的 storyteller_image_pages 還沒開始做
// （見 DevelopDocuments/storyteller/漫畫插圖閱讀器.md），先用 localStorage 模擬
// 存起來，讓「建立故事」入口分流出的圖像上傳流程可以在畫面之間保持一致的狀態，
// 方便先把 UX 定案。之後接上真正的後端時，把這個檔案換成呼叫真正的 API 就好，
// 呼叫端（ProjectDetail.tsx／ImageEpisodeEditor.tsx）的介面不用跟著改。
export interface StorytellerImageEpisodeMock {
  id: string;
  projectId: string;
  title: string;
  pageCount: number;
  coverDataUrl: string | null;
  updatedAt: string;
}

const storageKey = "storyteller:mock-image-episodes";

function readAll(): StorytellerImageEpisodeMock[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StorytellerImageEpisodeMock[]) : [];
  } catch {
    return [];
  }
}

function writeAll(list: StorytellerImageEpisodeMock[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(list));
}

export function listImageEpisodes(
  projectId: string | undefined,
): StorytellerImageEpisodeMock[] {
  if (!projectId) {
    return [];
  }
  return readAll()
    .filter((episode) => episode.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function saveImageEpisode(input: {
  projectId: string;
  title: string;
  pageCount: number;
  coverDataUrl: string | null;
}): StorytellerImageEpisodeMock {
  const episode: StorytellerImageEpisodeMock = {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: input.projectId,
    title: input.title,
    pageCount: input.pageCount,
    coverDataUrl: input.coverDataUrl,
    updatedAt: new Date().toISOString(),
  };
  writeAll([...readAll(), episode]);
  return episode;
}

export function deleteImageEpisode(id: string) {
  writeAll(readAll().filter((episode) => episode.id !== id));
}
