const body = document.body;
const html = document.documentElement;
const projectShell = document.querySelector('[data-shell="project"]');
const accountShell = document.querySelector('[data-shell="account"]');
const statesShell = document.querySelector('[data-shell="states"]');
const recentView = document.querySelector('.recent-view');
const archiveView = document.querySelector('.archive-view');
const detailDrawer = document.querySelector('#detailDrawer');
const detailContent = document.querySelector('#detailContent');
const archiveStatus = document.querySelector('#archiveStatus');
const snack = document.querySelector('#snack');

const details = {
  autosave: {
    title: '更新作品（4 次自動儲存）',
    subtitle: 'Faryne 在 2 分鐘內連續更新〈霧醒・第三章〉，清單合併顯示，事件本身仍各自保存。',
    summary: `<div class="key-values"><dt>最早版本</dt><dd><code>ver_01K6…4CE</code></dd><dt>最新版本</dt><dd><code>ver_01K6…D8A</code></dd><dt>事件數</dt><dd>4</dd></div>`,
    action: 'story.update', request: 'req_01K6QZ5A7H4RW2V6FCPXWJ7K8B', ip: '203.0.113.18', ua: 'Chrome 129 / macOS 15.1', source: 'Web · Session', outcome: '成功',
  },
  project: {
    title: '更新專案', subtitle: 'Faryne 更新「霧港殘響」可稽核欄位。',
    summary: `<div class="diff"><div class="diff-row"><span>簡介</span><div class="diff-values"><div class="before">一座不會停雨的港都。</div><div class="after">雨停以前，沒有人能離開霧港。</div></div></div><div class="diff-row"><span>分級</span><div class="diff-values"><div class="before">普遍級</div><div class="after">輔導級</div></div></div></div>`,
    action: 'project.update', request: 'req_01K6QWV4TCG31FN2ZF7T9DQT7R', ip: '203.0.113.18', ua: 'Chrome 129 / macOS 15.1', source: 'Web · Session', outcome: '成功',
  },
  mcp: {
    title: '更新設定', subtitle: 'PAT「Codex 桌機」透過 MCP 更新「潮汐曆法」。',
    summary: `<div class="key-values"><dt>舊版本</dt><dd><code>lver_01K6…K8M</code></dd><dt>新版本</dt><dd><code>lver_01K6…M4T</code></dd><dt>憑證</dt><dd>Codex 桌機 · <code>pat_7K2F</code></dd></div>`,
    action: 'lore.update', request: 'req_01K6QK4S19JQ2J2D0EAA8TSM5X', ip: '198.51.100.42', ua: 'Codex CLI/0.48.0', source: 'MCP · PAT', outcome: '成功',
  },
  agent: {
    title: '執行 AI 助理', subtitle: '對話「修整第三章節奏」完成；不保存 prompt 或回應本文。',
    summary: `<div class="key-values"><dt>Chat ID</dt><dd><code>chat_01K6QBY…</code></dd><dt>Provider</dt><dd>Anthropic</dd><dt>Model</dt><dd>Claude Sonnet 4.5</dd><dt>Input tokens</dt><dd>8,421</dd><dt>Output tokens</dt><dd>2,184</dd></div>`,
    action: 'agent.run', request: 'req_01K6Q91W1NP0RA91Q3Y1VPG4J7', ip: '203.0.113.18', ua: 'Chrome 129 / macOS 15.1', source: 'Web · Session', outcome: '成功',
  },
  denied: {
    title: '刪除資產遭拒絕', subtitle: '這次請求沒有通過授權檢查；摘要不顯示錯誤訊息或請求內容。',
    summary: `<div class="key-values"><dt>HTTP status</dt><dd>403</dd><dt>Custom code</dt><dd>project_permission_denied</dd><dt>錯誤類別</dt><dd>authorization</dd><dt>憑證</dt><dd>Raycast · <code>pat_C91A</code></dd></div>`,
    action: 'asset.delete', request: 'req_01K6Q4J0S2BDR4B44KW4RBBZ6M', ip: '198.51.100.91', ua: 'Raycast/1.82', source: 'API · PAT', outcome: '拒絕',
  },
  failed: {
    title: 'AI 助理執行失敗', subtitle: 'Provider 呼叫失敗；事件不保存 prompt、response 或原始錯誤訊息。',
    summary: `<div class="key-values"><dt>HTTP status</dt><dd>502</dd><dt>Custom code</dt><dd>provider_request_failed</dd><dt>錯誤類別</dt><dd>upstream_provider</dd><dt>Chat ID</dt><dd><code>chat_01K6Q1H…</code></dd></div>`,
    action: 'agent.run', request: 'req_01K6Q1F5E4EKC32Q2M1CGXK6B9', ip: '203.0.113.18', ua: 'Chrome 129 / macOS 15.1', source: 'Web · Session', outcome: '失敗',
  },
  cron: {
    title: '清理逾期記憶草稿', subtitle: '系統排程一次執行只產生一筆摘要事件。',
    summary: `<div class="key-values"><dt>清理筆數</dt><dd>12</dd><dt>執行時間</dt><dd>184 ms</dd><dt>Actor</dt><dd>System</dd></div>`,
    action: 'system.memory_draft.cleanup', request: '—（非 request）', ip: '—', ua: '—', source: '排程 · 無憑證', outcome: '成功',
  },
  read: {
    title: '讀取作品列表', subtitle: 'PAT 讀取事件屬低重要度，預設收合但可依憑證追查。',
    summary: `<div class="key-values"><dt>筆數</dt><dd>18</dd><dt>憑證</dt><dd>Codex 桌機 · <code>pat_7K2F</code></dd><dt>內容</dt><dd>不記錄</dd></div>`,
    action: 'story.list', request: 'req_01K6PZ69M9C4ABT9AC8W8AD0NQ', ip: '198.51.100.42', ua: 'Codex CLI/0.48.0', source: 'MCP · PAT', outcome: '成功',
  },
  social: {
    title: '新增寫作書籤', subtitle: '社交與收藏事件屬低重要度。',
    summary: `<div class="key-values"><dt>作品</dt><dd>〈霧醒・第二章〉</dd><dt>書籤位置</dt><dd>段落 18</dd></div>`,
    action: 'bookmark.create', request: 'req_01K6NVBBXMZT8MYSCVE9F2PJZ5', ip: '203.0.113.18', ua: 'Safari 18 / macOS 15.1', source: 'Web · Session', outcome: '成功',
  },
};

function renderDetail(key) {
  const item = details[key];
  if (!item) return;
  const outcomeClass = item.outcome === '成功' ? 'success' : item.outcome === '失敗' ? 'failed' : 'denied';
  detailContent.innerHTML = `
    <section class="detail-hero"><h3>${item.title}</h3><p>${item.subtitle}</p><div class="event-meta"><span class="outcome ${outcomeClass}">${item.outcome}</span><span>${item.source}</span></div></section>
    <section class="detail-section"><h4>摘要</h4>${item.summary}</section>
    <section class="detail-section"><h4>連線與追蹤</h4><dl class="key-values"><dt>Action</dt><dd><code>${item.action}</code></dd><dt>IP 位址</dt><dd>${item.ip}</dd><dt>User-Agent</dt><dd>${item.ua}</dd><dt>Request ID</dt><dd><code>${item.request}</code></dd></dl></section>`;
}

function setMode(mode) {
  document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  recentView.hidden = mode !== 'recent';
  archiveView.hidden = mode !== 'archive';
  detailDrawer.hidden = mode === 'archive';
  if (mode === 'archive' && !archiveStatus.innerHTML) renderArchive('idle');
}

function renderArchive(state) {
  const states = {
    idle: `<section class="job-card"><div class="state-message"><div class="symbol">⌕</div><h3>尚未送出封存查詢</h3><p>選擇月份後送出。查詢會在背景執行，不會與近期資料合併。</p></div></section>`,
    queued: `<section class="job-card"><div class="job-head"><div><h3>查詢已排入佇列</h3><p>2026/03–2026/05 · Job aq_01K6QX…</p></div><span class="outcome">等待中</span></div><div class="progress"><i></i></div><p class="helper">頁面每 3 秒輪詢一次；離開後仍可回來查看。</p></section>`,
    running: `<section class="job-card"><div class="job-head"><div><h3>正在查詢封存資料</h3><p>2026/03–2026/05 · Job aq_01K6QX…</p></div><span class="source mcp">執行中</span></div><div class="progress"><i></i></div><p class="helper">Athena 正在掃描符合權限與篩選條件的月份。</p></section>`,
    results: `<section class="job-card table-card"><div class="job-head"><div><h3>找到 38 筆事件</h3><p>完成於 15:08 · 掃描 4.8 MB</p></div><span class="outcome success">完成</span></div><table class="archive-table"><thead><tr><th>時間</th><th>操作者</th><th>Action</th><th>目標</th><th>入口</th><th>結果</th></tr></thead><tbody><tr><td>2026/05/28 22:14</td><td>Faryne</td><td>story.delete</td><td>〈渡潮人〉</td><td>Web</td><td><span class="outcome success">成功</span></td></tr><tr><td>2026/04/17 09:31</td><td>Faryne</td><td>lore.update</td><td>鹽燈信標</td><td>MCP</td><td><span class="outcome success">成功</span></td></tr><tr><td>2026/03/02 01:05</td><td>Faryne</td><td>asset.delete</td><td>old-map.png</td><td>API</td><td><span class="outcome denied">拒絕</span></td></tr></tbody></table><nav class="pagination"><button disabled>‹</button><button class="active">1</button><button>2</button><button>3</button><button>›</button></nav></section>`,
    failed: `<section class="job-card job-error"><div class="job-head"><div><h3>封存查詢失敗</h3><p>query_scan_limit · 查詢範圍超過本次掃描上限。</p></div><span class="outcome failed">失敗</span></div><p>請縮短月份範圍後重新送出；既有近期資料不受影響。</p></section>`,
  };
  archiveStatus.innerHTML = states[state];
}

function setScreen(screen) {
  const archive = screen === 'archive';
  projectShell.hidden = screen === 'account' || screen === 'states';
  accountShell.hidden = screen !== 'account';
  statesShell.hidden = screen !== 'states';
  document.querySelectorAll('[data-screen]').forEach((button) => button.classList.toggle('active', button.dataset.screen === screen));
  document.querySelector('#breadcrumb').innerHTML = screen === 'account'
    ? `<button class="mobile-nav">☰</button><span class="muted hide-mobile">Steamloom</span><b class="hide-mobile">›</b><strong>我的工作台</strong><b>›</b><span>帳號與安全</span><b>›</b><span>帳號活動</span>`
    : screen === 'states'
      ? `<span class="muted">Mockup</span><b>›</b><strong>介面狀態</strong>`
      : `<button class="mobile-nav">☰</button><span class="muted hide-mobile">Steamloom</span><b class="hide-mobile">›</b><span class="muted hide-mobile">我的工作台</span><b class="hide-mobile">›</b><strong>霧港殘響</strong><b>›</b><span>稽核紀錄</span>`;
  if (!projectShell.hidden) setMode(archive ? 'archive' : 'recent');
}

function renderState(state) {
  const card = document.querySelector('#stateCard');
  document.querySelectorAll('[data-state]').forEach((button) => button.classList.toggle('active', button.dataset.state === state));
  if (state === 'loading') card.innerHTML = `<div class="skeleton-list" aria-label="正在載入"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
  if (state === 'empty') card.innerHTML = `<div class="state-message"><div class="symbol">◷</div><h2>目前沒有稽核紀錄</h2><p>符合篩選條件的事件會顯示在這裡。你可以清除篩選或調整時間範圍。</p><button>清除篩選</button></div>`;
  if (state === 'error') {
    card.innerHTML = `<div class="state-message"><div class="symbol">!</div><h2>稽核紀錄暫時無法載入</h2><p>頁面保留目前的篩選條件，重試時不需要重新選擇。</p><button>重試</button></div>`;
    snack.classList.add('show');
  } else snack.classList.remove('show');
}

document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => setScreen(button.dataset.screen)));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  body.dataset.view = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button));
}));
document.querySelector('#themeSelect').addEventListener('change', (event) => { html.dataset.theme = event.target.value; });
document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  button.parentElement.querySelectorAll('.filter').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));
document.querySelector('#lowImportanceToggle').addEventListener('change', (event) => {
  document.querySelectorAll('.low-importance').forEach((row) => { row.hidden = !event.target.checked; });
});
document.querySelectorAll('.event-row').forEach((row) => row.addEventListener('click', () => {
  document.querySelectorAll('.event-row').forEach((item) => item.classList.remove('selected'));
  row.classList.add('selected');
  renderDetail(row.dataset.detail);
  if (body.dataset.view === 'mobile' || window.innerWidth <= 820) detailDrawer.style.display = 'block';
}));
document.querySelector('.expand-group').addEventListener('click', (event) => {
  event.stopPropagation();
  const children = event.currentTarget.closest('.event-row').querySelector('.group-children');
  children.hidden = !children.hidden;
  event.currentTarget.textContent = children.hidden ? '⌄' : '⌃';
});
document.querySelector('#closeDrawer').addEventListener('click', () => { detailDrawer.style.display = 'none'; });
document.querySelector('#archiveSubmit').addEventListener('click', () => {
  renderArchive('queued');
  window.setTimeout(() => renderArchive('running'), 800);
  window.setTimeout(() => renderArchive('results'), 1900);
});
document.querySelectorAll('[data-archive-state]').forEach((button) => button.addEventListener('click', () => renderArchive(button.dataset.archiveState)));
document.querySelector('.month.purged').addEventListener('click', () => { archiveStatus.innerHTML = `<section class="job-card"><div class="state-message"><div class="symbol">⌛</div><h3>2018 年 3 月</h3><p>已超過保存期限並已刪除，無法建立封存查詢。</p></div></section>`; });
document.querySelectorAll('[data-state]').forEach((button) => button.addEventListener('click', () => renderState(button.dataset.state)));
snack.querySelector('button').addEventListener('click', () => snack.classList.remove('show'));

renderDetail('autosave');
renderState('loading');
