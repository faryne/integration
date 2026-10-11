// Mockup 互動：只切換畫面／分頁／狀態，不接任何 API
const body = document.body;
const $ = (s) => document.querySelector(s);

// 同步 mockup 控制面板上按鈕的選取狀態
const syncMock = () => {
  document.querySelectorAll(".mock [data-go]").forEach((b) => b.classList.toggle("on", b.dataset.go === body.dataset.screen));
  document.querySelectorAll(".mock [data-toggle]").forEach((b) => b.classList.toggle("on", body.classList.contains(b.dataset.toggle)));
};

// 每個 data-action 對應的行為
const actions = {
  // OAuth：模擬開瀏覽器授權 → 授權完成後跳到專案列表
  "login-start": () => {
    $("#login-card").dataset.state = "waiting";
    actions.loginTimer = setTimeout(() => { $("#login-card").dataset.state = ""; go("projects"); }, 1800);
  },
  "login-cancel": () => { clearTimeout(actions.loginTimer); $("#login-card").dataset.state = ""; },
  "engine-toggle": () => $("#engine").classList.toggle("open"),
  "engine-pick": (el) => { $("#engine-name").textContent = el.dataset.name; $("#engine").classList.remove("open"); },
  send: () => { body.classList.add("running"); syncMock(); },
  stop: () => { body.classList.remove("running"); syncMock(); },
  diff: () => tab("history"),
  revert: () => $("#confirm").classList.add("show"),
  "confirm-close": () => $("#confirm").classList.remove("show"),
  "keep-mine": () => { body.classList.remove("conflict"); syncMock(); },
  "reload-latest": () => { body.classList.remove("conflict"); syncMock(); },
  "new-chat": () => {},
  snack: () => { $("#snack").classList.add("show"); clearTimeout(actions.snackTimer); actions.snackTimer = setTimeout(actions["snack-close"], 5000); },
  "snack-close": () => $("#snack").classList.remove("show"),
};

const go = (screen) => { body.dataset.screen = screen; syncMock(); };
const tab = (name) => { body.dataset.tab = name; };

// 事件委派：data-go 切畫面、data-tab-go 切分頁、data-toggle 切狀態、data-action 執行動作
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-go],[data-tab-go],[data-toggle],[data-action]");
  if (!el?.closest(".engine")) $("#engine").classList.remove("open");
  if (!el) return;
  if (el.dataset.go) go(el.dataset.go);
  else if (el.dataset.tabGo) tab(el.dataset.tabGo);
  else if (el.dataset.toggle) { body.classList.toggle(el.dataset.toggle); syncMock(); }
  else actions[el.dataset.action]?.(el);
});

syncMock();
