const body = document.body;
const panel = document.querySelector("#assistant-panel");
const dialog = document.querySelector("#diff-dialog");
const toast = document.querySelector("#toast");
const prompt = document.querySelector("#prompt");
const proposalCard = document.querySelector("#proposal-card");
const proposalStatus = document.querySelector("#proposal-status");
const reviewCounter = document.querySelector("#review-counter");

// 預覽控制只切換 mockup 外框，不會重載畫面，方便直接比較桌面與行動版狀態。
document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    body.classList.toggle("mobile-preview", button.dataset.view === "mobile");
    panel.classList.remove("peek", "expanded");
  });
});

document.querySelector("#theme-toggle").addEventListener("click", () => body.classList.toggle("light"));

document.querySelectorAll(".close-panel").forEach((button) => {
  button.addEventListener("click", () => panel.classList.add("closed"));
});
document.querySelectorAll(".open-panel").forEach((button) => {
  button.addEventListener("click", () => panel.classList.remove("closed"));
});

// 手機 bottom sheet 依序在半開、全開、peek 三種高度循環，示意正式版的拖曳停靠點。
document.querySelector("#sheet-handle").addEventListener("click", () => {
  if (panel.classList.contains("expanded")) {
    panel.classList.remove("expanded");
    panel.classList.add("peek");
  } else if (panel.classList.contains("peek")) {
    panel.classList.remove("peek");
  } else {
    panel.classList.add("expanded");
  }
});

document.querySelector("#review-proposal").addEventListener("click", () => dialog.showModal());
reviewCounter.addEventListener("click", () => proposalCard.scrollIntoView({ behavior: "smooth", block: "center" }));

document.querySelector("#apply-proposal").addEventListener("click", (event) => {
  event.preventDefault();
  dialog.close();
  proposalStatus.textContent = "已套用";
  proposalStatus.className = "status applied";
  reviewCounter.textContent = "提案已處理";
  reviewCounter.disabled = true;
  proposalCard.querySelector(".proposal-actions").innerHTML = '<button class="text-button">查看版本 #48</button><button class="text-button">復原</button>';
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
});

document.querySelector("#reject-proposal").addEventListener("click", () => {
  proposalStatus.textContent = "未採用";
  proposalStatus.className = "status rejected";
  reviewCounter.textContent = "提案已處理";
  reviewCounter.disabled = true;
  proposalCard.querySelector(".proposal-actions").innerHTML = '<button class="text-button" id="explain-rejection">說明不採用原因</button>';
  document.querySelector("#explain-rejection").addEventListener("click", () => {
    prompt.value = "這版沒有採用，因為 ";
    prompt.focus();
  });
});

document.querySelectorAll(".context-chip").forEach((button) => {
  if (!button.textContent.includes("加入")) button.addEventListener("click", () => button.classList.toggle("active"));
});
document.querySelector("#context-main").addEventListener("click", (event) => {
  if (event.target.tagName === "B") event.currentTarget.remove();
});
document.querySelector("#add-context").addEventListener("click", () => {
  document.querySelector(".context-chip:not(.active)")?.classList.add("active");
});

document.querySelectorAll(".slash-button").forEach((button) => {
  button.addEventListener("click", () => {
    prompt.value = button.dataset.prompt;
    prompt.focus();
  });
});

document.querySelector("#send-message").addEventListener("click", () => {
  if (!prompt.value.trim()) return prompt.focus();
  prompt.value = "";
  toast.textContent = "已送出，處理期間可以繼續編輯稿件。";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
});

document.querySelector("#reset-demo").addEventListener("click", () => window.location.reload());
