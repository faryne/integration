const body = document.body;
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const views = [...document.querySelectorAll("[data-view]")];
const toneButtons = [...document.querySelectorAll("[data-tone-target]")];
const drawer = document.querySelector(".mobile-drawer");
const drawerTrigger = document.querySelector(".mobile-navigator-trigger");
const heroTitle = document.querySelector("[data-hero-title]");
const heroAccent = document.querySelector("[data-hero-accent]");
const heroLead = document.querySelector("[data-hero-lead]");
const contentButtons = [...document.querySelectorAll("[data-content-target]")];
const contentPanels = [...document.querySelectorAll("[data-content]")];
const layoutButtons = [...document.querySelectorAll("[data-layout-target]")];
const workspaceTitle = document.querySelector("[data-workspace-title]");
const workspaceKicker = document.querySelector("[data-workspace-kicker]");
const workspaceSection = document.querySelector("[data-workspace-section]");
const readerContext = document.querySelector(".reader-context-bar");
const readerHero = document.querySelector(".reader-hero");
const siteHeader = document.querySelector(".site-header");

const heroCopies = [
  {
    title: "讓故事像織物一樣，",
    accent: "留下手感。",
    lead: "從第一句到完整世界觀，SteamLoom 將創作、閱讀與 AI 協作編進同一張布。",
  },
  {
    title: "你負責讓角色活著，",
    accent: "其餘交給工房。",
    lead: "寫作、設定、資產與閱讀不再散落各處，每條創作線索都能回到同一個故事裡。",
  },
  {
    title: "故事不只需要完成，",
    accent: "還需要被看見。",
    lead: "從私人草稿到公開連載，在不打斷創作節奏的地方整理、發表，然後繼續寫下去。",
  },
  {
    title: "世界觀越長越大，",
    accent: "靈感依然有跡可循。",
    lead: "把人物、場景、章節與素材織成可以追溯的關係，讓下一次靈感不用從空白開始。",
  },
];

const contentMeta = {
  stories: {
    title: "全部作品",
    kicker: "STORIES / 11 ITEMS",
    section: "作品",
    defaultLayout: "list",
  },
  settings: {
    title: "全部設定",
    kicker: "LORE / 18 ITEMS",
    section: "設定",
    defaultLayout: "grid",
  },
  assets: {
    title: "全部資產",
    kicker: "ASSETS / 23 ITEMS",
    section: "資產",
    defaultLayout: "grid",
  },
};

const layoutByContent = Object.fromEntries(
  Object.entries(contentMeta).map(([name, meta]) => [name, meta.defaultLayout]),
);
let activeContent = "stories";
let previousCopyIndex = -1;

const randomizeHeroCopy = () => {
  let nextIndex = Math.floor(Math.random() * heroCopies.length);
  if (heroCopies.length > 1 && nextIndex === previousCopyIndex)
    nextIndex = (nextIndex + 1) % heroCopies.length;

  const copy = heroCopies[nextIndex];
  heroTitle.textContent = copy.title;
  heroAccent.textContent = copy.accent;
  heroLead.textContent = copy.lead;
  previousCopyIndex = nextIndex;
};

const updateReaderContext = () => {
  const readerIsActive = document.querySelector(
    '[data-view="reader"].is-active',
  );
  readerContext?.classList.toggle(
    "is-visible",
    Boolean(
      readerIsActive &&
      readerHero &&
      readerHero.getBoundingClientRect().bottom <= 52,
    ),
  );
  siteHeader?.classList.toggle(
    "has-reader-context",
    readerContext?.classList.contains("is-visible"),
  );
};

window.addEventListener("scroll", updateReaderContext, { passive: true });

const activateLayout = (layout) => {
  const collection = document.querySelector(
    `[data-content="${activeContent}"] [data-collection]`,
  );
  collection.classList.toggle("is-list", layout === "list");
  collection.classList.toggle("is-grid", layout === "grid");
  layoutByContent[activeContent] = layout;
  layoutButtons.forEach((button) => {
    const isActive = button.dataset.layoutTarget === layout;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const activateContent = (name) => {
  activeContent = name;
  contentPanels.forEach((panel) =>
    panel.classList.toggle("is-active", panel.dataset.content === name),
  );
  contentButtons.forEach((button) => {
    const isActive = button.dataset.contentTarget === name;
    button.classList.toggle("is-active", isActive);
    if (button.matches("button"))
      button.setAttribute("aria-pressed", String(isActive));
  });
  workspaceTitle.textContent = contentMeta[name].title;
  workspaceKicker.textContent = contentMeta[name].kicker;
  workspaceSection.textContent = contentMeta[name].section;
  activateLayout(layoutByContent[name]);
};

const activateView = (name) => {
  viewButtons.forEach((button) => {
    const isActive = button.dataset.viewTarget === name;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  views.forEach((view) =>
    view.classList.toggle("is-active", view.dataset.view === name),
  );
  updateReaderContext();
};

viewButtons.forEach((button) =>
  button.addEventListener("click", () =>
    activateView(button.dataset.viewTarget),
  ),
);

randomizeHeroCopy();

contentButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    activateContent(button.dataset.contentTarget);
  });
});

layoutButtons.forEach((button) =>
  button.addEventListener("click", () =>
    activateLayout(button.dataset.layoutTarget),
  ),
);

toneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    body.dataset.tone = button.dataset.toneTarget;
    toneButtons.forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
  });
});

const setDrawerOpen = (isOpen) => {
  drawer.classList.toggle("is-open", isOpen);
  drawer.setAttribute("aria-hidden", String(!isOpen));
  drawerTrigger?.setAttribute("aria-expanded", String(isOpen));
  body.classList.toggle("drawer-open", isOpen);
};

drawerTrigger?.addEventListener("click", () => setDrawerOpen(true));
drawer
  .querySelectorAll("[data-close-drawer]")
  .forEach((button) =>
    button.addEventListener("click", () => setDrawerOpen(false)),
  );
document.addEventListener(
  "keydown",
  (event) => event.key === "Escape" && setDrawerOpen(false),
);
