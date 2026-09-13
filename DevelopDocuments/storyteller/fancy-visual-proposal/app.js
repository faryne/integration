const body = document.body;
const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const views = [...document.querySelectorAll("[data-view]")];
const toneButtons = [...document.querySelectorAll("[data-tone-target]")];
const drawer = document.querySelector(".mobile-drawer");
const drawerTrigger = document.querySelector(".mobile-navigator-trigger");

const activateView = (name) => {
  viewButtons.forEach((button) => {
    const isActive = button.dataset.viewTarget === name;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  views.forEach((view) =>
    view.classList.toggle("is-active", view.dataset.view === name),
  );
};

viewButtons.forEach((button) =>
  button.addEventListener("click", () =>
    activateView(button.dataset.viewTarget),
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
