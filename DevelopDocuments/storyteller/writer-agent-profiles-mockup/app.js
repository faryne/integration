const scenarios = document.querySelectorAll(".scenario");
const model = document.querySelector("#modelSelect");
const effort = document.querySelector("#effortSelect");
const notice = document.querySelector("#profileNotice");
const refresh = document.querySelector("#refreshButton");
const send = document.querySelector("#sendButton");

const states = {
  ready: {
    notice: "已依目前 ChatGPT 帳號同步 3 個可用 models。",
    className: "profile-notice",
    options: ["GPT-5.6-Sol（帳號預設）", "GPT-5.6-Terra", "GPT-5.6-Luna"],
    disabled: false,
  },
  invalid: {
    notice: "先前使用的 gpt-6-sol 已不在目前帳號可用清單中，請改選 model 後再送出。",
    className: "profile-notice error",
    options: ["請選擇可用 model", "GPT-5.6-Sol（帳號預設）", "GPT-5.6-Terra", "GPT-5.6-Luna"],
    disabled: false,
  },
  loading: {
    notice: "正在向 Codex 同步目前帳號可用的 models……",
    className: "profile-notice loading",
    options: ["同步中……"],
    disabled: true,
  },
};

function render(name) {
  const state = states[name];
  scenarios.forEach((button) => button.classList.toggle("active", button.dataset.scenario === name));
  notice.textContent = state.notice;
  notice.className = state.className;
  model.innerHTML = state.options.map((label, index) => `<option value="${index ? label : name === "ready" ? label : ""}">${label}</option>`).join("");
  model.disabled = state.disabled;
  effort.disabled = state.disabled || name === "invalid";
  send.disabled = state.disabled || name === "invalid";
  refresh.classList.toggle("spinning", state.disabled);
}

scenarios.forEach((button) => button.addEventListener("click", () => render(button.dataset.scenario)));
model.addEventListener("change", () => {
  if (!model.value) return;
  notice.textContent = `將使用 ${model.options[model.selectedIndex].text}；推理等級會依該 model 的支援清單更新。`;
  notice.className = "profile-notice";
  effort.disabled = false;
  send.disabled = false;
});
refresh.addEventListener("click", () => {
  render("loading");
  window.setTimeout(() => render("ready"), 850);
});
