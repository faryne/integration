// faryne.dev 內頁 layout mockup：導覽資料照抄 static_site/src/data/navigation.ts
const NAV = [
  { title: "首頁", href: "/" },
  {
    title: "大人的喜好",
    sub: "二次元與成人向的索引、收藏工具",
    items: [
      { title: "Galgame 影片", href: "https://galgame.tv/", external: true, description: "收集美少女遊戲的 OP / ED / PV 等，採定時掃描追蹤頻道方式索引資料" },
      { title: "難以名狀的抓圖器", href: "https://neko.maid.tw/", external: true, description: "爬取 Pixiv / Niconico 等平台的圖片，並進入收藏" },
      { title: "二次元常用英文 tag", href: "/yandere/tags" },
      { title: "AV 影片搜尋", href: "/av/video", description: "定時索引 Fanza(a.k.a. DMM) AV影片資訊" },
      { title: "AV 女優搜尋", href: "/av/actress", description: "定時索引 AV 女優資訊" },
      { title: "SteamLoom", href: "https://steamloom.works/", external: true },
    ],
  },
  {
    title: "資料",
    sub: "定時抓取、整理過的公開資料",
    items: [
      { title: "匯率", href: "/data/rates", description: "列出主要銀行對各貨幣的匯率資料，也可以計算出在哪間銀行買賣最划算" },
      { title: "NCCC 信用卡消費資料", href: "/data/nccc", description: "列出 NCCC 信用卡的消費資料，用以資料統計" },
      { title: "YieldMax ETF 配息統計", href: "/data/etf/yieldmax", description: "列出 YieldMax ETF 的配息資料，並附上簡單計算總配息的計算器" },
      { title: "台股 ETF 資訊", href: "/data/etf/twse", description: "追蹤台股 ETF 配息資訊", requiresAuth: true },
      { title: "即時消防出勤記錄", href: "/data/fire/realtime", description: "列出台灣各縣市消防即時出勤記錄" },
      { title: "台電敦親睦鄰捐助", href: "/data/taipower/neighbor", description: "追蹤/統計台電敦親睦鄰捐助資訊" },
      { title: "台灣指標", href: "/data/tw-stats", description: "收集主計總處所每年定期發布的台灣各類相關指標，包含且不限於：人口、土地面積等" },
    ],
  },
  {
    title: "方便工具",
    sub: "自己會用到、順手公開的小工具",
    items: [
      { title: "爬蟲工具", href: "/tools/crawler", description: "使用 css selectors 來爬取網頁資料" },
      { title: "Threads 截圖工具", href: "/tools/thread/capture", description: "擷取 threads 上貼文內容並轉化為圖片" },
      { title: "網站截圖工具", href: "/tools/webshot", description: "擷取網頁內容並轉化為圖片" },
      { title: "Userscripts", href: "/tools/userscripts", description: "收集我做的 userscripts " },
      { title: "MCP 方法列表", href: "/tools/mcp", description: "讀取 /mcp tools/list 並列出可呼叫方法與參數說明" },
    ],
  },
  { title: "部落格", href: "https://blog.faryne.dev", external: true },
];

const SCREENS = { rates: "/data/rates", crawler: "/tools/crawler", etf: "/data/etf/twse" };
// 會員登入入口只在導覽項目標了 requiresAuth 的功能下出現（含其子路徑）
const needsAuth = (path) => Boolean(locate(path).item?.requiresAuth);
// 色彩模式偏好：system 跟隨系統（預設）、light、dark；實作時存 localStorage 並接 MUI colorSchemes
const MODE_KEY = "faryne-color-mode";
const MODES = [
  { key: "system", label: "跟隨系統", icon: "◐" },
  { key: "light", label: "淺色", icon: "☀" },
  { key: "dark", label: "深色", icon: "☾" },
];
const readMode = () => {
  try { return localStorage.getItem(MODE_KEY) || "system"; } catch { return "system"; }
};
// theme：mockup 控制列模擬的「系統偏好」；mode：使用者在 header 選的偏好
const state = { screen: "rates", view: "desktop", theme: "light", mode: readMode(), pop: null, loggedIn: false, openMenu: null, drawer: false };
const effectiveTheme = () => (state.mode === "system" ? state.theme : state.mode);
const $ = (s) => document.querySelector(s);

// 由目前路徑推導分類與頁面（實作時抽成 helper，breadcrumb 與 header 高亮共用）
const locate = (path) => {
  for (const g of NAV)
    if (g.items) for (const it of g.items) if (!it.external && (path === it.href || path.startsWith(it.href + "/"))) return { group: g, item: it };
  return {};
};

const ext = (it) => (it.external ? '<span class="ext">↗</span>' : "");

function header(path) {
  const { group } = locate(path);
  const nav = NAV.map((n, i) =>
    n.items
      ? `<button class="nav-item ${group === n ? "current" : ""} ${state.openMenu === i ? "open" : ""}" data-menu="${i}">${n.title}<span class="chev">▼</span></button>`
      : `<a class="nav-item" href="#">${n.title}${ext(n)}</a>`,
  ).join("");
  const m = NAV[state.openMenu];
  const mega = m
    ? `<div class="mega-inner">
        <div><div class="mega-title">${m.title}</div><div class="mega-sub">${m.sub}</div></div>
        <div class="mega-grid">${m.items
          .map((it) => `<a class="mega-link ${it.href === path ? "here" : ""}" href="#"><b>${it.title}${ext(it)}</b>${it.description ? `<p>${it.description}</p>` : ""}</a>`)
          .join("")}</div>
      </div>`
    : "";
  return `
  <header class="hdr">
    <div class="hdr-inner">
      <a class="brand" href="#"><img src="faryne-logo.png" alt="" /><span><b>Faryne 的實驗室</b><small>faryne.dev</small></span></a>
      <nav class="nav">${nav}</nav>
      <div class="hdr-right">
        ${needsAuth(path) ? account() : ""}
        ${modeSwitch()}
        <button class="icon-btn burger" data-drawer aria-label="選單">${state.drawer ? "✕" : "☰"}</button>
      </div>
    </div>
    <div class="mega" ${m ? "" : "hidden"}>${mega}</div>
  </header>
  <div class="mega-scrim" data-close ${m ? "" : "hidden"}></div>
  ${drawer(path)}`;
}

// 色彩模式切換：圖示反映目前偏好，點開三選一
function modeSwitch() {
  const cur = MODES.find((m) => m.key === state.mode);
  return `<div class="pop-wrap">
    <button class="icon-btn" data-pop="mode" aria-label="色彩模式：${cur.label}" aria-haspopup="menu" aria-expanded="${state.pop === "mode"}">${cur.icon}</button>
    <div class="pop-menu mode-menu" role="menu" ${state.pop === "mode" ? "" : "hidden"}>${MODES.map(
      (m) => `<button role="menuitemradio" aria-checked="${m.key === state.mode}" class="${m.key === state.mode ? "on" : ""}" data-mode="${m.key}"><span>${m.icon}</span>${m.label}<i>✓</i></button>`,
    ).join("")}</div>
  </div>`;
}

// 會員：未登入顯示「登入」按鈕；已登入顯示頭像，點開有我的最愛與登出
function account() {
  if (!state.loggedIn)
    return `<button class="login-btn" data-login><span class="g">G</span><span class="login-text">登入</span></button>`;
  return `<div class="pop-wrap">
    <button class="avatar-btn" data-pop="account" aria-label="帳號選單" aria-haspopup="menu" aria-expanded="${state.pop === "account"}">F</button>
    <div class="pop-menu account-menu" role="menu" ${state.pop === "account" ? "" : "hidden"}>
      <div class="acct-head"><div class="avatar-btn lg">F</div><div><b>Faryne</b><small>faryne@example.com</small></div></div>
      <a role="menuitem" href="#" data-screen="etf">★ 我的最愛 ETF</a>
      <button role="menuitem" data-logout>登出</button>
    </div>
  </div>`;
}

function drawer(path) {
  if (!state.drawer) return '<div class="drawer" hidden></div>';
  const { group } = locate(path);
  return `<div class="drawer">${NAV.map((n) =>
    n.items
      ? `<details ${group === n ? "open" : ""}><summary>${n.title}<span class="chev">▾</span></summary>${n.items
          .map((it) => `<a class="d-link ${it.href === path ? "here" : ""}" href="#">${it.title} ${ext(it)}${it.description ? `<p>${it.description}</p>` : ""}</a>`)
          .join("")}</details>`
      : `<a class="d-top" href="#">${n.title} ${ext(n)}</a>`,
  ).join("")}</div>`;
}

function crumbs(path) {
  const { group, item } = locate(path);
  return `<div class="crumb-bar"><nav class="crumbs" aria-label="breadcrumb">
    <a href="#">首頁</a><span class="sep">/</span><span>${group.title}</span><span class="sep">/</span><span class="now">${item.title}</span>
  </nav></div>`;
}

function footer() {
  const direct = NAV.filter((n) => !n.items);
  const col = (title, items) => `<div><h4>${title}</h4>${items.map((it) => `<a href="#">${it.title} ${ext(it)}</a>`).join("")}</div>`;
  return `<footer class="ftr"><div class="ftr-inner">
    <div class="ftr-brand"><img src="faryne-logo.png" alt="" /><div>Powered By Faryne<br /><a href="#">faryne.dev</a></div></div>
    <nav class="ftr-nav">${col("主要連結", direct)}${NAV.filter((n) => n.items).map((n) => col(n.title, n.items)).join("")}</nav>
  </div></footer>`;
}

// ===== 頁面內容（只是示意，維持各頁原本的結構） =====
const pages = {
  rates: () => `
    <h1 class="page-title">匯率查詢</h1>
    <p class="page-desc">列出主要銀行對各貨幣的匯率資料，也可以計算出在哪間銀行買賣最划算</p>
    <div class="grid-rates">
      <div class="card">
        <h3>幣別</h3><div class="muted">已選 1 個</div>
        <div class="field" style="margin-top:10px">搜尋代碼或名稱</div>
        <div class="chips"><span class="chip on">USD</span><span class="chip">JPY</span><span class="chip">EUR</span><span class="chip">CNY</span><span class="chip">KRW</span></div>
      </div>
      <div class="stack">
        <div class="card row">
          <div class="field"><label>開始日期</label>2026/10/22</div>
          <div class="field"><label>結束日期</label>2026/10/22</div>
        </div>
        <div class="card">
          <h3>換匯試算</h3><div class="muted">以目前所選的 USD 金額計算新台幣結果</div>
          <div class="row" style="margin-top:10px"><div class="field">輸入 USD 金額</div><button class="btn">試算</button></div>
          <div class="info">ⓘ 銀行賣出：你向銀行買 USD，支付新台幣；表格會顯示同日成本最低的銀行。</div>
        </div>
        <div class="card" style="padding:0">
          <div class="tabs" style="padding:0 12px"><span class="tab on">USD</span><span class="tab">JPY</span></div>
          <div class="table-wrap"><table>
            <thead><tr><th>日期</th><th>銀行</th><th class="num">現金買入</th><th class="num">現金賣出</th><th class="num hide-m">即期買入</th><th class="num hide-m">即期賣出</th></tr></thead>
            <tbody>
              <tr class="best"><td>10/22</td><td>台新銀行</td><td class="num">31.985</td><td class="num">32.385</td><td class="num hide-m">32.235</td><td class="num hide-m">32.335</td></tr>
              <tr><td>10/22</td><td>國泰世華</td><td class="num">31.960</td><td class="num">32.460</td><td class="num hide-m">32.210</td><td class="num hide-m">32.360</td></tr>
              <tr><td>10/22</td><td>台灣銀行</td><td class="num">31.900</td><td class="num">32.570</td><td class="num hide-m">32.200</td><td class="num hide-m">32.350</td></tr>
              <tr><td>10/22</td><td>玉山銀行</td><td class="num">31.930</td><td class="num">32.530</td><td class="num hide-m">32.215</td><td class="num hide-m">32.345</td></tr>
            </tbody>
          </table></div>
        </div>
      </div>
    </div>`,
  etf: () => `
    <h1 class="page-title">台股 ETF 資訊</h1>
    <p class="page-desc">追蹤台股 ETF 配息資訊</p>
    <div class="card">
      ${state.loggedIn ? `<button class="btn ghost warn" style="margin-bottom:12px">★ 只看我的最愛（2）</button>` : ""}
      <div class="row"><div class="field" style="flex:4">搜尋代碼、名稱、公司或關鍵字 (如：元大、科技...)</div><button class="btn">搜尋</button></div>
      <div class="chips"><span class="chip on">全部</span><span class="chip">月配</span><span class="chip">季配</span><span class="chip">債券</span></div>
    </div>
    <div class="card" style="padding:0;margin-top:16px"><div class="table-wrap"><table>
      <thead><tr>${state.loggedIn ? "<th></th>" : ""}<th>代碼</th><th>名稱</th><th class="num">殖利率</th><th class="num hide-m">最近配息</th><th class="hide-m">配息頻率</th></tr></thead>
      <tbody>${[["0056", "元大高股息", "6.12%", "1.07", "季配", 1], ["00878", "國泰永續高股息", "5.84%", "0.47", "季配", 1], ["00919", "群益台灣精選高息", "8.03%", "0.72", "季配", 0], ["00929", "復華台灣科技優息", "7.21%", "0.11", "月配", 0]]
        .map(([c, n, y, d, f, fav]) => `<tr>${state.loggedIn ? `<td class="star ${fav ? "on" : ""}">${fav ? "★" : "☆"}</td>` : ""}<td>${c}</td><td>${n}</td><td class="num">${y}</td><td class="num hide-m">${d}</td><td class="hide-m">${f}</td></tr>`)
        .join("")}</tbody>
    </table></div></div>`,
  crawler: () => `
    <h1 class="page-title">爬蟲工具</h1>
    <p class="page-desc">使用 css selectors 來爬取網頁資料</p>
    <div class="stack">
      <div class="card">
        <div class="row">
          <div class="field" style="flex:3"><label>網址</label>https://news.ycombinator.com/</div>
          <div class="field"><label>Selector</label>.titleline &gt; a</div>
          <button class="btn">開始抓取</button>
        </div>
        <div class="chips"><span class="chip on">Headless Chrome</span><span class="chip">純 HTTP</span><span class="chip">等待 2 秒</span></div>
      </div>
      <div class="card">
        <h3>結果</h3><div class="muted" style="margin-bottom:10px">共 30 筆・耗時 1.82s</div>
        <div class="code-area">[
  { "text": "Show HN: I built a tiny Go scheduler", "href": "https://…" },
  { "text": "The hidden cost of ORMs", "href": "https://…" },
  { "text": "Postgres 19 released", "href": "https://…" }
]</div>
        <div class="row" style="margin-top:12px"><button class="btn ghost">下載 JSON</button><button class="btn ghost">複製</button></div>
      </div>
    </div>`,
};

function render() {
  const path = SCREENS[state.screen];
  document.documentElement.dataset.theme = effectiveTheme();
  $("#device").className = `device ${state.view}`;
  $("#site").innerHTML = `${header(path)}${crumbs(path)}<main class="main"><div class="container">${pages[state.screen]()}</div></main>${footer()}`;
}

// ===== 互動 =====
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-screen],[data-view],[data-theme-option],[data-menu],[data-close],[data-drawer],[data-pop],[data-mode],[data-login],[data-logout],a");
  // 點小選單外任何地方都收起
  if (state.pop && !e.target.closest(".pop-wrap")) { state.pop = null; if (!t) return render(); }
  if (!t) return;
  if (t.tagName === "A") e.preventDefault();
  if (t.dataset.pop) Object.assign(state, { pop: state.pop === t.dataset.pop ? null : t.dataset.pop, openMenu: null });
  else if ("login" in t.dataset) state.loggedIn = true; // 實作時是 Google 登入 popup
  else if ("logout" in t.dataset) Object.assign(state, { loggedIn: false, pop: null });
  else if (t.dataset.mode) {
    Object.assign(state, { mode: t.dataset.mode, pop: null });
    try { localStorage.setItem(MODE_KEY, state.mode); } catch {}
  } else if (t.dataset.screen) Object.assign(state, { screen: t.dataset.screen, openMenu: null, drawer: false, pop: null });
  else if (t.dataset.view) Object.assign(state, { view: t.dataset.view, openMenu: null, drawer: false });
  else if (t.dataset.themeOption) state.theme = t.dataset.themeOption;
  else if (t.dataset.menu) state.openMenu = state.openMenu === +t.dataset.menu ? null : +t.dataset.menu;
  else if ("close" in t.dataset) state.openMenu = null;
  else if ("drawer" in t.dataset) state.drawer = !state.drawer;
  else if (t.tagName === "A") state.openMenu = null;
  else return;
  for (const [attr, key] of [["screen", "screen"], ["view", "view"], ["themeOption", "theme"]])
    document.querySelectorAll(`[data-${attr.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}]`).forEach((b) => b.classList.toggle("active", b.dataset[attr] === state[key]));
  render();
});
document.addEventListener("keydown", (e) => e.key === "Escape" && ((state.openMenu = null), (state.pop = null), render()));
$("#notesToggle").addEventListener("change", (e) => ($("#notes").hidden = !e.target.checked));

render();
