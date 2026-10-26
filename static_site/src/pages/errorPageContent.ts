import { MASCOT_ASSET_CDN_BASE } from "@/helpers/mascotAssets.ts";

export type ErrorPageSite = "faryne" | "nekomaid" | "galgame";

type ErrorContent = { title: string; message: string };

// 各站錯誤頁沿用同一版型，但文案與看板娘須符合目前站點。
export const errorPageContent: Record<
  ErrorPageSite,
  Record<number, ErrorContent>
> = {
  faryne: {
    400: {
      title: "請求格式不太對",
      message: "送來的資料格式有點不對，確認後再試一次吧。",
    },
    401: {
      title: "需要先登入",
      message: "這份資料需要登入後才能查看，請先登入。",
    },
    403: {
      title: "沒有瀏覽權限",
      message: "這裡目前無法進入，請確認你的存取權限。",
    },
    404: {
      title: "找不到這個頁面",
      message: "這裡暫時沒有想找的內容，先回首頁看看吧。",
    },
    429: {
      title: "查詢太頻繁了",
      message: "請求有點密集，稍等一下再試一次吧。",
    },
    500: {
      title: "伺服器出了點狀況",
      message: "處理請求時出了點狀況，請稍後再試。",
    },
    503: {
      title: "服務暫時休息中",
      message: "服務目前無法使用，請稍後再回來看看。",
    },
  },
  nekomaid: {
    400: {
      title: "請求格式不太對",
      message:
        "喵嗚，主人送來的資料女僕看不太懂。請確認輸入內容後，再交給我一次喵。",
    },
    401: {
      title: "需要先登入",
      message: "主人還沒有通行證喵。請先登入，女僕才能帶你進去看這份資料。",
    },
    403: {
      title: "沒有瀏覽權限",
      message:
        "這個房間目前不能讓主人進去喵。若覺得不應該被擋下，請再確認權限設定。",
    },
    404: {
      title: "找不到這份資料",
      message: "文件好像滑到別處了，我再幫你找找。",
    },
    429: {
      title: "查詢太頻繁了",
      message:
        "喵嗚，主人問得太快，女僕忙不過來了。請休息一下，過一陣子再來問喵。",
    },
    500: {
      title: "伺服器累倒了",
      message:
        "女僕後台好像打翻茶盤了喵。請稍後再試一次，或把狀況交給管理員檢查。",
    },
    503: {
      title: "服務暫時休息中",
      message: "女僕正在整理房間，服務暫時無法使用喵。請稍後再回來看看。",
    },
  },
  galgame: {
    400: {
      title: "請求格式不太對",
      message: "這份資料好像讀取不了，確認內容後再試一次吧。",
    },
    401: {
      title: "需要先登入",
      message: "這段內容要登入後才能查看，先完成登入吧。",
    },
    403: {
      title: "沒有瀏覽權限",
      message: "目前無法觀看這段內容，請確認你的存取權限。",
    },
    404: {
      title: "找不到這個頁面",
      message: "這裡暫時沒有想看的內容，先回首頁看看吧。",
    },
    429: {
      title: "查詢太頻繁了",
      message: "播放清單更新得有點快，稍等一下再試試。",
    },
    500: {
      title: "播放暫時中斷",
      message: "資料處理時出了點狀況，請稍後再試。",
    },
    503: {
      title: "暫時沒電了",
      message: "資料暫時取不到，休息一下再回來看看吧。",
    },
  },
};

export const fallbackErrorContent: Record<ErrorPageSite, ErrorContent> = {
  faryne: {
    title: "發生了一點小狀況",
    message: "這次的請求暫時處理不了，請稍後再試一次。",
  },
  nekomaid: {
    title: "發生了一點小狀況",
    message:
      "喵嗚，女僕這邊暫時處理不了主人想看的內容。請稍後再試一次，或先回首頁休息一下喵。",
  },
  galgame: {
    title: "暫時無法讀取",
    message: "想看的內容暫時取不到，請稍後再試一次。",
  },
};

export const errorPageMascots = {
  faryne: {
    src: `${MASCOT_ASSET_CDN_BASE}/error-page/faryne-error.png`,
    alt: "大姐看著暫時斷線的 MBP",
  },
  nekomaid: {
    src: `${MASCOT_ASSET_CDN_BASE}/error-page/nekomaid-error.png`,
    alt: "二姐接住滑落的文件",
  },
  galgame: {
    src: `${MASCOT_ASSET_CDN_BASE}/error-page/galgame-error.png`,
    alt: "三姐無奈地鴨子座，拿著低電量裝置",
  },
} as const;
