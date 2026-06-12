const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

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
  window.gtag = (...args: GtagArguments) => {
    window.dataLayer.push(args);
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
