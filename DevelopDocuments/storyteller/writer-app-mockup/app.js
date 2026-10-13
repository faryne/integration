// Mockup 互動：只切換畫面／分頁／狀態，不接任何 API
const body = document.body;
const $ = (s) => document.querySelector(s);
const prompt = $("#assistant-prompt");
const referenceCatalog = {
  story: ["第一話　霧裡的郵差", "第三章　沒寄出的信", "第四章　早餐"],
  lore: ["角色 A", "中央郵局", "霧港市"],
};
const escapeHTML = (value) => value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
const referencePattern = /@(story|lore):\[[^\]]+\]/g;
const renderPromptReferences = () => {
  const value = prompt.value;
  const parts = [];
  let start = 0;
  for (const match of value.matchAll(referencePattern)) {
    parts.push(escapeHTML(value.slice(start, match.index)), `<mark>${escapeHTML(match[0])}</mark>`);
    start = match.index + match[0].length;
  }
  parts.push(escapeHTML(value.slice(start)), value.endsWith("\n") ? "\n " : "");
  $(".composer-highlight").innerHTML = parts.join("");

  const resolved = [];
  for (const match of value.matchAll(/@(story|lore):\[([^\]]+)\]/g)) resolved.push([match[0], match[2]]);
  $("#reference-chips").innerHTML = resolved.map(([token, title]) => `<span class="reference-chip"><code>${escapeHTML(token)}</code>→ ${escapeHTML(title)}</span>`).join("");
};
const syncMentionOptions = () => {
  const cursor = prompt.selectionStart;
  const match = prompt.value.slice(0, cursor).match(/@(story|lore):\[?([^\s\]]*)$/);
  const menu = $("#mention-options");
  if (!match) {
    menu.hidden = true;
    menu.replaceChildren();
    return;
  }
  const [, kind, query] = match;
  const options = referenceCatalog[kind].filter((title) => title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  menu.innerHTML = options.map((title) => `<button type="button" data-reference-kind="${kind}" data-reference-title="${escapeHTML(title)}">${kind === "lore" ? "設定：" : "故事："}${escapeHTML(title)}</button>`).join("");
  menu.hidden = options.length === 0;
};
const insertReference = (kind, title) => {
  const cursor = prompt.selectionStart;
  const before = prompt.value.slice(0, cursor);
  const match = before.match(new RegExp(`@${kind}:\\[?([^\\s\\]]*)$`));
  const token = `@${kind}:[${title}]`;
  const start = match ? cursor - match[0].length : cursor;
  prompt.value = `${prompt.value.slice(0, start)}${token}${prompt.value.slice(cursor)}`;
  prompt.setSelectionRange(start + token.length, start + token.length);
  prompt.focus();
  renderPromptReferences();
  syncMentionOptions();
};
const notify = (message, ok = false) => {
  $("#snack span").textContent = message;
  $("#snack").classList.toggle("ok", ok);
  $("#snack").classList.add("show");
  clearTimeout(actions.snackTimer);
  actions.snackTimer = setTimeout(actions["snack-close"], 5000);
};
const resolveReview = () => {
  const badge = $(".review-count");
  const count = Number(badge.textContent) - 1;
  badge.textContent = String(Math.max(0, count));
  badge.hidden = count <= 0;
};
let activeThread = "grok";
const threadHTML = {
  grok: $(".thread").innerHTML,
  claude: `<div class="msg-user">請依照既有角色設定與前文，完成第一話〈霧裡的郵差〉，完成後先讓我確認再寫入。</div>
    <div class="msg-ai"><div class="engine-tag"><span class="status-dot"></span>Claude Code</div>
    <div class="tool">✓ 讀取專案設定與角色資料</div><div class="tool">✓ 完成內容格式驗證</div>
    <div class="tool staged">草稿已暫存在本機，尚未寫入 SteamLoom</div>
    <div class="ai-text"><p>第一話草稿已完成。你確認 diff 後，我才會恢復這條 thread 並寫入故事。</p></div></div>`,
};
const threadMeta = {
  grok: { provider: "Grok Build", title: "產生角色 A 圖片資產" },
  claude: { provider: "Claude Code", title: "撰寫第一話" },
};
const selectThread = (key) => {
  threadHTML[activeThread] = $(".thread").innerHTML;
  activeThread = key;
  $(".thread").innerHTML = threadHTML[key];
  document.querySelectorAll(".task-card").forEach((card) => card.classList.toggle("selected", card.dataset.task === key));
  $(".task-detail-head .engine-tag").innerHTML = `<span class="status-dot"></span>${threadMeta[key].provider}`;
  $(".task-title-edit").classList.remove("editing");
  $(".task-title-edit h3").textContent = threadMeta[key].title;
  $(".task-title-input").value = threadMeta[key].title;
  $(".task-detail-head > .task-state").textContent = $(`.task-card[data-task='${key}'] .task-state`).textContent;
};
const appendThreadEvent = (key, html) => {
  if (activeThread === key) {
    $(".thread").insertAdjacentHTML("beforeend", html);
    $(".thread").lastElementChild.scrollIntoView({ behavior: "smooth", block: "end" });
    return;
  }
  threadHTML[key] += html;
};
const appendDecisionEvent = (key, title, detail, state = "ok") => appendThreadEvent(key,
  `<div class="decision-event ${state}"><b>${title}</b><span>${detail}</span><small>剛剛・已保存到這條 thread</small></div>`,
);
const appendApplyProgress = (key, provider, action) => appendThreadEvent(key,
  `<div class="msg-ai apply-progress"><div class="engine-tag"><span class="spinner"></span>${provider}</div><div class="tool write">${action}</div></div>`,
);
const appendApplyResult = (key, provider, tools, message) => appendThreadEvent(key,
  `<div class="msg-ai"><div class="engine-tag"><span class="status-dot"></span>${provider}</div>${tools.map((tool) => `<div class="tool"><span class="result-check">✓</span>${tool}</div>`).join("")}<div class="ai-text"><p>${message}</p></div></div>`,
);
const updateTaskState = (key, state, detail) => {
  const card = $(`.task-card[data-task='${key}']`);
  card.querySelector(".task-state").textContent = state;
  card.querySelector("small").textContent = detail;
  if (activeThread === key) $(".task-detail-head > .task-state").textContent = state;
};
const finalizeProposalReview = (key) => {
  const card = $(`.task-card[data-task='${key}']`);
  card.dataset.action = key === "claude" ? "select-text-thread" : "select-artifact-thread";
  if (key === "grok" && activeThread === key) $("[data-action='review-artifacts']")?.remove();
};

// 同步 mockup 控制面板上按鈕的選取狀態
const syncMock = () => {
  document.querySelectorAll(".mock [data-go]").forEach((b) => b.classList.toggle("on", b.dataset.go === body.dataset.screen));
  document.querySelectorAll(".mock [data-toggle]").forEach((b) => b.classList.toggle("on", body.classList.contains(b.dataset.toggle)));
};

// 每個 data-action 對應的行為
const actions = {
  // OAuth：模擬開瀏覽器授權 → 授權完成後跳到專案列表
  "login-start": () => {
    $("#login-card").dataset.state = "waiting";
    actions.loginTimer = setTimeout(() => { $("#login-card").dataset.state = ""; go("projects"); }, 1800);
  },
  "login-cancel": () => { clearTimeout(actions.loginTimer); $("#login-card").dataset.state = ""; },
  "engine-toggle": () => $("#engine").classList.toggle("open"),
  "engine-pick": (el) => { $("#engine-name").textContent = el.dataset.name; $("#engine").classList.remove("open"); },
  "task-group-toggle": (el) => {
    el.classList.toggle("open");
    el.nextElementSibling.classList.toggle("collapsed", !el.classList.contains("open"));
  },
  "edit-task-title": () => {
    $(".task-title-edit").classList.add("editing");
    $(".task-title-input").focus();
  },
  "save-task-title": () => {
    const title = $(".task-title-input").value.trim();
    if (!title) return notify("任務標題不可為空白");
    threadMeta[activeThread].title = title;
    $(".task-title-edit h3").textContent = title;
    $(".task-title-edit").classList.remove("editing");
    const card = $(`.task-card[data-task='${activeThread}'] b`);
    if (card) card.textContent = title;
    notify("任務標題已儲存", true);
  },
  send: () => { body.classList.add("running"); $(".engine-btn").disabled = true; syncMock(); },
  stop: () => { body.classList.remove("running"); syncMock(); },
  diff: () => tab("history"),
  revert: () => $("#confirm").classList.add("show"),
  "confirm-close": () => $("#confirm").classList.remove("show"),
  "select-text-thread": () => selectThread("claude"),
  "select-artifact-thread": () => selectThread("grok"),
  "review-artifacts": () => { selectThread("grok"); $("#artifact-confirm").classList.add("show"); },
  "artifact-close": () => $("#artifact-confirm").classList.remove("show"),
  "artifact-reject": () => {
    $("#artifact-confirm").classList.remove("show");
    resolveReview();
    finalizeProposalReview("grok");
    updateTaskState("grok", "已放棄", "成果未上傳");
    appendDecisionEvent("grok", "你已否決這批成果", "3 張圖片未上傳 SteamLoom；此決策會在下次開啟時保留。", "rejected");
  },
  "artifact-apply": () => {
    $("#artifact-confirm").classList.remove("show");
    resolveReview();
    finalizeProposalReview("grok");
    updateTaskState("grok", "上傳中", "已恢復原 Grok Build thread");
    appendDecisionEvent("grok", "你已允許 Grok Build 上傳", "授權 3 張圖片寫入「資產集／角色立繪」。");
    appendApplyProgress("grok", "Grok Build", "正在取得上傳位置並寫入 SteamLoom…");
    actions.artifactApplyTimer = setTimeout(() => {
      updateTaskState("grok", "已上傳", "3 張圖片已加入資產集");
      appendApplyResult("grok", "Grok Build", ["上傳 3 張 PNG", "建立資產紀錄並驗證結果"], "已完成上傳。3 張圖片都在「資產集／角色立繪」，asset ID 與結果已保存到這條 thread。");
    }, 1100);
  },
  "review-text": () => { selectThread("claude"); $("#text-confirm").classList.add("show"); },
  "text-close": () => $("#text-confirm").classList.remove("show"),
  "text-reject": () => {
    $("#text-confirm").classList.remove("show");
    resolveReview();
    finalizeProposalReview("claude");
    updateTaskState("claude", "已放棄", "草稿未寫入");
    appendDecisionEvent("claude", "你已否決這份草稿", "提案未寫入 SteamLoom；此決策會在下次開啟時保留。", "rejected");
  },
  "text-apply": () => {
    $("#text-confirm").classList.remove("show");
    resolveReview();
    finalizeProposalReview("claude");
    updateTaskState("claude", "寫入中", "已恢復原 Claude thread");
    appendDecisionEvent("claude", "你已允許 Claude 寫入", "授權將已確認的 proposal 寫入〈第一話　霧裡的郵差〉。");
    appendApplyProgress("claude", "Claude Code", "正在呼叫 SteamLoom MCP 寫入並驗證新版本…");
    actions.textApplyTimer = setTimeout(() => {
      updateTaskState("claude", "已寫入", "新版本 #31");
      appendApplyResult("claude", "Claude Code", ["寫入第一話", "讀回並驗證版本 #31"], "第一話已寫入完成，建立版本 #31。你可以在編輯歷史比對或還原這個版本。");
    }, 1100);
  },
  "delete-thread": () => $("#thread-delete").classList.add("show"),
  "thread-delete-close": () => $("#thread-delete").classList.remove("show"),
  "thread-delete-confirm": () => {
    $("#thread-delete").classList.remove("show");
    $(".task-card.selected").remove();
    $(".task-title-edit h3").textContent = "Thread 已刪除";
    $(".task-detail-head > .task-state").textContent = "本機紀錄已移除";
    notify("Writer thread 與本機暫存成果已永久刪除；Grok Build session 保留", true);
  },
  "keep-mine": () => { body.classList.remove("conflict"); syncMock(); },
  "reload-latest": () => { body.classList.remove("conflict"); syncMock(); },
  "new-chat": () => {},
  snack: () => notify("Codex 執行失敗：尚未登入，請先在終端機執行 codex login"),
  "snack-close": () => $("#snack").classList.remove("show"),
};

const go = (screen) => { body.dataset.screen = screen; syncMock(); };
const tab = (name) => { body.dataset.tab = name; };

// 事件委派：data-go 切畫面、data-tab-go 切分頁、data-toggle 切狀態、data-action 執行動作
document.addEventListener("click", (e) => {
  const reference = e.target.closest("[data-reference-kind]");
  if (reference) {
    insertReference(reference.dataset.referenceKind, reference.dataset.referenceTitle);
    return;
  }
  const el = e.target.closest("[data-go],[data-tab-go],[data-toggle],[data-action]");
  if (!el?.closest(".engine")) $("#engine").classList.remove("open");
  if (!el) return;
  if (el.dataset.go) go(el.dataset.go);
  else if (el.dataset.tabGo) tab(el.dataset.tabGo);
  else if (el.dataset.toggle) { body.classList.toggle(el.dataset.toggle); syncMock(); }
  else actions[el.dataset.action]?.(el);
});

prompt.addEventListener("input", () => { renderPromptReferences(); syncMentionOptions(); });
prompt.addEventListener("click", syncMentionOptions);
prompt.addEventListener("keyup", syncMentionOptions);
prompt.addEventListener("scroll", () => { $(".composer-highlight").scrollTop = prompt.scrollTop; });
$("#task-search").addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll(".task-group-items").forEach((group) => {
    let matches = 0;
    group.querySelectorAll(".task-card").forEach((card) => {
      const matched = !query || card.querySelector("b").textContent.toLowerCase().includes(query);
      card.hidden = !matched;
      if (matched) matches += 1;
    });
    const head = group.previousElementSibling;
    head.hidden = matches === 0;
    if (query && matches > 0) { head.classList.add("open"); group.classList.remove("collapsed"); }
  });
});
$(".task-title-input").addEventListener("keydown", (event) => { if (event.key === "Enter") actions["save-task-title"](); });

renderPromptReferences();
syncMock();
