// 網站與 SteamLoom Writer 共用；Writer 透過 alias 直接 import（改這支也會影響 Writer）。

export function formatStorytellerDate(input: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input));
}
