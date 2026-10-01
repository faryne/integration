// OAuth mockup 的畫面切換與對話框互動，純前端假資料
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const pageLabels = { pat: 'Personal Access Token', oauth: 'OAuth Token', mcp: 'MCP 連接' };

// 切換主畫面：三個開發者頁面共用工作台外框，授權同意頁獨立外框
function showScreen(screen) {
  const isAuthorize = screen === 'authorize';
  $('[data-shell="workspace"]').hidden = isAuthorize;
  $('[data-shell="authorize"]').hidden = !isAuthorize;
  $$('[data-page]').forEach((el) => { el.hidden = el.dataset.page !== screen; });
  $$('.sidebar [data-goto]').forEach((el) => el.classList.toggle('active', el.dataset.goto === screen));
  $$('[data-screen]').forEach((el) => el.classList.toggle('active', el.dataset.screen === screen));
  // 麵包屑：工作台頁「我的工作台 › 頁名」；授權頁只顯示「授權連線」
  $('#crumbParent').hidden = $('#crumbSep').hidden = isAuthorize;
  $('#crumbCurrent').textContent = isAuthorize ? '授權連線' : pageLabels[screen];
}

// 梭梭在各狀態的姿勢與台詞（授權頁對使用者稱「您」、話少、不用織布意象）
const mascotByState = {
  login: ['idle', 'Claude 想來讀您的文字。請您先登入，我才知道要替誰開門。'],
  penname: ['idle', 'Claude 想來讀您的文字。請您先登入，我才知道要替誰開門。'],
  consent: ['thinking', '答應之後，它能讀、能改，也能刪。請您看清楚了再按。'],
  invalid: ['error', '這個請求對不上，我先不放行。請您回原本的工具重新連一次。'],
  redirect: ['success', '好了，我送您回 Claude 那邊。'],
};
const mascotSrc = (pose) => `https://cdn.faryne.dev/steamloom_assets/suosuo-${pose}-${document.documentElement.dataset.theme === 'light' ? 'ivory' : 'nocturne'}-512.png`;
let authState = 'login';

// 授權同意頁的狀態：未登入 → 新使用者筆名 → 同意 → 跳轉；或參數錯誤
function showAuthState(state) {
  authState = state;
  const [pose, line] = mascotByState[state];
  $('#mascotImg').src = mascotSrc(pose);
  $('#mascotLine').textContent = line;
  $$('[data-auth]').forEach((el) => { el.hidden = el.dataset.auth !== state; });
  // 筆名對話框疊在登入卡片上方（模擬 StorytellerLayout 的 PenNameDialog）
  if (state === 'penname') $('[data-auth="login"]').hidden = false;
  $$('[data-auth-state]').forEach((el) => el.classList.toggle('active', el.dataset.authState === state));
}

function showSnack(title, error = false) {
  $('#snackTitle').textContent = title;
  $('#snack').classList.toggle('error', error);
  $('#snack').classList.add('show');
  clearTimeout(showSnack.timer);
  showSnack.timer = setTimeout(() => $('#snack').classList.remove('show'), 2600);
}

// 刪 Personal Access Token／撤銷授權共用同一個確認對話框，只換文案
const confirmCopy = {
  pat: ['刪除 Token', '確定要刪除「Codex 桌機」？', '刪除後使用這組 Token 的工具會立刻失去連線權限，此操作無法復原。', '刪除 Token', 'Token 已刪除'],
  grant: ['撤銷授權', '確定要撤銷「Claude」？', '撤銷後 Claude 會立刻失去存取權限，需要重新授權才能再次連線。', '撤銷', '已撤銷授權'],
};
let doneMessage = '';

document.addEventListener('click', (event) => {
  const t = event.target.closest('button');
  if (!t) return;
  if (t.dataset.screen) { showScreen(t.dataset.screen); if (t.dataset.screen === 'authorize') showAuthState('login'); }
  if (t.dataset.goto) showScreen(t.dataset.goto);
  if (t.dataset.authState) showAuthState(t.dataset.authState);
  if (t.dataset.authGoto) showAuthState(t.dataset.authGoto);
  if (t.dataset.oauthState) {
    const empty = t.dataset.oauthState === 'empty';
    $('#grantList').hidden = empty;
    $('#grantEmpty').hidden = !empty;
    $$('[data-oauth-state]').forEach((el) => el.classList.toggle('active', el === t));
  }
  if (t.dataset.confirm) {
    const [eyebrow, title, desc, btn, done] = confirmCopy[t.dataset.confirm];
    $('#confirmEyebrow').textContent = eyebrow;
    $('#confirmTitle').textContent = title;
    $('#confirmDesc').textContent = desc;
    $('#confirmBtn').textContent = btn;
    doneMessage = done;
    $('#confirmModal').hidden = false;
  }
  if (t.id === 'createPat') $('#createdModal').hidden = false;
  if (t.dataset.snack === 'copy') showSnack('已複製到剪貼簿');
  if (t.dataset.snack === 'done') showSnack(doneMessage);
  if (t.hasAttribute('data-close')) t.closest('.modal').hidden = true;
  if (t.closest('#snack')) $('#snack').classList.remove('show');
  if (t.dataset.view) {
    document.body.dataset.view = t.dataset.view;
    $$('[data-view]').forEach((el) => el.classList.toggle('active', el === t));
  }
});

$('#themeSelect').addEventListener('change', (e) => { document.documentElement.dataset.theme = e.target.value; showAuthState(authState); });

showScreen('pat');
