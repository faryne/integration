import { measurementId } from "@/lib/analyticsConfig.ts";

type GtagCommand = "config" | "event" | "js";
type GtagArguments = [GtagCommand, ...unknown[]];

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: GtagArguments) => void;
  }
}

let initialized = false;

export function initializeAnalytics() {
  if (!measurementId || initialized || typeof window === "undefined") {
    return false;
  }

  window.dataLayer = window.dataLayer || [];
  // gtag.js 需要原始 arguments 物件，展開成 Array 會讓命令無法正確處理。
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    send_page_view: false,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  initialized = true;
  return true;
}

export function trackPageView(path: string) {
  if (!measurementId) {
    return;
  }
  initializeAnalytics();
  if (!initialized) {
    return;
  }

  window.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}

/** 送自訂事件（例：首頁版面切換、評分）；沒設定 GA 時不做事 */
export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (!measurementId) {
    return;
  }
  initializeAnalytics();
  if (!initialized) {
    return;
  }
  window.gtag("event", name, params);
}
