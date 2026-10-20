const rows = document.querySelector("#loraRows");
const template = document.querySelector("#loraTemplate");
const add = () => {
  if (rows.children.length >= 5) return;
  const row = template.content.firstElementChild.cloneNode(true);
  row.querySelector(".remove").addEventListener("click", () => row.remove());
  rows.append(row);
};
document.querySelector("#addLora").addEventListener("click", add);
const runs = document.querySelector("#runs");
runs.addEventListener("input", () => {
  const value = Math.min(10, Math.max(1, Number(runs.value) || 1));
  document.querySelector("#summary").textContent = `將執行 ${value} 個 job，最多產生 ${value * 4} 張候選結果。`;
});
add();
