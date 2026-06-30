const grid = document.getElementById("grid");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const filtersEl = document.getElementById("filters");

let activeCat = "all";
let query = "";

function cardHTML(r) {
  return `
    <li class="card">
      <div class="card-top">
        <h3>${r.name}</h3>
        <span class="cat-tag">${r.category}</span>
      </div>
      <p class="menu">${r.menu}</p>
      <div class="meta">
        <span class="rating">★ ${r.rating.toFixed(1)}</span>
        <span class="price">${r.price}</span>
        <span class="walk">🚶 도보 ${r.walk}분</span>
      </div>
    </li>`;
}

function render() {
  const q = query.trim().toLowerCase();
  const list = RESTAURANTS.filter((r) => {
    const matchCat = activeCat === "all" || r.category === activeCat;
    const matchQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.menu.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  grid.innerHTML = list.map(cardHTML).join("");
  countEl.textContent = `총 ${list.length}곳`;
  emptyEl.hidden = list.length > 0;
}

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  filtersEl.querySelector(".chip.active")?.classList.remove("active");
  btn.classList.add("active");
  activeCat = btn.dataset.cat;
  render();
});

searchEl.addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

render();
