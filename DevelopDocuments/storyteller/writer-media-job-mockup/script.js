const dialog = document.querySelector("#job");
document.querySelector("[data-dialog='job']").addEventListener("click", () => dialog.showModal());
document.querySelector("#generate").addEventListener("click", (event) => {
  event.preventDefault();
  if (!dialog.querySelector("form").reportValidity()) return;
  dialog.close();
  document.querySelector("#progress").classList.remove("hidden");
  setTimeout(() => document.querySelector("#result").classList.remove("hidden"), 600);
});
