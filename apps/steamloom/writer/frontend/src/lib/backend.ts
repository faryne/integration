// Go 端（app.go）綁定方法的薄包裝：統一型別名稱與錯誤判斷，元件不直接碰 wailsjs 產生檔。
import * as App from "../../wailsjs/go/main/App";
import type { api, updater } from "../../wailsjs/go/models";

export type Profile = api.Profile;
export type Project = api.Project;
export type Workspace = api.Workspace;
export type WorkspaceGroup = api.Group;
export type DocumentItem = api.DocumentItem;
export type Document = api.Document;
export type Version = api.Version;
export type UpdateInfo = updater.Info;
// 對應 internal/api 的 DocumentKind
export type DocumentKind = "story" | "lore";

export const backend = App;

// Wails 會把 Go 的 error 轉成字串 reject；這兩個是 internal/auth 裡固定的錯誤代碼
const NOT_LOGGED_IN = "not_logged_in";
const LOGIN_CANCELED = "login_canceled";

export const errorMessage = (err: unknown) =>
  typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
export const isNotLoggedIn = (err: unknown) => errorMessage(err) === NOT_LOGGED_IN;
export const isLoginCanceled = (err: unknown) => errorMessage(err) === LOGIN_CANCELED;
