const workers = [
  {
    id: "comfyui-local",
    type: "ComfyUI",
    name: "本機 ComfyUI",
    initials: "CU",
    enabled: true,
    status: "online",
    statusLabel: "連線正常",
    detail: "127.0.0.1:8188 · 2 分鐘前檢查",
    endpoint: "http://127.0.0.1:8188",
    workflow: "character-sheet-v3.json",
    schemaVersion: "comfyui.image/v1",
    capabilities: ["text_to_image", "image_to_image", "reference_image", "lora"],
    fields: [
      ["prompt", "textarea", true, "由 media brief 預填"],
      ["negative_prompt", "textarea", false, "由 media brief 預填"],
      ["workflow_id", "select", true, "本機 workflow catalog"],
      ["checkpoint", "remote_select", true, "依 workflow 篩選"],
      ["loras", "repeatable", false, "LoRA＋權重"],
      ["size", "size", true, "workflow presets"],
      ["seed", "integer", false, "空白代表隨機"],
    ],
    description: "Writer 只連線到使用者指定的本機 endpoint。",
  },
  {
    id: "pixai-cloud",
    type: "PixAI",
    name: "PixAI 雲端",
    initials: "PX",
    enabled: false,
    status: "unconfigured",
    statusLabel: "尚未完成設定",
    detail: "需要 API token",
    endpoint: "https://api.pixai.art",
    token: "",
    schemaVersion: "pixai.image/v1",
    capabilities: ["text_to_image", "image_to_image", "lora"],
    fields: [
      ["prompt", "textarea", true, "由 media brief 預填"],
      ["negative_prompt", "textarea", false, "由 media brief 預填"],
      ["model_id", "remote_select", true, "PixAI model catalog"],
      ["loras", "repeatable", false, "LoRA＋權重"],
      ["size", "size", true, "依 model 能力限制"],
      ["count", "integer", true, "1～4"],
    ],
    description: "API token 只會保存到 OS Keychain，不會寫入設定檔。",
  },
  {
    id: "comfyui-studio",
    type: "ComfyUI",
    name: "工作室 ComfyUI",
    initials: "CU",
    enabled: false,
    status: "error",
    statusLabel: "無法連線",
    detail: "192.168.50.12:8188 · 逾時",
    endpoint: "http://192.168.50.12:8188",
    workflow: "illustration-v2.json",
    schemaVersion: "comfyui.image/v1",
    capabilities: [],
    fields: [],
    description: "Writer 只連線到使用者指定的區網 endpoint。",
  },
];

let selectedID = workers[0].id;
let activeTab = "connection";
let dirty = false;
let snackTimer;

const $ = (selector) => document.querySelector(selector);
const workerList = $("#workerList");
const tabs = $("#tabs");
const addDialog = $("#addDialog");
const deleteDialog = $("#deleteDialog");

function selectedWorker() {
  return workers.find((worker) => worker.id === selectedID) ?? workers[0];
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

function showSnack(message) {
  const snack = $("#snack");
  snack.textContent = message;
  snack.classList.add("show");
  window.clearTimeout(snackTimer);
  snackTimer = window.setTimeout(() => snack.classList.remove("show"), 2200);
}

function stateChip(worker) {
  if (worker.status === "online") return '<span class="state-chip online">已連線</span>';
  if (worker.status === "error") return '<span class="state-chip error">異常</span>';
  return '<span class="state-chip">未設定</span>';
}

function renderRegistry() {
  const query = $("#workerSearch").value.trim().toLowerCase();
  const visible = workers.filter((worker) => `${worker.name} ${worker.type}`.toLowerCase().includes(query));
  workerList.innerHTML = visible.map((worker) => `
    <button class="worker-item ${worker.id === selectedID ? "active" : ""}" data-worker="${worker.id}">
      <span class="worker-logo ${worker.type === "PixAI" ? "pixai" : worker.status === "error" ? "error" : ""}">${worker.initials}</span>
      <span class="worker-copy"><strong>${escapeHTML(worker.name)}</strong><small>${escapeHTML(worker.type)} · ${escapeHTML(worker.detail)}</small></span>
      ${stateChip(worker)}
    </button>
  `).join("") || '<div class="nav-note">找不到符合的 Worker。</div>';
  $("#registryCount").textContent = `${workers.length} 個設定`;
  $("#enabledCount").textContent = workers.filter((worker) => worker.enabled && worker.status === "online").length;
  $("#problemCount").textContent = workers.filter((worker) => worker.status === "error").length;
  workerList.querySelectorAll("[data-worker]").forEach((button) => button.addEventListener("click", () => {
    selectedID = button.dataset.worker;
    dirty = false;
    render();
  }));
}

function renderConnectionFields(worker) {
  if (worker.type === "PixAI") {
    $("#connectionFields").innerHTML = `
      <label><span>API endpoint</span><input data-field="endpoint" value="${escapeHTML(worker.endpoint)}" /></label>
      <label><span>API token</span><span class="secret-field"><input id="tokenField" type="password" data-field="token" value="${escapeHTML(worker.token || "")}" placeholder="尚未設定" /><button type="button" id="revealToken">◉</button></span></label>
    `;
  } else {
    $("#connectionFields").innerHTML = `
      <label><span>Endpoint</span><input data-field="endpoint" value="${escapeHTML(worker.endpoint)}" /></label>
      <label><span>預設 workflow</span><select data-field="workflow"><option>${escapeHTML(worker.workflow || "尚未同步")}</option><option>illustration-v2.json</option></select></label>
    `;
  }
  $("#connectionFields").querySelectorAll("input, select").forEach((input) => input.addEventListener("input", markDirty));
  $("#revealToken")?.addEventListener("click", () => {
    const token = $("#tokenField");
    token.type = token.type === "password" ? "text" : "password";
  });
}

function renderStatus(worker) {
  const statusClass = worker.status === "online" ? "online" : worker.status === "error" ? "offline" : "";
  $("#workerStatus").innerHTML = `<i class="status-dot ${statusClass}"></i><span>${escapeHTML(worker.statusLabel)} · ${escapeHTML(worker.detail)}</span>`;
  const result = $("#connectionResult");
  result.className = `connection-result${worker.status === "error" ? " error" : ""}`;
  result.innerHTML = worker.status === "online"
    ? "✓ 已取得 Worker 資訊與輸入 schema。"
    : worker.status === "error"
      ? "! 連線逾時；目前不會提供給 Agent 使用。"
      : "○ 請完成認證並測試連線。";
}

function renderCapabilities(worker) {
  $("#capabilityStrip").innerHTML = worker.capabilities.length
    ? worker.capabilities.map((item) => `<span class="capability">${escapeHTML(item)}</span>`).join("")
    : '<span class="nav-note">連線成功後才會顯示 discovery 結果。</span>';
  $("#schemaVersion").textContent = worker.schemaVersion;
  $("#schemaTable").innerHTML = `
    <div class="schema-row header"><span>欄位</span><span>元件</span><span>必要</span><span>資料來源／限制</span></div>
    ${worker.fields.map(([name, type, required, note]) => `
      <div class="schema-row"><span><code>${escapeHTML(name)}</code></span><span>${escapeHTML(type)}</span><span class="${required ? "required" : ""}">${required ? "必要" : "選填"}</span><span>${escapeHTML(note)}</span></div>
    `).join("") || '<div class="schema-row"><span>—</span><span>—</span><span>—</span><span>尚未取得 schema</span></div>'}
  `;
}

function agentSummary(worker) {
  return JSON.stringify({
    id: worker.id,
    display_name: worker.name,
    media_types: ["image"],
    capabilities: worker.enabled && worker.status === "online" ? worker.capabilities : [],
    brief_fields: ["prompt", "negative_prompt", "aspect_ratio", "references", "notes"],
  }, null, 2);
}

function renderTabs() {
  tabs.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.tab === activeTab));
  $("#connectionTab").hidden = activeTab !== "connection";
  $("#capabilitiesTab").hidden = activeTab !== "capabilities";
  $("#agentTab").hidden = activeTab !== "agent";
}

function renderActions() {
  $("#dirtyState").textContent = dirty ? "設定尚未儲存" : "尚無未儲存變更";
  $("#resetChanges").disabled = !dirty;
  $("#saveWorker").disabled = !dirty;
}

function render() {
  const worker = selectedWorker();
  $("#workerLogo").textContent = worker.initials;
  $("#workerLogo").className = `worker-logo ${worker.type === "PixAI" ? "pixai" : worker.status === "error" ? "error" : ""}`;
  $("#workerType").textContent = worker.type;
  $("#workerName").textContent = worker.name;
  $("#displayName").value = worker.name;
  $("#workerID").value = worker.id;
  $("#workerEnabled").checked = worker.enabled;
  $("#connectionDescription").textContent = worker.description;
  $("#agentSummary").textContent = agentSummary(worker);
  renderConnectionFields(worker);
  renderStatus(worker);
  renderCapabilities(worker);
  renderRegistry();
  renderTabs();
  renderActions();
}

function markDirty() {
  dirty = true;
  renderActions();
}

tabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  activeTab = button.dataset.tab;
  renderTabs();
});

$("#workerSearch").addEventListener("input", renderRegistry);
$("#displayName").addEventListener("input", markDirty);
$("#workerEnabled").addEventListener("change", markDirty);
$("#addWorker").addEventListener("click", () => addDialog.showModal());
$("#deleteWorker").addEventListener("click", () => deleteDialog.showModal());
$("#resetChanges").addEventListener("click", () => { dirty = false; render(); });
$("#saveWorker").addEventListener("click", () => {
  const worker = selectedWorker();
  worker.name = $("#displayName").value.trim() || worker.name;
  worker.enabled = $("#workerEnabled").checked && worker.status === "online";
  dirty = false;
  render();
  showSnack("Worker 設定已儲存");
});

$("#testConnection").addEventListener("click", () => {
  const worker = selectedWorker();
  const result = $("#connectionResult");
  result.className = "connection-result testing";
  result.textContent = "↻ 正在測試連線並同步 capabilities……";
  window.setTimeout(() => {
    if (worker.type === "PixAI" && !$("#tokenField")?.value) {
      result.className = "connection-result error";
      result.textContent = "! 請先輸入 PixAI API token。";
      return;
    }
    worker.status = "online";
    worker.statusLabel = "連線正常";
    worker.detail = "剛剛完成檢查";
    if (!worker.capabilities.length) worker.capabilities = ["text_to_image", "image_to_image", "reference_image", "lora"];
    worker.enabled = true;
    dirty = true;
    render();
    showSnack("連線成功，已更新 Worker capabilities");
  }, 900);
});

$("#rediscover").addEventListener("click", () => {
  showSnack("已重新同步 capability 與 schema");
});
$("#copySummary").addEventListener("click", async () => {
  await navigator.clipboard?.writeText($("#agentSummary").textContent);
  showSnack("已複製 Agent capability summary");
});
$("#refreshRegistry").addEventListener("click", () => {
  $("#refreshRegistry").textContent = "◌";
  window.setTimeout(() => { $("#refreshRegistry").textContent = "↻"; showSnack("Worker 狀態檢查完成"); }, 700);
});

addDialog.addEventListener("close", () => {
  if (addDialog.returnValue !== "comfyui" && addDialog.returnValue !== "pixai") return;
  selectedID = addDialog.returnValue === "comfyui" ? "comfyui-studio" : "pixai-cloud";
  activeTab = "connection";
  dirty = false;
  render();
  showSnack(`已開啟 ${selectedWorker().type} 設定`);
});
deleteDialog.addEventListener("close", () => {
  if (deleteDialog.returnValue !== "confirm" || workers.length <= 1) return;
  const index = workers.findIndex((worker) => worker.id === selectedID);
  workers.splice(index, 1);
  selectedID = workers[0].id;
  dirty = false;
  render();
  showSnack("Worker 設定已刪除");
});

render();
