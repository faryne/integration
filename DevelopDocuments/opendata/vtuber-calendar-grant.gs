// 一次性腳本：把 Apps Script 時代建的行事曆交給 Go 端的 service account 管理。
// 行事曆的擁有者是你的 Google 帳號，service account 沒有權限就不能改事件，只有擁有者能幫它加權限，所以這步要在 Apps Script 做。
// 行事曆 ID 的對應不用從這裡匯出：Go 端的 -cmd vtuber-import-calendars 會直接讀舊 Firebase 的 hololive/calendar。
//
// 貼到「舊的」Apps Script 專案執行（要用到同一個檔案裡的 firebase 物件）：
// 1. 左側「服務」＋，加入「Google Calendar API」（進階服務，識別碼保留 Calendar）
// 2. 把 SERVICE_ACCOUNT 換成新 Firebase 專案的 service account email（金鑰 JSON 裡的 client_email）
// 3. 執行 grantCalendarsToServiceAccount，到「執行記錄」看有沒有 skip 的行事曆
//
// 給 owner 權限：改事件之外，藝人改名時 Go 也要能改行事曆名稱。
const SERVICE_ACCOUNT = "xxx@your-project.iam.gserviceaccount.com";

function grantCalendarsToServiceAccount() {
  const calendars = firebase.getData("hololive/calendar") || {};
  let granted = 0;
  for (const key in calendars) {
    const id = calendars[key];
    try {
      Calendar.Acl.insert({ role: "owner", scope: { type: "user", value: SERVICE_ACCOUNT } }, id, { sendNotifications: false });
      granted++;
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
    Utilities.sleep(500);
  }
  Logger.log("granted " + granted + " / " + Object.keys(calendars).length);
}
