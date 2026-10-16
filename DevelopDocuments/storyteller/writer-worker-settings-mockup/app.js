// 正式版由 WorkerRegistry 回傳；新增畫面不硬編碼個別 provider。
const adapterFactories = [
  { id: "comfyui", type: "ComfyUI", initials: "CU", color: "purple", badge: "內建 adapter", description: "連線使用者自管的本機或區網服務" },
  { id: "pixai", type: "PixAI", initials: "PX", color: "blue", badge: "內建 adapter", description: "使用 API token 連線雲端圖片生成服務" },
  { id: "compatible", type: "相容 Worker", initials: "WP", color: "gray", badge: "Worker Protocol", description: "連線實作 SteamLoom Worker Protocol 的外部服務" },
];

const workers = [
  {
    id: "comfyui-local",
    adapter: "comfyui",
    type: "ComfyUI",
    name: "本機 ComfyUI",
    initials: "CU",
    enabled: true,
    status: "online",
    statusLabel: "連線正常",
    detail: "127.0.0.1:8188 · 2 分鐘前檢查",
    endpoint: "http://127.0.0.1:8188",
    workflow: "character-sheet-v3.json",
    capabilities: ["text_to_image", "image_to_image", "reference_image", "lora"],
    description: "Writer 只連線到使用者指定的本機 endpoint。",
  },
  {
    id: "pixai-cloud",
    adapter: "pixai",
    type: "PixAI",
    name: "PixAI 雲端",
    initials: "PX",
    enabled: false,
    status: "unconfigured",
    statusLabel: "尚未完成設定",
    detail: "需要 API token",
    endpoint: "https://api.pixai.art",
    token: "",
    capabilities: [],
    description: "API token 只會保存到 OS Keychain，不會寫入設定檔。",
  },
  {
    id: "comfyui-studio",
    adapter: "comfyui",
    type: "ComfyUI",
    name: "工作室 ComfyUI",
    initials: "CU",
    enabled: true,
    status: "error",
    statusLabel: "無法連線",
    detail: "192.168.50.12:8188 · 逾時",
    endpoint: "http://192.168.50.12:8188",
    workflow: "illustration-v2.json",
    capabilities: [],
    description: "Writer 只連線到使用者指定的區網 endpoint。",
  },
];

let selectedID = workers[0].id;
let dirty = false;
let snackTimer;

const $ = (selector) => document.querySelector(selector);
const workerList = $("#workerList");
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

const capabilityLabels = {
  text_to_image: "文字生成圖片",
  image_to_image: "參考圖生成",
  reference_image: "參考圖片",
  lora: "LoRA",
};

function renderFactories() {
  $("#providerGrid").innerHTML = adapterFactories.map((factory) => `
    <button value="${factory.id}" class="provider-card">
      <span class="provider-icon ${factory.color}">${factory.initials}</span>
      <span><b>${escapeHTML(factory.type)}</b><small>${escapeHTML(factory.description)}</small></span>
      <em class="adapter-badge">${escapeHTML(factory.badge)}</em>
    </button>
  `).join("");
}

function renderRegistry() {
  const query = $("#workerSearch").value.trim().toLowerCase();
  const visible = workers.filter((worker) => `${worker.name} ${worker.type}`.toLowerCase().includes(query));
  workerList.innerHTML = visible.map((worker) => `
    <button class="worker-item ${worker.id === selectedID ? "active" : ""}" data-worker="${worker.id}">
      <span class="worker-logo ${worker.adapter === "pixai" ? "pixai" : worker.status === "error" ? "error" : ""}">${worker.initials}</span>
      <span class="worker-copy"><strong>${escapeHTML(worker.name)}</strong><small>${escapeHTML(worker.type)} · ${escapeHTML(worker.detail)}</small></span>
      ${stateChip(worker)}
    </button>
  `).join("") || '<div class="nav-note">找不到符合的 Worker。</div>';
  $("#registryCount").textContent = `${workers.length} 個設定`;
  $("#enabledCount").textContent = workers.filter((worker) => worker.enabled && worker.status === "online").length;
  $("#problemCount").textContent = workers.filter((worker) => worker.status !== "online").length;
  workerList.querySelectorAll("[data-worker]").forEach((button) => button.addEventListener("click", () => {
    selectedID = button.dataset.worker;
    dirty = false;
    render();
  }));
}

function renderConnectionFields(worker) {
  if (worker.adapter === "pixai") {
    $("#connectionFields").innerHTML = `
      <label><span>API endpoint</span><input data-field="endpoint" value="${escapeHTML(worker.endpoint)}" /></label>
      <label><span>API token</span><span class="secret-field"><input id="tokenField" type="password" data-field="token" value="${escapeHTML(worker.token || "")}" placeholder="尚未設定" /><button type="button" id="revealToken">◉</button></span></label>
    `;
  } else if (worker.adapter === "compatible") {
    $("#connectionFields").innerHTML = `
      <label><span>Manifest endpoint</span><input data-field="endpoint" value="${escapeHTML(worker.endpoint)}" placeholder="http://127.0.0.1:9000/worker" /></label>
      <label><span>Access token</span><span class="secret-field"><input id="tokenField" type="password" data-field="token" value="${escapeHTML(worker.token || "")}" placeholder="選填" /><button type="button" id="revealToken">◉</button></span></label>
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
    ? "✓ 已取得 Worker 資訊與支援能力。"
    : worker.status === "error"
      ? `! 連線逾時；Worker 設定仍維持${worker.enabled ? "啟用" : "停用"}，恢復連線前無法執行工作。`
      : "○ 請完成認證並測試連線。";
}

function renderCapabilities(worker) {
  $("#capabilityStrip").innerHTML = worker.capabilities.length
    ? worker.capabilities.map((item) => `<span class="capability">${escapeHTML(capabilityLabels[item] || item)}</span>`).join("")
    : '<span class="nav-note">連線成功後才會顯示支援功能。</span>';
}

function renderActions() {
  $("#dirtyState").textContent = dirty ? "設定尚未儲存" : "尚無未儲存變更";
  $("#resetChanges").disabled = !dirty;
  $("#saveWorker").disabled = !dirty;
}

function render() {
  const worker = selectedWorker();
  $("#workerLogo").textContent = worker.initials;
  $("#workerLogo").className = `worker-logo ${worker.adapter === "pixai" ? "pixai" : worker.status === "error" ? "error" : ""}`;
  $("#workerType").textContent = worker.type;
  $("#workerName").textContent = worker.name;
  $("#displayName").value = worker.name;
  $("#workerID").value = worker.id;
  $("#workerEnabled").checked = worker.enabled;
  $("#connectionDescription").textContent = worker.description;
  renderConnectionFields(worker);
  renderStatus(worker);
  renderCapabilities(worker);
  renderRegistry();
  renderActions();
}

function markDirty() {
  dirty = true;
  renderActions();
}

$("#workerSearch").addEventListener("input", renderRegistry);
$("#displayName").addEventListener("input", markDirty);
$("#workerEnabled").addEventListener("change", markDirty);
$("#addWorker").addEventListener("click", () => { renderFactories(); addDialog.showModal(); });
$("#deleteWorker").addEventListener("click", () => deleteDialog.showModal());
$("#resetChanges").addEventListener("click", () => { dirty = false; render(); });
$("#saveWorker").addEventListener("click", () => {
  const worker = selectedWorker();
  worker.name = $("#displayName").value.trim() || worker.name;
  worker.enabled = $("#workerEnabled").checked;
  $("#connectionFields").querySelectorAll("[data-field]").forEach((field) => { worker[field.dataset.field] = field.value; });
  dirty = false;
  render();
  showSnack("Worker 設定已儲存");
});

$("#testConnection").addEventListener("click", () => {
  const worker = selectedWorker();
  $("#connectionFields").querySelectorAll("[data-field]").forEach((field) => { worker[field.dataset.field] = field.value; });
  const result = $("#connectionResult");
  result.className = "connection-result testing";
  result.textContent = "↻ 正在測試連線並同步支援功能……";
  window.setTimeout(() => {
    if (!worker.endpoint) {
      result.className = "connection-result error";
      result.textContent = "! 請先輸入 Worker endpoint。";
      return;
    }
    if (worker.adapter === "pixai" && !worker.token) {
      result.className = "connection-result error";
      result.textContent = "! 請先輸入 PixAI API token。";
      return;
    }
    worker.status = "online";
    worker.statusLabel = "連線正常";
    worker.detail = "剛剛完成檢查";
    if (!worker.capabilities.length) worker.capabilities = ["text_to_image", "image_to_image", "reference_image", "lora"];
    dirty = true;
    render();
    showSnack("連線成功，已更新 Worker 支援功能");
  }, 900);
});

$("#rediscover").addEventListener("click", () => {
  showSnack("已重新同步 Worker 支援功能");
});
$("#refreshRegistry").addEventListener("click", () => {
  $("#refreshRegistry").textContent = "◌";
  window.setTimeout(() => { $("#refreshRegistry").textContent = "↻"; showSnack("Worker 狀態檢查完成"); }, 700);
});

addDialog.addEventListener("close", () => {
  const factory = adapterFactories.find((item) => item.id === addDialog.returnValue);
  if (!factory) return;
  const sequence = workers.filter((worker) => worker.adapter === factory.id).length + 1;
  const worker = {
    id: `${factory.id}-${Date.now()}`,
    adapter: factory.id,
    type: factory.type,
    name: sequence > 1 ? `${factory.type} ${sequence}` : factory.type,
    initials: factory.initials,
    enabled: false,
    status: "unconfigured",
    statusLabel: "尚未完成設定",
    detail: "等待設定連線",
    endpoint: factory.id === "pixai" ? "https://api.pixai.art" : "",
    token: "",
    workflow: "尚未同步",
    capabilities: [],
    description: factory.id === "pixai"
      ? "API token 只會保存到 OS Keychain，不會寫入設定檔。"
      : factory.id === "compatible"
        ? "外部服務必須實作 SteamLoom Worker Protocol，Writer 會先驗證 manifest 版本。"
        : "Writer 只連線到使用者指定的本機或區網 endpoint。",
  };
  workers.push(worker);
  selectedID = worker.id;
  dirty = true;
  render();
  showSnack(`已新增 ${worker.type}，請完成連線設定`);
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

renderFactories();
render();
