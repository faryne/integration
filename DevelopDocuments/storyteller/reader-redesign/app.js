const body = document.body;
const indexPanel = document.getElementById("indexPanel");
const indexButton = document.getElementById("indexButton");
const workButton = document.getElementById("workButton");
const workPanel = document.getElementById("workPanel");
const settingsButton = document.getElementById("settingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const bookmarkEditToggles = document.querySelectorAll("[data-bookmark-edit-toggle]");
const scrim = document.getElementById("scrim");
const toast = document.getElementById("toast");
const appearanceButton = document.getElementById("appearanceButton");
const appearancePopover = document.getElementById("appearancePopover");
let toastTimer;

function closeOverlays() {
  indexPanel.classList.remove("is-open");
  indexPanel.setAttribute("aria-hidden", "true");
  indexButton.setAttribute("aria-expanded", "false");
  workPanel.hidden = true;
  workButton.setAttribute("aria-expanded", "false");
  settingsPanel.hidden = true;
  settingsButton.setAttribute("aria-expanded", "false");
  scrim.hidden = true;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1600);
}

indexButton.addEventListener("click", () => {
  const shouldOpen = !indexPanel.classList.contains("is-open");
  closeOverlays();
  if (!shouldOpen) return;
  indexPanel.classList.add("is-open");
  indexPanel.setAttribute("aria-hidden", "false");
  indexButton.setAttribute("aria-expanded", "true");
  scrim.hidden = false;
});

workButton.addEventListener("click", () => {
  const shouldOpen = workPanel.hidden;
  closeOverlays();
  if (!shouldOpen) return;
  workPanel.hidden = false;
  workButton.setAttribute("aria-expanded", "true");
  scrim.hidden = false;
});

settingsButton.addEventListener("click", () => {
  const shouldOpen = settingsPanel.hidden;
  closeOverlays();
  if (!shouldOpen) return;
  settingsPanel.hidden = false;
  settingsButton.setAttribute("aria-expanded", "true");
});

scrim.addEventListener("click", closeOverlays);
document.querySelector(".panel-close").addEventListener("click", closeOverlays);
document.addEventListener("keydown", (event) => event.key === "Escape" && closeOverlays());

document.querySelectorAll("[data-panel-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.panelTab;
    document.querySelectorAll("[data-panel-tab]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-panel-content]").forEach((panel) => {
      const active = panel.dataset.panelContent === target;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  });
});

document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => {
    closeOverlays();
    document.getElementById(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth" });
  });
});

const lineBookmarkButtons = document.querySelectorAll(".line-bookmark");

lineBookmarkButtons.forEach((button) => {
  // 非編輯模式只顯示收藏狀態，不允許單獨移除，避免加入／移除規則不對稱。
  button.disabled = true;
  button.setAttribute("aria-label", button.classList.contains("is-saved") ? "移除書籤" : "加入書籤");
  button.addEventListener("click", () => {
    const saved = button.classList.toggle("is-saved");
    button.firstElementChild.textContent = saved ? "◆" : "◇";
    button.querySelector(".bookmark-label").textContent = saved ? "移除書籤" : "加入書籤";
    button.setAttribute("aria-label", saved ? "移除書籤" : "加入書籤");
    showToast(saved ? "已加入書籤" : "已移除書籤");
  });
});

bookmarkEditToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const editing = !body.classList.contains("bookmark-editing");
    body.classList.toggle("bookmark-editing", editing);
    lineBookmarkButtons.forEach((lineButton) => {
      lineButton.disabled = !editing;
    });
    bookmarkEditToggles.forEach((toggle) => {
      toggle.setAttribute("aria-pressed", String(editing));
      toggle.firstElementChild.textContent = editing ? "✓" : "◇";
      toggle.lastElementChild.textContent = editing ? "完成" : "編輯書籤";
    });
  });
});

document.querySelectorAll("[data-font-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const output = document.getElementById("fontValue");
    const delta = button.dataset.fontAction === "increase" ? 1 : -1;
    const value = Math.max(15, Math.min(24, Number(output.textContent) + delta));
    output.textContent = value;
    document.documentElement.style.setProperty("--story-font-size", `${value}px`);
  });
});

function bindSegmented(selector, property, unit = "") {
  document.querySelectorAll(selector).forEach((button) => {
    button.addEventListener("click", () => {
      button.parentElement.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      document.documentElement.style.setProperty(property, `${button.dataset[selector.includes("line") ? "lineHeight" : "measure"]}${unit}`);
    });
  });
}

bindSegmented("[data-line-height]", "--story-line-height");
bindSegmented("[data-measure]", "--story-measure", "px");

document.getElementById("themeButton").addEventListener("click", () => {
  body.classList.toggle("reader-night");
});

document.getElementById("catalogFooterButton").addEventListener("click", () => indexButton.click());

appearanceButton.addEventListener("click", () => {
  appearancePopover.hidden = !appearancePopover.hidden;
  appearanceButton.setAttribute("aria-expanded", String(!appearancePopover.hidden));
});

function updateReadingProgress() {
  const storyPaper = document.getElementById("storyPaper");
  const start = storyPaper.offsetTop;
  const scrollable = Math.max(storyPaper.offsetHeight - window.innerHeight, 1);
  const progress = Math.min(100, Math.max(0, ((window.scrollY - start) / scrollable) * 100));
  const roundedProgress = Math.round(progress);
  document.getElementById("progressBar").style.width = `${progress}%`;
  document.getElementById("progressValue").textContent = `${roundedProgress}%`;
}

window.addEventListener("scroll", updateReadingProgress, { passive: true });
window.addEventListener("resize", updateReadingProgress);
updateReadingProgress();
