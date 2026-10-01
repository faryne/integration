// 站內通知 mockup：popover、通知列表、內容頁共用同一份假資料
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const RETENTION_DAYS = 180;
const EXPIRING_WITHIN = 14; // 剩 14 天內才標「N 天後清除」
const lockLimit = 50;

// 假資料：age 是建立至今的天數；kind 對應後端 notification.kind；
// episodes／synopsis 等欄位對應 payload 快照（寫入當下的標題，作品改名也不影響舊通知）
const seed = () => [
  { id: 1, kind: 'story.published', age: 0, time: '10:24', date: '2026-10-01 10:24', unread: true, pen: '鴉羽', project: '霧都旅館',
    episodes: [['第 18 話〈地下室的鋼琴〉', 6120], ['第 19 話〈誰在調音〉', 5480], ['第 20 話〈休止符〉', 7032]] },
  { id: 2, kind: 'security.oauth.authorized', age: 0, time: '09:02', date: '2026-10-01 09:02', unread: true, client: 'Claude', ip: '1.163.xxx.xxx', ua: 'macOS · Chrome 141', entry: 'Web（授權同意頁）', scope: '讀取與寫入你的專案、故事、設定、素材' },
  { id: 9, kind: 'future.letter', age: 0, time: '08:15', date: '2026-10-01 08:15', unread: true, from: '小雨', project: '霧都旅館',
    body: '鴉羽老師您好：\n\n從第一冊一路追到現在，第 17 話鋼琴那段我反覆看了好幾次，地下室的描寫真的好有畫面，讀到半夜都不敢關燈哈哈。\n\n想跟老師說，不管更新快或慢我都會等，請老師照自己的步調寫就好。下一冊也很期待！' },
  { id: 3, kind: 'story.published', age: 1, time: '昨天 22:10', date: '2026-09-30 22:10', unread: true, pen: '白鷺', project: '星屑列車', r18: true,
    episodes: [['第 12 話〈終點站以前〉', 8210]] },
  { id: 4, kind: 'project.published', age: 2, time: '2 天前', date: '2026-09-29 20:00', pen: '鴉羽', project: '夜蛾的信箋', chapters: 4, words: '2.1 萬',
    synopsis: '一間只在雨夜營業的代筆信鋪，替不敢開口的人寫下最後一封信。直到某天，櫃台收到一封署名給店主自己的委託。', tags: ['奇幻', '書信體', '短篇連載'] },
  { id: 5, kind: 'security.pat.created', age: 5, time: '5 天前', date: '2026-09-26 14:37', locked: true, label: 'Codex 桌機', prefix: 'stl_9f3a', expires: '2026-12-25', ip: '1.163.xxx.xxx', ua: 'macOS · Safari 19' },
  { id: 6, kind: 'story.published', age: 21, time: '3 週前', date: '2026-09-10 21:00', pen: '鴉羽', project: '霧都旅館',
    episodes: Array.from({ length: 10 }, (_, i) => [`第 ${i + 8} 話`, 5000 + i * 137]), volume: '第二冊〈霧中的訪客〉' },
  { id: 7, kind: 'story.published', age: 171, time: '171 天前', date: '2026-04-13 19:30', pen: '白鷺', project: '星屑列車', episodes: [['第 1 話〈發車〉', 4980]] },
  { id: 8, kind: 'project.published', age: 175, time: '175 天前', date: '2026-04-09 18:00', locked: true, pen: '白鷺', project: '星屑列車', chapters: 1, words: '0.5 萬',
    synopsis: '開往不存在車站的夜行列車，乘客只有一個條件：不能問自己是怎麼上車的。', tags: ['奇幻', '群像'] },
];
let items = seed();
let lockedExtra = 0; // 「鎖定已滿」示意：假裝其他分頁還有 48 則鎖定
let filter = 'all';
let screen = 'popover';
let selectedId = null;
let pendingDelete = null;

// 圖示用 SVG：emoji 的 🔒／🔓 太像，一眼分不出狀態
const svg = (d) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON_LOCKED = svg('<rect x="4" y="11" width="16" height="10" rx="2" fill="currentColor"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>');
const ICON_UNLOCKED = svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>');
const ICON_TRASH = svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>');

const lockedCount = () => items.filter((n) => n.locked).length + lockedExtra;
const fmtWords = (w) => `${w.toLocaleString()} 字`;

// 依 kind 組列表文案：DB 只存快照 payload，文字由前端決定
function describe(n) {
  switch (n.kind) {
    case 'story.published': {
      const c = n.episodes.length;
      return { icon: ['story', '¶'], title: `<b>${n.pen}</b> 的《${n.project}》更新了${c > 1 ? ` ${c} 話` : ''}`, sub: c > 1 ? `從 ${n.volume ?? n.episodes[0][0]} 開始` : n.episodes[0][0] };
    }
    case 'project.published':
      return { icon: ['project', '✦'], title: `<b>${n.pen}</b> 發表了新作品《${n.project}》`, sub: n.synopsis };
    case 'security.oauth.authorized':
      return { icon: ['security', '⚿'], title: `<b>${n.client}</b> 已取得你的帳號授權`, sub: `${n.ua} · ${n.ip}` };
    case 'security.pat.created':
      return { icon: ['security', '⚿'], title: `建立了新的 Personal Access Token「<b>${n.label}</b>」`, sub: `<code>${n.prefix}…</code> · ${n.ua}` };
    case 'future.letter':
      return { icon: ['letter', '✉'], title: `<b>${n.from}</b> 寄來一封關於《${n.project}》的信`, sub: n.body.split('\n').find((l) => l && !l.endsWith('：')) };
  }
}

function tagsHTML(n) {
  const left = RETENTION_DAYS - n.age;
  return [
    n.kind === 'future.letter' ? '<span class="tag future">未來示意</span>' : '',
    n.r18 ? '<span class="tag r18">R18</span>' : '',
    n.kind.startsWith('security') ? '<span class="tag">帳號安全</span>' : '',
    n.locked ? '<span class="tag locked">已鎖定</span>' : '',
    !n.locked && left <= EXPIRING_WITHIN ? `<span class="tag expiring">${left} 天後清除</span>` : '',
  ].join('');
}

const actionsHTML = (n) => `
  <div class="n-actions">
    <button class="icon-btn ${n.locked ? 'on' : ''}" data-action="lock" title="${n.locked ? '解除鎖定' : '鎖定（不會被自動清除）'}">${n.locked ? ICON_LOCKED : ICON_UNLOCKED}</button>
    <button class="icon-btn del" data-action="delete" title="刪除">${ICON_TRASH}</button>
  </div>`;

function rowHTML(n) {
  const d = describe(n);
  return `
    <article class="n-row ${n.unread ? 'unread' : ''} ${n.id === selectedId ? 'selected' : ''}" data-id="${n.id}">
      <span class="n-icon ${d.icon[0]}">${d.icon[1]}</span>
      <div class="n-body">
        <p class="n-title">${d.title}</p>
        ${d.sub ? `<p class="n-sub clamp">${d.sub}</p>` : ''}
        <div class="n-meta"><span>${n.time}</span>${tagsHTML(n)}</div>
      </div>
      ${actionsHTML(n)}
    </article>`;
}

// 內容頁：各 kind 自己的主體＋行動按鈕
function detailBody(n) {
  switch (n.kind) {
    case 'story.published':
      return `
        <h3>這次更新的內容</h3>
        <ul class="ep-list">${n.episodes.map(([t, w]) => `<li><span>${t}<br><small>${fmtWords(w)}</small></span><button class="link" data-action="go" data-go="Reader：《${n.project}》${t}">閱讀 →</button></li>`).join('')}</ul>
        <div class="btn-row">
          <button class="primary" data-action="go" data-go="Reader：《${n.project}》${n.episodes[0][0]}">從${n.episodes[0][0].split('〈')[0]}開始讀</button>
          <button class="outline" data-action="go" data-go="《${n.project}》作品首頁">前往作品首頁</button>
        </div>`;
    case 'project.published':
      return `
        <div class="cover">${n.project}</div>
        <p style="margin:0">${n.synopsis}</p>
        <div class="chips">${n.tags.map((t) => `<span class="tag">${t}</span>`).join('')}<span class="tag">目前 ${n.chapters} 話 · 約 ${n.words} 字</span></div>
        <div class="btn-row">
          <button class="primary" data-action="go" data-go="Reader：《${n.project}》第 1 話">從第 1 話開始讀</button>
          <button class="outline" data-action="go" data-go="《${n.project}》作品首頁">前往作品首頁</button>
        </div>`;
    case 'security.oauth.authorized':
      return `
        <dl class="kv">
          <dt>應用程式</dt><dd>${n.client}</dd>
          <dt>授權時間</dt><dd>${n.date}</dd>
          <dt>授權範圍</dt><dd>${n.scope}</dd>
          <dt>入口</dt><dd>${n.entry}</dd>
          <dt>IP</dt><dd>${n.ip}</dd>
          <dt>裝置</dt><dd>${n.ua}</dd>
        </dl>
        <div class="notice warn"><span>!</span><p><strong>不是你本人操作？</strong>請立刻撤銷這個授權，${n.client} 會馬上失去存取權限。</p></div>
        <div class="btn-row"><button class="danger-btn" data-action="go" data-go="OAuth 授權管理頁（已定位到 ${n.client}）">前往撤銷授權</button></div>`;
    case 'security.pat.created':
      return `
        <dl class="kv">
          <dt>名稱</dt><dd>${n.label}</dd>
          <dt>Token 前綴</dt><dd><code>${n.prefix}…</code></dd>
          <dt>建立時間</dt><dd>${n.date}</dd>
          <dt>到期日</dt><dd>${n.expires}</dd>
          <dt>IP</dt><dd>${n.ip}</dd>
          <dt>裝置</dt><dd>${n.ua}</dd>
        </dl>
        <div class="notice warn"><span>!</span><p><strong>不是你本人操作？</strong>請立刻刪除這組 Token，並檢查最近的活動紀錄。</p></div>
        <div class="btn-row">
          <button class="danger-btn" data-action="go" data-go="Personal Access Token 管理頁（已定位到 ${n.label}）">前往刪除 Token</button>
          <button class="outline" data-action="go" data-go="活動紀錄（篩選這組 Token）">查看活動紀錄</button>
        </div>`;
    case 'future.letter':
      return `
        <div class="notice"><span>ⓘ</span><p>這一則只是示意之後社群功能（粉絲來信）放進內容頁的樣子，<strong>不在這一輪範圍</strong>。</p></div>
        <div class="letter">${n.body}</div>
        <div class="btn-row"><button class="outline" disabled>回覆（社群功能上線後）</button></div>`;
  }
}

function renderDetail() {
  const n = items.find((x) => x.id === selectedId);
  $('[data-page="page"]').classList.toggle('has-detail', !!n);
  if (!n) {
    $('#detail').innerHTML = '<div class="detail-empty"><div><b style="color:var(--text)">選一則通知查看內容</b><br>點左邊的通知就會在這裡打開</div></div>';
    return;
  }
  const d = describe(n);
  const left = RETENTION_DAYS - n.age;
  $('#detail').innerHTML = `
    <button class="link back" data-action="back">‹ 返回通知</button>
    <header class="detail-head" data-id="${n.id}">
      <span class="n-icon ${d.icon[0]}">${d.icon[1]}</span>
      <div><h2>${d.title}</h2><div class="n-meta"><span>${n.date}</span>${tagsHTML(n)}</div></div>
      ${actionsHTML(n)}
    </header>
    <div class="detail-body">${detailBody(n)}</div>
    <footer class="detail-foot">${n.locked ? '已鎖定，這則通知不會被自動清除。' : `這則通知會在 ${left} 天後自動清除，想留下來可以按右上角的鎖頭。`}</footer>`;
}

// 通知頁依建立時間分組
const groupOf = (n) => (n.age === 0 ? '今天' : n.age <= 7 ? '這一週' : n.age <= 30 ? '這個月' : '更早');

function render() {
  const unread = items.filter((n) => n.unread).length;
  $('#bellCount').textContent = unread > 99 ? '99+' : unread;
  $('#bellCount').hidden = unread === 0;

  // popover：最近 10 則
  $('#popoverList').innerHTML = items.length ? items.slice(0, 10).map(rowHTML).join('') : '<div class="empty"><b>目前沒有通知</b>追蹤作者或收藏作品後，更新會出現在這裡。</div>';

  // 通知頁列表
  const list = items.filter((n) => (filter === 'unread' ? n.unread : filter === 'locked' ? n.locked : true));
  let html = '';
  let lastGroup = '';
  list.forEach((n) => {
    const g = groupOf(n);
    if (g !== lastGroup) html += `<div class="n-group">${(lastGroup = g)}</div>`;
    html += rowHTML(n);
  });
  const emptyCopy = { all: ['目前沒有通知', '追蹤作者或收藏作品後，更新會出現在這裡。'], unread: ['都看完了', '沒有未讀的通知。'], locked: ['還沒有鎖定的通知', '按通知右側的鎖頭就能鎖定，鎖定的通知不會被自動清除。'] }[filter];
  $('#pageList').innerHTML = html || `<div class="empty"><b>${emptyCopy[0]}</b>${emptyCopy[1]}</div>`;

  const locked = lockedCount();
  $('#unreadCount').textContent = unread || '';
  $('#lockedCount').textContent = locked || '';
  $('#lockMeter').className = `lock-meter ${locked >= lockLimit ? 'full' : ''}`;
  $('#lockMeter').innerHTML = `已鎖定 ${locked} / ${lockLimit}<i><span style="width:${Math.min(100, (locked / lockLimit) * 100)}%"></span></i>`;
  renderDetail();
}

function showScreen(next) {
  screen = next;
  $('#popover').hidden = next !== 'popover';
  $('#bell').classList.toggle('open', next === 'popover');
  $$('[data-page]').forEach((el) => { el.hidden = el.dataset.page !== (next === 'page' ? 'page' : 'projects'); });
  $$('.sidebar [data-goto]').forEach((el) => el.classList.toggle('active', el.dataset.goto === (next === 'page' ? 'page' : 'projects')));
  $$('[data-screen]').forEach((el) => el.classList.toggle('active', el.dataset.screen === next));
  $('#crumbCurrent').textContent = next === 'page' ? '通知' : '創作專案';
}

// 打開一則通知＝標已讀＋選取；實作時對應路由 /storyteller/notifications/:public_id
function openItem(n) {
  n.unread = false;
  selectedId = n.id;
  showScreen('page');
  render();
}

function showSnack(title, error = false) {
  $('#snackTitle').textContent = title;
  $('#snackIcon').textContent = error ? '!' : '✓';
  $('#snack').classList.toggle('error', error);
  $('#snack').classList.add('show');
  clearTimeout(showSnack.timer);
  showSnack.timer = setTimeout(() => $('#snack').classList.remove('show'), 2800);
}

const isMobile = () => document.body.dataset.view === 'mobile' || window.innerWidth <= 820;
const findItem = (el) => items.find((n) => n.id === Number(el?.closest('[data-id]')?.dataset.id));

document.addEventListener('click', (event) => {
  const btn = event.target.closest('button');
  const row = event.target.closest('.n-row');
  const n = findItem(btn ?? row);

  // mockup 控制列
  if (btn?.dataset.screen) return showScreen(btn.dataset.screen);
  if (btn?.dataset.view) {
    document.body.dataset.view = btn.dataset.view;
    $$('[data-view]').forEach((el) => el.classList.toggle('active', el === btn));
    if (btn.dataset.view === 'mobile' && screen === 'popover') showScreen('page');
    return;
  }
  if (btn?.dataset.data) {
    $$('[data-data]').forEach((el) => el.classList.toggle('active', el === btn));
    items = btn.dataset.data === 'empty' ? [] : seed();
    lockedExtra = btn.dataset.data === 'full' ? lockLimit - 2 : 0;
    selectedId = null;
    return render();
  }
  if (btn?.dataset.goto) return showScreen(btn.dataset.goto === 'page' ? 'page' : 'projects');

  // 鈴鐺：手機直接進通知頁，桌機切換 popover
  if (btn?.id === 'bell') return showScreen(isMobile() ? 'page' : screen === 'popover' ? 'projects' : 'popover');

  switch (btn?.dataset.action) {
    case 'read-all':
      items.forEach((x) => { x.unread = false; });
      render();
      return showSnack('已將全部通知標為已讀');
    case 'open-page':
      return showScreen('page');
    case 'back':
      selectedId = null;
      return render();
    case 'go':
      return showSnack(`（mockup）前往 ${btn.dataset.go}`);
    case 'lock':
      if (!n.locked && lockedCount() >= lockLimit) return showSnack(`已達鎖定上限 ${lockLimit} 則，請先解除其他通知的鎖定`, true);
      n.locked = !n.locked;
      render();
      return showSnack(n.locked ? '已鎖定，這則通知不會被自動清除' : '已解除鎖定');
    case 'delete':
      pendingDelete = n;
      $('#confirmText').textContent = '確定要刪除這則通知？刪除後無法復原。';
      $('#confirmLocked').hidden = !n.locked;
      $('#confirmModal').hidden = false;
      return;
    case 'confirm-delete':
      items = items.filter((x) => x !== pendingDelete);
      if (selectedId === pendingDelete.id) selectedId = null;
      $('#confirmModal').hidden = true;
      render();
      return showSnack('通知已刪除');
    case 'cancel':
      $('#confirmModal').hidden = true;
      return;
    case 'close-snack':
      return $('#snack').classList.remove('show');
  }

  // 點通知本體（popover 或列表）：打開內容頁
  if (row && !btn) openItem(n);
});

$('#filters').addEventListener('click', (event) => {
  const b = event.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter;
  $$('[data-filter]').forEach((el) => el.classList.toggle('active', el === b));
  render();
});

$('#themeSelect').addEventListener('change', (e) => { document.documentElement.dataset.theme = e.target.value; });

render();
showScreen('popover');
