// galgame.tv 版面改善 mockup：資料取自本機 API 快照，純前端渲染，不打任何 API
const brands = [
  { id: "hook", name: "HOOKSOFT", avatar: "https://yt3.ggpht.com/y8vaqSArkEtGFFyFGqXe0XrrHWHSrECV5WF3ynOwYiNFCbdcVu9GO55C3N8kOWeh9wpy7mPtNjc=s240-c-k-c0x00ffffff-no-rj",
    desc: "HOOKSOFT系列ブランドの公式チャンネルです。\nHOOKSOFT、SMEE、ASa Project、Tilyの様々な動画を公開しています。" },
  { id: "palette", name: "ぱれっと", avatar: "https://yt3.ggpht.com/TgM_CJ6qXCboeaVCq_nmxZNkwEwB6MRyNGQ4Whqye_ZcO3ZWc7wM7l5yOqkOk3XAiixUYCidPA=s240-c-k-c0x00ffffff-no-rj", desc: "" },
  { id: "galex", name: "Galex Soft", avatar: "https://yt3.ggpht.com/ly6GAQL_klpRwIsZmIZVI6p42vAHiQWIqEuhLT6pUTjgqk0QOBI_HWF2OSEuCoXZZhzUXyqt=s240-c-k-c0x00ffffff-no-rj",
    desc: "美少女ゲームインディブランド\n「GALEX SOFT」の公式YouTube" },
];
const B = Object.fromEntries(brands.map((b) => [b.id, b]));

// 影片類型：依標題關鍵字判斷，順序有意義（「体験版プレイムービー」要先於 PV／OP 判斷）
const TYPES = [
  ["trial", /体験版/, "體驗版"],
  ["op", /OP|オープニング/, "OP"],
  ["pv", /PV|プロモーション/, "PV"],
  ["teaser", /ティザー/, "預告"],
];
const typeOf = (title) => TYPES.find(([, re]) => re.test(title)) ?? ["other", null, "其他"];
// 作品名：取標題中類型關鍵字之前的部分，例如「トリプルペアリング -Triple Pairing- 体験版…」→「トリプルペアリング -Triple Pairing-」
const workOf = (title) => title.replace(/[『』「」]/g, "").split(/\s*(?:OP|オープニング|PV|プロモーション|体験版|ティザー)/)[0].trim();

// [youtube id, 品牌, 日期, 秒數, 標題]
const videos = [
  ["W_pdQr_ghjc", "hook", "2026/10/2", 107, "ワンナイトアフター OPムービー"],
  ["T__R2AwNgFs", "hook", "2026/8/14", 1620, "王様恋愛 体験版プレイムービー04"],
  ["ZDxA3BSsUYA", "hook", "2026/8/14", 3394, "王様恋愛 体験版プレイムービー03"],
  ["-ZHAkIqQZCg", "hook", "2026/8/14", 2651, "王様恋愛 体験版プレイムービー02"],
  ["p0Tc4qcCHeg", "hook", "2026/8/14", 3013, "王様恋愛 体験版プレイムービー01"],
  ["t2JUlgLAzgw", "hook", "2026/7/31", 113, "王様恋愛 OPムービー"],
  ["y1p1eEeHxoE", "hook", "2026/7/24", 33, "ワンナイトアフター ティザームービー"],
  ["GyVqTuc0GcA", "palette", "2026/4/30", 0, "『as:9-nine- ARTEISIA』 OPムービー"],
  ["rBrocDKBk8g", "hook", "2026/6/5", 0, "両腕が折れたのでHなお世話をされる話 OPムービー"],
  ["k6QCg3l35Io", "hook", "2026/5/29", 0, "王様恋愛 ティザームービー"],
  ["Hy6jjmO4-GQ", "hook", "2026/4/24", 0, "トリプルペアリング -Triple Pairing- 体験版プレイムービー06"],
  ["Dj_2Bw0Fj0E", "hook", "2026/4/24", 0, "トリプルペアリング -Triple Pairing- 体験版プレイムービー05"],
].map(([id, brand, date, sec, title]) => ({ id, brand: B[brand], date, sec, title, type: typeOf(title), work: workOf(title) }));

const thumb = (id, size = "mqdefault") => `https://i.ytimg.com/vi/${id}/${size}.jpg`;
const dur = (s) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");
const badge = (v) => `<span class="type-badge type-${v.type[0]}">${v.type[2]}</span>`;

// 每個畫面的改動說明（對應提案文件章節）
const notes = {
  home: [
    "<b>導覽縮成 3 項</b>（影片／品牌／我的最愛）。原本的「全部影片／最新影片／品牌」跟首頁分頁重複，拿掉後外語也不會再擠。",
    "<b>搜尋改成單一欄位</b>，不用先選「影片／品牌」，結果頁同時列出符合的品牌與影片（見「搜尋結果」）。",
    "<b>投稿收進「＋ 投稿」選單</b>，管理／登出收進頭像選單，頂部只留高頻操作。",
    "<b>首頁加品牌橫列</b>，品牌不再藏在第三個分頁；只顯示品牌名，不放 YouTube 頻道的影片數（那是整個頻道的數字，不是收錄數）。",
    "<b>篩選列分兩組</b>：類型（OP／PV／體驗版／預告）與時間（全部／7 天內／30 天內）。類型是型錄站的核心資訊；「最近一天內」常常是空的，所以改成 7／30 天。",
    "<b>影片卡</b>：縮圖左上角放類型標籤、右下角放片長；縮圖下方沿用現在的品牌 chip，再接兩行標題。一列 4 張。",
    "<b>收藏星星改成 hover 才出現</b>（手機上一直顯示），縮圖比較乾淨。",
    "切到 <b>Mobile</b>：底部導覽列加上搜尋框常駐。原本手機上導覽和搜尋整個消失，到不了品牌、收藏、投稿頁。",
  ],
  search: [
    "搜尋結果頁同時列出<b>符合的品牌</b>（橫列）和<b>符合的影片</b>（同一套影片卡），直接用現有的兩支 API，後端不用改。",
    "保留原本 <code>?keyword=</code> 的網址格式，分享連結和舊書籤都還能用。",
  ],
  brand: [
    "<b>拿掉訂閱數</b>，改成「收錄 N 部影片 · 最新上檔日期」。這兩個是 galgame.tv 自己的數字，從品牌影片列表 API 的 total 和第一筆資料就拿得到。",
    "連結（YouTube／官網）和「收藏品牌」放在同一列；介紹文字照原文換行。",
    "原本的「所有影片／最新上檔」分頁改成跟首頁一樣的篩選列（類型＋時間），全站只有一套篩選 UI。",
  ],
  video: [
    "<b>拿掉 YouTube 式的「頻道列＋訂閱數」</b>，改成一張<b>作品資訊卡</b>：作品名、品牌、類型、發佈日、片長、標籤。",
    "主要操作只留「收藏影片」和「在 YouTube 觀看」；讚／倒讚縮成右側的小圖示按鈕，不當主角。",
    "介紹改成一般的段落區塊，預設顯示前幾行，按「顯示更多」才展開，不再收合在側欄。",
    "<b>右側欄先列「同一作品的其他影片」</b>（同品牌、作品名相同，例如這部 OP 和它的預告），再列一般的相關影片。作品名用標題前綴判斷，不用改後端。",
    "上一則／下一則保留，改成比較輕量的卡片。",
  ],
};

const state = { screen: "home", view: "desktop", theme: "light", menu: null, type: "all", time: "all", descOpen: false };

function header() {
  const nav = [["home", "影片"], ["brand", "品牌"], ["fav", "我的最愛"]];
  const activeNav = state.screen === "brand" ? "brand" : state.screen === "video" ? "" : "home";
  return `
  <header class="header">
    <div class="container header-row">
      <a class="logo" data-go="home"><img src="faryne-logo.png" alt="" onerror="this.style.display='none'" />Galgame TV</a>
      <nav class="nav desktop-only">${nav.map(([k, t]) => `<a class="${k === activeNav ? "active" : ""}" data-go="${k === "fav" ? "home" : k}">${t}</a>`).join("")}</nav>
      <label class="search desktop-only">🔍<input placeholder="搜尋影片或品牌" value="${state.screen === "search" ? "王様恋愛" : ""}" data-search /></label>
      <div class="header-actions">
        <div class="menu-wrap desktop-only">
          <button class="btn" data-menu="submit">＋ 投稿</button>
          ${state.menu === "submit" ? `<div class="menu"><a>追加頻道</a><a>追加影片</a></div>` : ""}
        </div>
        <button class="icon-btn" title="介面語言">🌐</button>
        <div class="menu-wrap">
          <button class="icon-btn" data-menu="user"><span class="avatar-sm"></span></button>
          ${state.menu === "user" ? `<div class="menu"><a>我的最愛</a><a>追加頻道</a><a>追加影片</a><hr /><a>管理後台</a><a>登出</a></div>` : ""}
        </div>
      </div>
    </div>
  </header>
  <div class="mobile-search mobile-only"><label class="search">🔍<input placeholder="搜尋影片或品牌" data-search /></label></div>`;
}

function footer() {
  return `
  <footer class="footer">
    <div class="container">
      <details><summary>警語與版權宣告 / Disclaimer</summary>
        <p>本網站整理公開可嵌入之官方 YouTube 影片資訊，影片與商標權利均屬原權利人所有。內容可能涉及成人向遊戲或不適合未成年人之題材，請依所在地法律與平台規範自行判斷是否瀏覽。</p>
      </details>
      <span>Galgame TV · Powered by faryne.dev</span>
    </div>
  </footer>
  <nav class="bottom-nav">
    ${[["home", "▶", "影片"], ["brand", "◎", "品牌"], ["fav", "★", "收藏"], ["submit", "＋", "投稿"]]
      .map(([k, i, t]) => `<a class="${(k === "home" && ["home", "search", "video"].includes(state.screen)) || k === state.screen ? "active" : ""}" data-go="${k === "brand" ? "brand" : "home"}"><span>${i}</span>${t}</a>`).join("")}
  </nav>`;
}

// 影片卡：類型標籤＋片長壓在縮圖上，下方沿用現行的品牌 chip，再接標題
const card = (v, i) => `
  <a class="card" data-go="video">
    <div class="thumb"><img src="${thumb(v.id)}" alt="" />${badge(v)}${v.sec ? `<span class="duration">${dur(v.sec)}</span>` : ""}
      <button class="fav ${i === 2 ? "on" : ""}" title="收藏影片">${i === 2 ? "★" : "☆"}</button></div>
    <div class="card-meta-row"><span class="brand-chip">${v.brand.name}</span><span class="card-meta">${v.date}</span></div>
    <div class="card-title">${v.title}</div>
  </a>`;

const brandStrip = (list) => `<div class="brand-strip">${list.map((b) => `
  <a class="brand-pill" data-go="brand"><img src="${b.avatar}" alt="" />${b.name}</a>`).join("")}</div>`;

// 篩選列：類型＋時間兩組 chips，首頁、品牌頁、搜尋結果共用
function filters() {
  const group = (key, items) => `<div class="chips">${items.map(([k, t]) => `<button class="chip ${state[key] === k ? "active" : ""}" data-filter="${key}:${k}">${t}</button>`).join("")}</div>`;
  return `<div class="filters">
    ${group("type", [["all", "全部類型"], ["op", "OP"], ["pv", "PV"], ["trial", "體驗版"], ["teaser", "預告"]])}
    ${group("time", [["all", "全部時間"], ["7d", "7 天內"], ["30d", "30 天內"]])}
  </div>`;
}
const filtered = (list) => (state.type === "all" ? list : list.filter((v) => v.type[0] === state.type));
const grid = (list) => `<div class="grid">${filtered(list).map(card).join("") || `<p class="empty">沒有符合條件的影片。</p>`}</div>`;
const pager = `<div class="pager">${["‹", 1, 2, 3, "…", 16, "›"].map((n) => `<button class="${n === 1 ? "active" : ""}">${n}</button>`).join("")}</div>`;

function home() {
  return `<div class="container">
    <div class="crumbs"><span>首頁</span></div>
    <section class="section">
      <div class="section-head"><h2>品牌</h2><a class="link" data-go="brand">查看全部 ›</a></div>
      ${brandStrip([...brands, ...brands, ...brands].slice(0, 8))}
    </section>
    <section class="section">
      <div class="section-head"><h2>最新影片</h2></div>
      ${filters()}${grid(videos)}${pager}
    </section>
  </div>`;
}

function search() {
  const hit = videos.filter((v) => v.title.includes("王様恋愛"));
  return `<div class="container">
    <div class="crumbs"><a data-go="home">首頁</a> / <span>搜尋「王様恋愛」</span></div>
    <h1 class="page-title">「王様恋愛」的搜尋結果</h1>
    <section class="section"><div class="section-head"><h2>品牌 · 1</h2></div>${brandStrip([B.hook])}</section>
    <section class="section"><div class="section-head"><h2>影片 · ${hit.length}</h2></div>${filters()}${grid(hit)}</section>
  </div>`;
}

function brand() {
  const b = B.hook;
  const list = videos.filter((v) => v.brand === b);
  return `<div class="container">
    <div class="crumbs"><a data-go="home">首頁</a> / <span>${b.name}</span></div>
    <div class="brand-hero"><img src="${b.avatar}" alt="" />
      <div><h1>${b.name}</h1><div class="stats">收錄 ${list.length} 部影片 · 最新上檔 ${list[0].date}</div>
        <p class="brand-desc">${b.desc}</p>
        <div class="row"><button class="btn warning">☆ 加入收藏品牌</button><button class="btn">YouTube ↗</button><button class="btn">官方網站 ↗</button></div></div>
    </div>
    <section class="section">${filters()}${grid(list)}${pager}</section>
  </div>`;
}

function video() {
  const v = videos[0];
  const desc = "SMEE最新作『ワンナイトアフター』のOPムービーです。\n🌙2026年11月27日（金）発売予定🌙\n\n「Twinkle Degrees」\n音楽制作：SONO MAKERS\n歌：久野藍\n作詞：永原さくら\n作曲・編曲：柊木";
  const tags = ["SMEE", "ワンナイトアフター", "Twinkle Degrees", "OP", "久野藍", "柊木"];
  // 同一作品：同品牌且作品名相同；其餘當一般相關影片
  const sameWork = videos.filter((r) => r !== v && r.brand === v.brand && r.work === v.work);
  const related = videos.filter((r) => r !== v && !sameWork.includes(r)).slice(0, 6);
  const compact = (r) => `
    <a class="compact" data-go="video"><div class="thumb"><img src="${thumb(r.id)}" alt="" />${badge(r)}${r.sec ? `<span class="duration">${dur(r.sec)}</span>` : ""}</div>
      <div><div class="card-title">${r.title}</div><div class="card-meta">${r.brand.name} · ${r.date}</div></div></a>`;
  return `<div class="container">
    <div class="crumbs desktop-only"><a data-go="home">首頁</a> / <a data-go="brand">${v.brand.name}</a> / <span>${v.title}</span></div>
    <div class="watch">
      <div>
        <div class="player"><img src="${thumb(v.id, "maxresdefault")}" alt="" /><span class="play">▶</span></div>
        <h1 class="watch-title">${v.title}</h1>
        <div class="info-card">
          <dl>
            <dt>作品</dt><dd><b>${v.work}</b></dd>
            <dt>品牌</dt><dd><a class="brand-link" data-go="brand"><img src="${v.brand.avatar}" alt="" />${v.brand.name}</a><button class="btn small">☆ 收藏品牌</button></dd>
            <dt>類型</dt><dd>${badge(v)}</dd>
            <dt>發佈</dt><dd>${v.date}・${dur(v.sec)}</dd>
            <dt>標籤</dt><dd class="tags">${tags.map((t) => `<a class="tag">#${t}</a>`).join("")}</dd>
          </dl>
          <div class="info-actions">
            <button class="btn warning">★ 已收藏</button><button class="btn">在 YouTube 觀看 ↗</button>
            <span class="reactions"><button class="icon-btn" title="喜歡">👍<small>12</small></button><button class="icon-btn" title="不喜歡">👎<small>0</small></button></span>
          </div>
        </div>
        <section class="desc ${state.descOpen ? "open" : ""}"><h3>影片介紹</h3><p>${desc}</p>
          <button class="more" data-desc>${state.descOpen ? "顯示較少" : "顯示更多"}</button></section>
        <div class="prevnext">
          <a class="pn" data-go="video"><small>‹ 上一則影片</small>${videos[1].title}</a>
          <span class="pn next disabled"><small>下一則影片 ›</small>沒有下一則影片</span>
        </div>
      </div>
      <aside class="side">
        ${sameWork.length ? `<h3>同一作品的其他影片 <small>${v.work}</small></h3>${sameWork.map(compact).join("")}` : ""}
        <h3>相關影片</h3>${related.map(compact).join("")}
      </aside>
    </div>
  </div>`;
}

const screens = { home, search, brand, video };

function render() {
  document.documentElement.dataset.theme = state.theme;
  document.getElementById("device").className = `device ${state.view}`;
  document.getElementById("site").innerHTML = header() + `<div>${screens[state.screen]()}</div>` + footer();
  document.getElementById("notes").innerHTML = `<b>這個畫面的改動</b><ol>${notes[state.screen].map((n) => `<li>${n}</li>`).join("")}</ol>`;
  document.querySelectorAll("[data-screen]").forEach((el) => el.classList.toggle("active", el.dataset.screen === state.screen));
  document.querySelectorAll("[data-view]").forEach((el) => el.classList.toggle("active", el.dataset.view === state.view));
  document.querySelectorAll("[data-theme-option]").forEach((el) => el.classList.toggle("active", el.dataset.themeOption === state.theme));
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-screen],[data-view],[data-theme-option],[data-go],[data-menu],[data-filter],[data-desc]");
  if (!t) { if (state.menu) { state.menu = null; render(); } return; }
  e.preventDefault();
  if (t.dataset.screen) state.screen = t.dataset.screen;
  if (t.dataset.view) state.view = t.dataset.view;
  if (t.dataset.themeOption) state.theme = t.dataset.themeOption;
  if (t.dataset.go) { state.screen = t.dataset.go; state.menu = null; document.getElementById("device").scrollTop = 0; }
  if (t.dataset.menu) state.menu = state.menu === t.dataset.menu ? null : t.dataset.menu;
  if (t.dataset.filter) { const [key, value] = t.dataset.filter.split(":"); state[key] = value; }
  if ("desc" in t.dataset) state.descOpen = !state.descOpen;
  render();
});
// 搜尋框按 Enter 進搜尋結果畫面
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches("[data-search]")) { state.screen = "search"; render(); }
});
document.getElementById("notesToggle").addEventListener("change", (e) => { document.getElementById("notes").hidden = !e.target.checked; });

render();
