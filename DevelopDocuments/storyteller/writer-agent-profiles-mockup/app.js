const scenarioButtons = document.querySelectorAll(".scenario");
const providerButtons = document.querySelectorAll(".provider");
const agent = document.querySelector("#agentSelect");
const model = document.querySelector("#modelSelect");
const modelField = document.querySelector("#modelField");
const effort = document.querySelector("#effortSelect");
const effortField = document.querySelector("#effortField");
const notice = document.querySelector("#profileNotice");
const refresh = document.querySelector("#refreshButton");
const send = document.querySelector("#sendButton");
const profileScenarioBar = document.querySelector("#profileScenarioBar");
const activityCard = document.querySelector("#activityCard");
const threadSubtitle = document.querySelector("#threadSubtitle");
const messageMeta = document.querySelector("#messageMeta");
const errorText = document.querySelector("#errorText");
const errorModel = document.querySelector("#errorModel");

// 先只開放 Codex 的 model / effort；其他 Agent 維持各自 CLI 預設值。
const providers = {
  codex: {
    name: "Codex",
    configurable: true,
    source: "Codex 目前登入的 ChatGPT 帳號",
    models: ["GPT-5.6-Sol（帳號預設）", "GPT-5.6-Terra", "GPT-5.6-Luna"],
    efforts: ["Low（model 預設）", "Medium", "High", "Extra high", "Max", "Ultra"],
    invalid: "gpt-6-sol",
  },
  claude: { name: "Claude Code" },
  grok: { name: "Grok Build" },
  gemini: { name: "Gemini CLI" },
  antigravity: { name: "Antigravity" },
};

let currentProvider = "codex";
let currentScenario = "ready";

function optionList(items, placeholder = false) {
  return items.map((label, index) => `<option value="${placeholder && index === 0 ? "" : label}">${label}</option>`).join("");
}

function render() {
  const config = providers[currentProvider];
  providerButtons.forEach((button) => button.classList.toggle("active", button.dataset.provider === currentProvider));
  scenarioButtons.forEach((button) => button.classList.toggle("active", button.dataset.scenario === currentScenario));
  agent.innerHTML = `<option>${config.name}</option>`;
  modelField.hidden = effortField.hidden = refresh.hidden = profileScenarioBar.hidden = activityCard.hidden = !config.configurable;
  threadSubtitle.textContent = config.configurable
    ? `${config.name} · 可在下一輪調整 model 與推理等級`
    : `${config.name} · 使用 Agent 預設執行設定`;

  if (!config.configurable) {
    notice.textContent = `${config.name} 目前使用 CLI 預設 model 與推理設定，Writer 暫不提供調整。`;
    notice.className = "profile-notice";
    send.disabled = false;
    messageMeta.textContent = `2026-10-16 14:18 · ${config.name} · Agent 預設`;
    refresh.classList.remove("spinning");
    return;
  }

  errorModel.textContent = config.invalid;
  errorText.textContent = "這個 model 無法由目前的 ChatGPT 帳號使用。Writer 已重新取得 Codex model 清單，請在下方改選後重試。";

  if (currentScenario === "loading") {
    notice.textContent = `正在向 ${config.name} 取得目前登入帳號可用的執行設定……`;
    notice.className = "profile-notice loading";
    model.innerHTML = "<option>同步中……</option>";
    effort.innerHTML = "<option>同步中……</option>";
    model.disabled = effort.disabled = send.disabled = true;
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
  effort.disabled = invalid;
  send.disabled = invalid;
  refresh.classList.remove("spinning");
  messageMeta.textContent = `2026-10-16 14:18 · ${config.name} · ${config.models[0]} · ${config.efforts[0]}`;
}

providerButtons.forEach((button) => button.addEventListener("click", () => {
  currentProvider = button.dataset.provider;
  currentScenario = "ready";
  render();
}));
scenarioButtons.forEach((button) => button.addEventListener("click", () => {
  currentScenario = button.dataset.scenario;
  render();
}));
model.addEventListener("change", () => {
  if (!model.value) return;
  const config = providers[currentProvider];
  notice.textContent = `將使用 ${model.options[model.selectedIndex].text}；推理等級已依該 Codex model 的能力更新。`;
  notice.className = "profile-notice";
  effort.disabled = false;
  send.disabled = false;
});
refresh.addEventListener("click", () => {
  currentScenario = "loading";
  render();
  window.setTimeout(() => {
    currentScenario = "ready";
    render();
  }, 850);
});
