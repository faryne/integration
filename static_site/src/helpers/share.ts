export type ShareResult = "shared" | "copied" | "aborted" | "failed";

export interface ShareUrlOptions {
  title?: string;
  url?: string;
}

export async function shareUrl({
  title = document.title,
  url = window.location.href,
}: ShareUrlOptions = {}): Promise<ShareResult> {
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return "shared";
    }

    await navigator.clipboard.writeText(url);
    return "copied";
  } catch (error) {
    return (error as Error).name === "AbortError" ? "aborted" : "failed";
  }
}
