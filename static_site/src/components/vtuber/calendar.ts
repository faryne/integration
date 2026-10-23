import type { VtuberCalendarLinks } from "@/types/vtubers.ts";

// hololive 總表（Apps Script 時代建的）；後端 service/vtuber/calendar_sync.go 的 AllCalendarID 也寫死同一個
export const ALL_CALENDAR_ID =
  "tisupenl6m3lnrjs26kipm1iu0@group.calendar.google.com";

// 跟後端 service/vtuber/query.go 的 calendarLinks 同一套網址
export function calendarLinks(calendarId: string): VtuberCalendarLinks {
  const id = encodeURIComponent(calendarId);
  return {
    calendar_id: calendarId,
    subscribe_url: `https://calendar.google.com/calendar/r?cid=${id}`,
    embed_url: `https://calendar.google.com/calendar/embed?src=${id}&ctz=${encodeURIComponent("Asia/Taipei")}&mode=AGENDA`,
    ics_url: `https://calendar.google.com/calendar/ical/${calendarId}/public/basic.ics`,
  };
}
