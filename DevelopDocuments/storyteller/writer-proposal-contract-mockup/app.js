// 這份 mockup 只驗證 proposal 類型與事件呈現，不會呼叫任何 API。
const proposals = [
  { id: "document-create", type: "全文・新增", title: "港口的另一封信", detail: "新故事", kind: "全文提案・新增", action: "新增故事" },
  { id: "document-replace", type: "全文・修改", title: "第三章　沒寄出的信", detail: "DB #72 → 提案", kind: "全文提案・已有故事", action: "更新故事" },
  { id: "chapter-append", type: "章節・新增", title: "追逐", detail: "插在第二節之後", kind: "章節提案・append", action: "新增章節" },
  { id: "chapter-replace", type: "章節・替換", title: "碼頭對峙", detail: "替換 marker ch-03", kind: "章節提案・replace", action: "更新章節" },
  { id: "asset-upload", type: "圖片資產", title: "霧港封面.png", detail: "PNG・4.2 MiB", kind: "圖片資產提案", action: "上傳圖片" },
  { id: "image-story", type: "圖像作品", title: "雨夜追逐", detail: "新增・3 頁", kind: "圖像作品提案", action: "新增圖像作品" },
];

const eventContract = [
  ["message.user", "使用者訊息", "對話泡泡", "persist"],
  ["task.queued", "工作進入 thread queue", "執行紀錄", "persist"],
  ["task.started", "provider 開始工作", "執行紀錄", "persist"],
  ["task.progress", "可讀的思考／進度摘要", "執行紀錄", "persist"],
  ["task.tool.started", "開始讀取或呼叫工具", "與完成事件聚合", "persist"],
  ["task.tool.completed", "工具完成", "執行紀錄", "persist"],
  ["task.tool.failed", "工具失敗", "執行紀錄警告", "persist"],
  ["assistant.delta", "串流中的回答內容", "即時回答預覽", "live"],
  ["agent.preview", "provider 暫態狀態", "即時進度", "live"],
  ["message.agent", "正式回答", "Markdown 對話泡泡", "persist"],
  ["task.completed", "Agent 正常結束", "執行紀錄終態", "persist"],
  ["task.failed", "Agent 執行失敗", "失敗卡與登入指引", "persist"],
  ["task.canceled", "使用者停止工作", "取消卡", "persist"],
  ["proposal.ready", "成果已 staging", "ProposalCard", "persist"],
  ["proposal.approved", "使用者核准選取成果", "使用者決策訊息", "persist"],
  ["proposal.rejected", "使用者否決成果", "使用者決策訊息", "persist"],
  ["apply.queued", "Writer 等待套用", "套用紀錄", "persist"],
  ["apply.started", "Writer 開始 REST mutation", "套用紀錄", "persist"],
  ["apply.item.started", "開始套用單項成果", "具體操作與標題", "persist"],
  ["apply.item.completed", "單項成果套用成功", "具體操作與標題", "persist"],
  ["apply.completed", "整批套用成功", "套用完成卡", "persist"],
  ["apply.failed", "套用失敗", "套用失敗卡", "persist"],
  ["apply.conflict", "base version 衝突", "衝突警告", "persist"],
  ["apply.interrupted", "未取得 REST 終局結果", "待人工確認", "persist"],
  ["apply.verified", "作者確認實際成功", "修正後完成卡", "persist"],
];

const $ = (selector) => document.querySelector(selector);
let active = proposals[0].id;

function proposalBody(id) {
  const bodies = {
    "document-create": `<div class="notice">這是全新故事，SteamLoom 尚未建立內容。</div><div class="metadata"><span>建立位置</span><b>第一冊　起霧</b><span>狀態</span><b>草稿</b></div><div class="preview">雨下得太急，港務大樓的燈在水霧裡暈成一圈。

她把那封沒有地址的信塞進外套，沿著空蕩的貨櫃走道往前。</div>`,
    "document-replace": `<div class="notice">以 DB #72 為 base；確認時會再次檢查 latest version。</div><div class="diff"><div><h3>目前版本 DB #72</h3><div class="preview">她停在碼頭邊。<span class="removed">雨聲蓋過所有腳步。</span></div></div><div><h3>Agent 提案</h3><div class="preview">她停在碼頭邊。<span class="added">雨聲沒有蓋住身後那串越來越近的腳步。</span></div></div></div>`,
    "chapter-append": `<div class="notice">只顯示新章節與插入位置；Writer 依 marker 定位，不由 Agent 重組整篇。</div><div class="anchor">插入位置：第二節〈倉庫〉之後・anchor marker：ch-02</div><div class="preview"><b>追逐</b>

她才跑過第一排貨櫃，右後方就傳來鞋底踩進積水的聲音。不是一個人，而且已經追得很近。</div>`,
    "chapter-replace": `<div class="notice">只比對 marker ch-03 對應章節；其他章節不會被寫入。</div><div class="diff"><div><h3>目前章節</h3><div class="preview"><span class="removed">「把信交出來。」男人說。</span></div></div><div><h3>替換提案</h3><div class="preview"><span class="added">「信留下，人可以走。」男人盯著她濕透的外套，慢慢把手伸進口袋。</span></div></div></div>`,
    "asset-upload": `<div class="notice">這是可重複引用的圖片資產，不會自動建立圖像作品。</div><div class="art" style="max-width:220px;margin:auto;aspect-ratio:16/10"><span>霧港封面.png</span></div><div class="metadata"><span>格式</span><b>image/png</b><span>大小</span><b>4.2 MiB</b><span>資產集</span><b>封面與宣傳</b></div>`,
    "image-story": `<div class="notice">三頁會先各自上傳成資產，再由 Writer 以確認後的順序建立圖像作品。</div><div class="gallery"><label class="art"><input type="checkbox" checked><span>01・碼頭遠景</span></label><label class="art"><input type="checkbox" checked><span>02・貨櫃追逐</span></label><label class="art"><input type="checkbox" checked><span>03・信封特寫</span></label></div><div class="metadata"><span>建立位置</span><b>圖像作品／第一話</b><span>頁面順序</span><b>拖曳後的確認順序</b></div>`,
  };
  return bodies[id];
}

function renderProposals() {
  $("#proposal-items").innerHTML = proposals.map((item) => `<button class="proposal-item ${item.id === active ? "active" : ""}" data-proposal="${item.id}"><input type="checkbox" checked aria-label="選取 ${item.title}"><span class="type">${item.type}</span><strong>${item.title}</strong><small>${item.detail}　›</small></button>`).join("");
  $("#review-tabs").innerHTML = proposals.map((item, index) => `<button class="${item.id === active ? "active" : ""}" data-proposal="${item.id}">${index + 1}. ${item.type}</button>`).join("");
  const item = proposals.find((value) => value.id === active);
  $("#review-kind").textContent = item.kind;
  $("#review-title").textContent = item.title;
  $("#review-body").innerHTML = proposalBody(active);
}

function renderContract() {
  $("#contract-grid").innerHTML = eventContract.map(([type, meaning, render, persistence]) => `<article class="event"><code>${type}</code><p>${meaning}<br>UI：${render}</p><span class="${persistence}">${persistence === "persist" ? "落盤" : "即時"}</span><span>已定義</span></article>`).join("");
}

function finishDecision(approved) {
  const state = $("#proposal-state");
  state.textContent = approved ? "已允許" : "已否決";
  $(".proposal-actions").hidden = true;
  if (!approved) return notify("proposal.rejected 已保存；Writer 不會寫入。 ");
  const selectedIDs = [...document.querySelectorAll(".proposal-item input:checked")].map((input) => input.closest(".proposal-item").dataset.proposal);
  const selected = proposals.filter((item) => selectedIDs.includes(item.id));
  $("#apply-card").hidden = false;
  $("#apply-events").innerHTML = `<li><span>等待 Writer 套用 ${selected.length} 項成果</span><time>剛剛</time></li><li><span>正在檢查版本與暫存成果</span><time>剛剛</time></li>${selected.map((item) => `<li><span>${item.action}「${item.title}」……開始</span><time>剛剛</time></li>`).join("")}`;
  setTimeout(() => {
    $("#apply-events").insertAdjacentHTML("beforeend", `${selected.map((item) => `<li><span>${item.action}「${item.title}」……完成</span><time>剛剛</time></li>`).join("")}<li><span>全部成果已套用</span><time>剛剛</time></li>`);
    $("#apply-title").textContent = "Writer 已完成套用";
    $("#apply-card .spinner").outerHTML = `<span class="success">✓</span>`;
    state.textContent = "已寫入";
    notify("apply.completed 已保存；工作列表與專案內容同步更新。");
  }, 900);
}

function notify(message) {
  $("#snack").textContent = message;
  $("#snack").classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $("#snack").classList.remove("show"), 2600);
}

document.addEventListener("click", (event) => {
  const proposal = event.target.closest("[data-proposal]");
  if (proposal && !event.target.matches("input")) {
    active = proposal.dataset.proposal;
    renderProposals();
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "toggle-activity") $(".activity-card").classList.toggle("collapsed");
  if (action === "toggle-contract") $(".contract-panel").classList.toggle("collapsed");
  if (action === "approve") finishDecision(true);
  if (action === "reject") finishDecision(false);
});

renderProposals();
renderContract();
