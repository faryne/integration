const body = document.body;
const writingView = document.querySelector("#writing-view");
const reviewView = document.querySelector("#review-view");
const command = document.querySelector("#ai-command");
const prompt = document.querySelector("#command-prompt");
const thread = document.querySelector("#inline-thread");
const threadContent = thread.querySelector(".thread-content");
const toast = document.querySelector("#toast");
const slashMenu = document.querySelector("#slash-menu");

function setPreview(view) {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  body.classList.toggle("mobile-preview", view === "mobile");
  document.querySelectorAll(".diff-pane").forEach((pane, index) => pane.classList.toggle("mobile-active", index === 0));
}

function openCommand(value = "") {
  slashMenu.hidden = true;
  command.hidden = false;
  prompt.value = value;
  prompt.focus();
}

function closeCommand() {
  command.hidden = true;
  prompt.value = "";
}

function showWriting() {
  reviewView.hidden = true;
  writingView.hidden = false;
  closeCommand();
}

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setPreview(button.dataset.view)));
document.querySelector("#theme-toggle").addEventListener("click", () => body.classList.toggle("light"));
document.querySelector("#reset-demo").addEventListener("click", () => window.location.reload());
document.querySelector("#slash-demo").addEventListener("click", () => slashMenu.hidden = !slashMenu.hidden);
document.querySelectorAll(".ask-ai").forEach((button) => button.addEventListener("click", () => openCommand()));
document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
  prompt.value = button.dataset.preset;
  prompt.focus();
}));
document.querySelector(".thread-pin").addEventListener("click", () => thread.scrollIntoView({ behavior: "smooth", block: "center" }));
document.querySelector("#thread-jump").addEventListener("click", () => {
  showWriting();
  thread.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector(".collapse-thread").addEventListener("click", (event) => {
  const collapsed = threadContent.classList.toggle("collapsed");
  event.currentTarget.textContent = collapsed ? "展開" : "收合";
  event.currentTarget.setAttribute("aria-expanded", String(!collapsed));
});

command.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!prompt.value.trim()) return prompt.focus();
  closeCommand();
  threadContent.classList.remove("collapsed");
  thread.scrollIntoView({ behavior: "smooth", block: "center" });
  toast.textContent = "已送出；AI 執行期間仍可繼續編輯。";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !command.hidden) closeCommand();
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !command.hidden) command.requestSubmit();
});

document.querySelector("#open-review").addEventListener("click", () => {
  writingView.hidden = true;
  reviewView.hidden = false;
  closeCommand();
});
document.querySelector("#close-review").addEventListener("click", showWriting);

function rejectProposal() {
  const status = document.querySelector("#proposal-status");
  status.textContent = "未採用";
  status.className = "status rejected";
  showWriting();
  toast.textContent = "已保留討論，修改提案不會套用。";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

document.querySelector("#reject-inline").addEventListener("click", rejectProposal);
document.querySelector("#reject-change").addEventListener("click", rejectProposal);

document.querySelectorAll("[data-diff]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-diff]").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".diff-pane").forEach((pane) => pane.classList.toggle("mobile-active", pane.classList.contains(`${button.dataset.diff}-pane`)));
}));

document.querySelector("#apply-change").addEventListener("click", () => {
  document.querySelector("#selected-copy").textContent = "莉亞停在門內，先低頭看了眼鞋底。不是她帶進來的水。那串腳印越過空蕩的倉庫，停在父親的木箱前；鎖扣朝左，和她早上留下的方向相反。";
  const status = document.querySelector("#proposal-status");
  status.textContent = "已套用";
  status.className = "status applied";
  showWriting();
  toast.textContent = "已套用修改並建立版本 #48。";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
});

setPreview("desktop");
