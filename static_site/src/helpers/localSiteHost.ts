// 本機開發用的獨立站網域（joyu.localhost、galgame.localhost、neko.localhost、steamloom.localhost）：
// *.localhost 瀏覽器會自動解析到 127.0.0.1，用來在本機看跟正式網域一樣的獨立站模式（網址不帶 /galgame 之類的前綴）。
// 這種網域下，連回主站、給外部工具的網址都要指回本機，不能指到正式機

/** 目前是不是本機的獨立站網域 */
export const isLocalSiteHost = () =>
  typeof window !== "undefined" &&
  window.location.hostname.endsWith(".localhost");

/** 本機主站（faryne.dev）的 origin：同一個 dev server、hostname 換回 localhost */
export const localMainOrigin = () => `http://localhost:${window.location.port}`;
