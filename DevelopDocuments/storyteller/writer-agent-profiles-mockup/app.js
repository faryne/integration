const scenarioButtons = document.querySelectorAll(".scenario");
const providerButtons = document.querySelectorAll(".provider");
const agent = document.querySelector("#agentSelect");
const model = document.querySelector("#modelSelect");
const customModelField = document.querySelector("#customModelField");
const customModelInput = document.querySelector("#customModelInput");
const effort = document.querySelector("#effortSelect");
const notice = document.querySelector("#profileNotice");
const refresh = document.querySelector("#refreshButton");
const send = document.querySelector("#sendButton");
const threadSubtitle = document.querySelector("#threadSubtitle");
const messageMeta = document.querySelector("#messageMeta");
const errorText = document.querySelector("#errorText");
const errorModel = document.querySelector("#errorModel");

// Mockup 只描述 adapter 回傳的能力，不把任一家 model 清單當成全域常數。
const providers = {
  codex: {
    name: "Codex",
    source: "目前 ChatGPT 帳號",
    models: ["GPT-5.6-Sol（帳號預設）", "GPT-5.6-Terra", "GPT-5.6-Luna"],
    efforts: ["Low（model 預設）", "Medium", "High", "Extra high", "Max", "Ultra"],
    invalid: "gpt-6-sol",
  },
  claude: {
    name: "Claude Code",
    source: "Claude Code 設定；此 CLI 無 model list，另提供進階 model ID",
    models: ["使用 Claude Code 預設", "手動指定 model ID…"],
    efforts: ["使用 Agent 預設", "Low", "Medium", "High", "Extra high", "Max"],
    invalid: "claude-unavailable-model",
  },
  grok: {
    name: "Grok Build",
    source: "grok models",
    models: ["grok-4.6（帳號預設）", "grok-4.5"],
    efforts: ["使用 model 預設", "Low", "Medium", "High"],
    invalid: "grok-4.7",
  },
  gemini: {
    name: "Gemini CLI",
    source: "Gemini CLI 設定；此 CLI 無 model list，另提供進階 model ID",
    models: ["使用 Gemini CLI 預設", "手動指定 model ID…"],
    efforts: ["Gemini CLI 未提供 reasoning effort 參數"],
    invalid: "gemini-unavailable-model",
    effortDisabled: true,
  },
  antigravity: {
    name: "Antigravity",
    source: "agy models",
    models: ["使用帳號預設", "由 agy models 回傳的其他 model"],
    efforts: ["使用 model 預設", "Low", "Medium", "High"],
    invalid: "antigravity-unavailable-model",
  },
};

let currentProvider = "codex";
let currentScenario = "ready";

function optionList(items, placeholder = false) {
  return items.map((label, index) => `<option value="${placeholder && index === 0 ? "" : label}">${label}</option>`).join("");
}

function updateCustomModel() {
  const custom = model.value.includes("手動指定 model ID");
  customModelField.classList.toggle("visible", custom);
  if (!custom) customModelInput.value = "";
  if (custom) {
    customModelInput.focus();
    send.disabled = !customModelInput.value.trim();
  }
}

function render() {
  const config = providers[currentProvider];
  providerButtons.forEach((button) => button.classList.toggle("active", button.dataset.provider === currentProvider));
  scenarioButtons.forEach((button) => button.classList.toggle("active", button.dataset.scenario === currentScenario));
  agent.innerHTML = `<option>${config.name}</option>`;
  threadSubtitle.textContent = `${config.name} · 可在下一輪調整 model${config.effortDisabled ? "" : " 與推理等級"}`;
  errorModel.textContent = config.invalid;
  errorText.textContent = `這個 model 無法由目前的 ${config.name} 登入帳號使用。Writer 已重新解析該 adapter 的能力，請在下方改選後重試。`;

  if (currentScenario === "loading") {
    notice.textContent = `正在向 ${config.name} 取得目前登入帳號可用的執行設定……`;
    notice.className = "profile-notice loading";
    model.innerHTML = "<option>同步中……</option>";
    effort.innerHTML = "<option>同步中……</option>";
    model.disabled = effort.disabled = send.disabled = true;
    customModelField.classList.remove("visible");
    customModelInput.value = "";
    refresh.classList.add("spinning");
    return;
  }

  const invalid = currentScenario === "invalid";
  notice.textContent = invalid
    ? `先前使用的 ${config.invalid} 已不可用；請改選 model 後再送出。`
    : `設定來源：${config.source}。Writer 只顯示這個 adapter 能確認的選項。`;
  notice.className = invalid ? "profile-notice error" : "profile-notice";
  model.innerHTML = optionList(invalid ? ["請選擇可用 model", ...config.models] : config.models, invalid);
  effort.innerHTML = optionList(config.efforts);
  model.disabled = false;
  effort.disabled = invalid || Boolean(config.effortDisabled);
  send.disabled = invalid;
  refresh.classList.remove("spinning");
  messageMeta.textContent = `2026-10-16 14:18 · ${config.name} · ${config.models[0]} · ${config.efforts[0]}`;
  updateCustomModel();
}

providerButtons.forEach((button) => button.addEventListener("click", () => {
  currentProvider = button.dataset.provider;
  render();
}));
scenarioButtons.forEach((button) => button.addEventListener("click", () => {
  currentScenario = button.dataset.scenario;
  render();
}));
model.addEventListener("change", () => {
  if (!model.value) return;
  const config = providers[currentProvider];
  updateCustomModel();
  const custom = model.value.includes("手動指定 model ID");
  notice.textContent = custom
    ? "請輸入 provider 接受的完整 model ID；Writer 會保存於這一輪 task，執行失敗時仍可直接改選。"
    : `將使用 ${model.options[model.selectedIndex].text}；${config.effortDisabled ? "推理等級由 Agent 管理。" : "推理等級已依 adapter 能力更新。"}`;
  notice.className = "profile-notice";
  effort.disabled = Boolean(config.effortDisabled);
  send.disabled = custom && !customModelInput.value.trim();
});
customModelInput.addEventListener("input", () => {
  send.disabled = !customModelInput.value.trim();
});
refresh.addEventListener("click", () => {
  currentScenario = "loading";
  render();
  window.setTimeout(() => {
    currentScenario = "ready";
    render();
  }, 850);
});
