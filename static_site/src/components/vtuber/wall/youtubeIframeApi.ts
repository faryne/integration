// YouTube IFrame Player API：電視牆要個別控制靜音、暫停，一般的 embed iframe 做不到

export interface YouTubePlayer {
  mute(): void;
  unMute(): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
}

interface YouTubePlayerOptions {
  videoId: string;
  width: string;
  height: string;
  playerVars: Record<string, number>;
  events: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        options: YouTubePlayerOptions,
      ) => YouTubePlayer;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const API_URL = "https://www.youtube.com/iframe_api";
// 播放器分批建立，避免一次開幾十個 iframe 把瀏覽器卡住
const CREATE_INTERVAL_MS = 250;

let apiReady: Promise<NonNullable<Window["YT"]>> | null = null;
let queue = Promise.resolve();

// 整個頁面只載入一次 API script
function loadApi() {
  apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = API_URL;
    document.head.append(script);
  });
  return apiReady;
}

/** 排隊建立播放器（間隔 250ms）；建立前已取消（元件卸載）就不建立，回傳 null */
export function createYouTubePlayer(
  element: HTMLElement,
  options: YouTubePlayerOptions,
  isCancelled: () => boolean,
) {
  const created = queue.then(async () => {
    const YT = await loadApi();
    if (isCancelled()) return null;
    const player = new YT.Player(element, options);
    await new Promise((r) => setTimeout(r, CREATE_INTERVAL_MS));
    return player;
  });
  queue = created.then(() => undefined);
  return created;
}
