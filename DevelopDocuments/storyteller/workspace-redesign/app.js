const workspace = document.getElementById("workspace");
const navigatorTrigger = document.getElementById("navigatorTrigger");
const navigatorClose = document.getElementById("navigatorClose");
const navigatorScrim = document.getElementById("navigatorScrim");
const navigatorCollapse = document.getElementById("navigatorCollapse");
const listView = document.getElementById("listView");
const editorView = document.getElementById("editorView");
const trailSection = document.getElementById("trailSection");
const trailDetail = document.getElementById("trailDetail");
const contentTitle = document.getElementById("contentTitle");
const contentEyebrow = document.getElementById("contentEyebrow");
const createItemButton = document.getElementById("createItemButton");
const editorTitle = document.getElementById("editorTitle");
const toast = document.getElementById("mockToast");
let toastTimer;

const sectionMeta = {
  stories: { label: "作品與冊", count: 11, create: "新增作品" },
  lores: { label: "設定集", count: 18, create: "新增設定" },
  assets: { label: "資產集", count: 24, create: "上傳資產" },
};

function openNavigator() {
  workspace.classList.add("navigator-open");
  navigatorTrigger.setAttribute("aria-expanded", "true");
  navigatorScrim.hidden = false;
}

function closeNavigator() {
  workspace.classList.remove("navigator-open");
  navigatorTrigger.setAttribute("aria-expanded", "false");
  navigatorScrim.hidden = true;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(
    () => toast.classList.remove("is-visible"),
    1500,
  );
}

navigatorTrigger.addEventListener("click", openNavigator);
navigatorClose.addEventListener("click", closeNavigator);
navigatorScrim.addEventListener("click", closeNavigator);
document.addEventListener(
  "keydown",
  (event) => event.key === "Escape" && closeNavigator(),
);

navigatorCollapse.addEventListener("click", () => {
  const collapsed = workspace.classList.toggle("is-collapsed");
  navigatorCollapse.setAttribute(
    "aria-label",
    collapsed ? "展開側邊欄" : "收合側邊欄",
  );
  navigatorCollapse.setAttribute(
    "title",
    collapsed ? "展開側邊欄" : "收合側邊欄",
  );
});

document.querySelectorAll(".group-heading").forEach((button) => {
  button.addEventListener("click", () => {
    const group = button.closest(".navigator-group");
    const open = group.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(open));
  });
});

document.querySelectorAll(".navigator-item").forEach((button) => {
  button.addEventListener("click", (event) => {
    if (event.target.closest(".branch-toggle")) {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      button.closest(".tree-collection").querySelector(".nested-items").hidden =
        !expanded;
      return;
    }
    const section = button.dataset.section;
    const meta = sectionMeta[section];
    document
      .querySelectorAll(".navigator-item")
      .forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll(".content-panel").forEach((panel) => {
      const active = panel.dataset.panel === section;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
    listView.hidden = false;
    editorView.hidden = true;
    trailSection.textContent = meta.label;
    trailDetail.textContent = button.dataset.title;
    contentTitle.textContent = button.dataset.title;
    contentEyebrow.textContent = `${meta.label} · ${meta.count} 個項目`;
    createItemButton.lastElementChild.textContent = meta.create;
    createItemButton.hidden = false;
    closeNavigator();
  });
});

document.querySelectorAll("[data-sort-group]").forEach((button) => {
  button.addEventListener("click", () => {
    const sorting = button
      .closest(".navigator-group")
      .classList.toggle("is-sorting");
    button.setAttribute("aria-pressed", String(sorting));
    button.setAttribute(
      "title",
      sorting ? "完成排序" : button.getAttribute("aria-label"),
    );
  });
});

document.querySelectorAll("[data-move]").forEach((button) => {
  button.addEventListener("click", () => {
    const collection = button.closest(".tree-collection");
    const parent = collection.parentElement;
    const collections = Array.from(
      parent.querySelectorAll(":scope > .tree-collection"),
    );
    const index = collections.indexOf(collection);
    if (button.dataset.move === "up" && index > 0) {
      parent.insertBefore(collection, collections[index - 1]);
      showToast("已往上調整（mockup）");
    } else if (
      button.dataset.move === "down" &&
      index < collections.length - 1
    ) {
      parent.insertBefore(collections[index + 1], collection);
      showToast("已往下調整（mockup）");
    }
  });
});

document.querySelectorAll("[data-open-editor]").forEach((button) => {
  button.addEventListener("click", () => {
    const title = button.dataset.itemTitle;
    listView.hidden = true;
    editorView.hidden = false;
    trailSection.textContent = "作品與冊";
    trailDetail.textContent = title;
    editorTitle.textContent = title;
    createItemButton.hidden = true;
    closeNavigator();
  });
});

document.getElementById("backToList").addEventListener("click", () => {
  editorView.hidden = true;
  listView.hidden = false;
  trailSection.textContent = "作品與冊";
  trailDetail.textContent = contentTitle.textContent;
  createItemButton.hidden = false;
});

createItemButton.addEventListener("click", () =>
  showToast(`${createItemButton.textContent.trim()}：正式版沿用既有建立流程`),
);
document
  .querySelectorAll(
    ".navigator-footer button, .editor-heading-actions button, .editor-commandbar button",
  )
  .forEach((button) => {
    button.addEventListener("click", () =>
      showToast(`${button.textContent.trim()}（mockup）`),
    );
  });
