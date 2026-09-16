const body = document.body;
const dialogs = [...document.querySelectorAll(".dialog")];
const toast = document.querySelector(".toast");

function updateMascots() {
  document.querySelectorAll("[data-mascot]").forEach((image) => {
    image.src = `https://cdn.faryne.dev/steamloom_assets/suosuo-${image.dataset.mascot}-${body.dataset.appearance}-512.png`;
  });
}

function showDialog(id) {
  dialogs.forEach((dialog) => dialog.hidden = dialog.id !== id);
  document.querySelectorAll("[data-dialog]").forEach((button) => button.classList.toggle("active", button.dataset.dialog === id));
}

document.querySelectorAll("[data-dialog]").forEach((button) => button.addEventListener("click", () => showDialog(button.dataset.dialog)));
document.querySelectorAll("[data-set-view]").forEach((button) => button.addEventListener("click", () => {
  body.dataset.view = button.dataset.setView;
  document.querySelectorAll("[data-set-view]").forEach((item) => item.classList.toggle("active", item === button));
}));
document.querySelector("#appearance").addEventListener("change", (event) => {
  body.dataset.appearance = event.target.value;
  updateMascots();
});

const confirmation = document.querySelector("#confirm-name");
const deleteAction = document.querySelector("#delete-action");
confirmation.addEventListener("input", () => deleteAction.disabled = confirmation.value.trim() !== "霧港殘響");
deleteAction.addEventListener("click", () => {
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
});
document.querySelectorAll("[data-close], .close").forEach((button) => button.addEventListener("click", () => {
  toast.textContent = "Demo：正式版本會關閉 Dialog。";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2000);
}));

updateMascots();
