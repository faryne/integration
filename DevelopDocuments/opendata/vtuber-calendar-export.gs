// 一次性腳本：把 Apps Script 時代建的行事曆交給 Go 端的 service account 管理，並匯出給 Go 匯入的 JSON。
// 貼到「舊的」Apps Script 專案執行（要用到同一個檔案裡的 firebase 物件，讀 hololive/calendar 節點）。
//
// 1. 左側「服務」＋，加入「Google Calendar API」（進階服務，識別碼保留 Calendar）
// 2. 把 SERVICE_ACCOUNT 換成新 Firebase 專案的 service account email（金鑰 JSON 裡的 client_email）
// 3. 執行 exportCalendarsForGo，到「執行記錄」複製最後那行 JSON，存成檔案（例如 calendars.json）
// 4. Go 端：go run . -cmd vtuber-import-calendars -calendarFile calendars.json
//
// service account 給 owner 權限：改事件之外，藝人改名時 Go 也要能改行事曆名稱。
const SERVICE_ACCOUNT = "xxx@your-project.iam.gserviceaccount.com";

function exportCalendarsForGo() {
  const calendars = firebase.getData("hololive/calendar") || {};
  const out = {};
  for (const key in calendars) {
    const id = calendars[key];
    try {
      Calendar.Acl.insert({ role: "owner", scope: { type: "user", value: SERVICE_ACCOUNT } }, id, { sendNotifications: false });
    } catch (e) {
      Logger.log("skip " + key + " (" + id + "): " + e);
      continue;
    }
    try {
      // 確保是公開行事曆，網站上的訂閱連結才看得到
      Calendar.Acl.insert({ role: "reader", scope: { type: "default" } }, id);
    } catch (e) {
      Logger.log("make public failed " + key + ": " + e);
    }
    out[key] = id;
    Utilities.sleep(500);
  }
  Logger.log(JSON.stringify(out));
}
