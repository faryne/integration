// MCP 連接頁的三步驟 mockup：選連線方式 → 對應 dialog 完成設定 → 選用的 Skill
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];

// Personal Access Token 建立後依工具顯示的設定格式（實作時要再核對各工具文件的實際寫法）
const patSnippets = {
  codex: ['加到 <code>~/.codex/config.toml</code>：', '[mcp_servers.steamloom]\nurl = "https://steamloom.works/mcp"\nhttp_headers = { Authorization = "Bearer sst_7k2f9a3c41d8e0b6…" }'],
  claudecode: ['在終端機執行：', 'claude mcp add --transport http steamloom https://steamloom.works/mcp \\\n  --header "Authorization: Bearer sst_7k2f9a3c41d8e0b6…"'],
  json: ['MCP client 設定範例：', '{\n  "mcpServers": {\n    "steamloom": {\n      "url": "https://steamloom.works/mcp",\n      "headers": { "Authorization": "Bearer sst_7k2f9a3c41d8e0b6…" }\n    }\n  }\n}'],
};
const oauthToolNames = { claudeai: 'Claude.ai', chatgpt: 'ChatGPT', claudecode: 'Claude Code', other: '其他工具' };
const patToolNames = { codex: 'Codex CLI', claudecode: 'Claude Code', json: '其他工具' };

const selected = (seg) => q(`[data-seg="${seg}"] .active`).dataset.tool;

// 步驟狀態：1 完成後 2 變成目前步驟；2 完成後顯示摘要，3 變成目前步驟
function setStep(done) {
  q('#step1').classList.toggle('done', done >= 1);
  q('#step2').classList.toggle('active', done >= 1);
  q('#step2').classList.toggle('done', done >= 2);
  q('#step3').classList.toggle('active', done >= 2);
  q('#step2Pending').hidden = done >= 2;
  q('#step2Done').hidden = done < 2;
}

document.addEventListener('click', (event) => {
  const t = event.target.closest('button');
  if (!t) return;
  if (t.dataset.open) {
    q(`#${t.dataset.open}`).hidden = false;
    if (t.dataset.open === 'patDialog') { q('#patForm').hidden = false; q('#patResult').hidden = true; }
    if (t.dataset.open !== 'skillDialog') setStep(1);
  }
  // 分段選擇：切換選中的工具，OAuth 的步驟說明跟著換
  const seg = t.closest('[data-seg]');
  if (seg && t.dataset.tool) {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === t));
    if (seg.dataset.seg === 'oauthTool') qa('[data-tool-guide]').forEach((el) => { el.hidden = el.dataset.toolGuide !== t.dataset.tool; });
  }
  if (t.id === 'patCreate') {
    const [label, snippet] = patSnippets[selected('patTool')];
    q('#patSnippetLabel').innerHTML = label;
    q('#patSnippet').textContent = snippet;
    q('#patForm').hidden = true;
    q('#patResult').hidden = false;
  }
  if (t.dataset.complete) {
    const oauth = t.dataset.complete === 'oauth';
    q('#step2Summary').textContent = oauth ? `已設定：OAuth · ${oauthToolNames[selected('oauthTool')]}` : `已設定：Personal Access Token · ${patToolNames[selected('patTool')]}`;
    q('#step2Hint').textContent = oauth ? '在工具裡按下「允許」後就完成了，可以到 OAuth Token 頁確認。' : '設定好後重新啟動工具即可連線；token 可以在 Personal Access Token 頁管理。';
    q('#step2Manage').dataset.goto = oauth ? 'oauth' : 'pat';
    q('#step2Manage').textContent = oauth ? '管理授權' : '管理 Token';
    t.closest('.modal').hidden = true;
    setStep(2);
  }
  if (t.id === 'step2Redo') setStep(0);
});
