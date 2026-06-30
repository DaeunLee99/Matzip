import { STATIONS, hasKakao } from "./config.js";
import { store, STORE_MODE } from "./store.js";
import {
  loadKakao,
  createMap,
  setMarkers,
  panTo,
  searchPlaces,
  mapCategory,
} from "./kakao.js";

// ── DOM ──────────────────────────────────────────────────────────
const grid = document.getElementById("grid");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const searchEl = document.getElementById("search");
const catFiltersEl = document.getElementById("cat-filters");
const stationFiltersEl = document.getElementById("station-filters");
const mapEl = document.getElementById("map");
const mapHintEl = document.getElementById("map-hint");
const modeBadge = document.getElementById("mode-badge");

// 등록 모달
const openRegisterBtn = document.getElementById("open-register");
const modal = document.getElementById("register-modal");
const closeModalBtn = document.getElementById("close-modal");
const placeSearchInput = document.getElementById("place-search");
const placeSearchBtn = document.getElementById("place-search-btn");
const placeResults = document.getElementById("place-results");
const regForm = document.getElementById("register-form");
const regName = document.getElementById("reg-name");
const regCategory = document.getElementById("reg-category");
const regStation = document.getElementById("reg-station");
const regAddress = document.getElementById("reg-address");
const regMenu = document.getElementById("reg-menu");
const manualHint = document.getElementById("manual-hint");

// ── 상태 ─────────────────────────────────────────────────────────
let restaurants = [];
let activeCat = "all";
let activeStation = "all";
let query = "";
let map = null;
let kakaoReady = false;
let pending = null; // 등록 폼에 채워질 좌표/링크

// ── 별점 위젯 ────────────────────────────────────────────────────
function starsHTML(id, my) {
  let s = `<div class="stars" data-id="${id}" role="group" aria-label="별점 매기기">`;
  for (let i = 1; i <= 5; i++) {
    s += `<button class="star ${i <= my ? "on" : ""}" data-val="${i}" aria-label="${i}점">★</button>`;
  }
  s += `</div>`;
  return s;
}

function cardHTML(r) {
  const avg = r.ratingCount > 0 ? r.ratingAvg.toFixed(1) : "–";
  const kakaoLink = r.kakaoUrl
    ? `<a class="kakao-link" href="${r.kakaoUrl}" target="_blank" rel="noopener">카카오맵 ↗</a>`
    : "";
  return `
    <li class="card">
      <div class="card-top">
        <h3>${r.name}</h3>
        <span class="cat-tag">${r.category}</span>
      </div>
      <p class="menu">${r.menu || r.address || ""}</p>
      <div class="meta">
        <span class="rating">★ ${avg}</span>
        <span class="count-tag">사용자 ${r.ratingCount}명</span>
        <span class="station-tag">🚇 ${r.station}</span>
      </div>
      <div class="rate-row">
        <span class="rate-label">${r.myRating ? "내 별점" : "별점 주기"}</span>
        ${starsHTML(r.id, r.myRating)}
        ${kakaoLink}
      </div>
    </li>`;
}

function visibleList() {
  const q = query.trim().toLowerCase();
  return restaurants.filter((r) => {
    const matchCat = activeCat === "all" || r.category === activeCat;
    const matchStation = activeStation === "all" || r.station === activeStation;
    const matchQuery =
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.menu || "").toLowerCase().includes(q);
    return matchCat && matchStation && matchQuery;
  });
}

function render() {
  const list = visibleList();
  grid.innerHTML = list.map(cardHTML).join("");
  countEl.textContent = `총 ${list.length}곳`;
  emptyEl.hidden = list.length > 0;
  if (kakaoReady && map) {
    setMarkers(map, list, (r) => panTo(map, r));
  }
}

async function reload() {
  restaurants = await store.listRestaurants();
  render();
}

// ── 필터 / 검색 이벤트 ───────────────────────────────────────────
catFiltersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  catFiltersEl.querySelector(".chip.active")?.classList.remove("active");
  btn.classList.add("active");
  activeCat = btn.dataset.cat;
  render();
});

stationFiltersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  stationFiltersEl.querySelector(".chip.active")?.classList.remove("active");
  btn.classList.add("active");
  activeStation = btn.dataset.station;
  render();
  // 지도 중심을 선택한 역으로 이동
  if (kakaoReady && map && STATIONS[activeStation]) {
    const c = STATIONS[activeStation];
    map.panTo(new window.kakao.maps.LatLng(c.lat, c.lng));
  }
});

searchEl.addEventListener("input", (e) => {
  query = e.target.value;
  render();
});

// 별점 클릭 (이벤트 위임)
grid.addEventListener("click", async (e) => {
  const star = e.target.closest(".star");
  if (!star) return;
  const wrap = star.closest(".stars");
  const id = wrap.dataset.id;
  let val = Number(star.dataset.val);
  const current = restaurants.find((r) => r.id === id)?.myRating || 0;
  // 같은 별을 다시 누르면 취소
  if (val === current) val = 0;
  await store.rateRestaurant(id, val);
  await reload();
});

// ── 등록 모달 ────────────────────────────────────────────────────
function openModal() {
  modal.hidden = false;
  resetForm();
  if (hasKakao) {
    manualHint.hidden = true;
    document.getElementById("place-search-box").hidden = false;
    placeSearchInput.focus();
  } else {
    // 카카오 키가 없으면 장소 검색 불가 → 수동 입력 안내
    manualHint.hidden = false;
    document.getElementById("place-search-box").hidden = true;
    regName.focus();
  }
}
function closeModal() {
  modal.hidden = true;
}
function resetForm() {
  regForm.reset();
  placeResults.innerHTML = "";
  pending = null;
}

openRegisterBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

async function runPlaceSearch() {
  const kw = placeSearchInput.value.trim();
  if (!kw) return;
  placeResults.innerHTML = `<li class="ph">검색 중…</li>`;
  const center =
    activeStation !== "all" ? STATIONS[activeStation] : STATIONS["뚝섬역"];
  try {
    const data = await searchPlaces(kw, center);
    if (!data.length) {
      placeResults.innerHTML = `<li class="ph">결과가 없어요.</li>`;
      return;
    }
    placeResults.innerHTML = data
      .slice(0, 10)
      .map(
        (p, i) => `
        <li class="place" data-i="${i}">
          <strong>${p.place_name}</strong>
          <span>${p.road_address_name || p.address_name || ""}</span>
          <em>${p.category_name || ""}</em>
        </li>`
      )
      .join("");
    placeResults._data = data;
  } catch {
    placeResults.innerHTML = `<li class="ph">검색에 실패했어요. 잠시 후 다시 시도해 주세요.</li>`;
  }
}

placeSearchBtn.addEventListener("click", runPlaceSearch);
placeSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    runPlaceSearch();
  }
});

// 검색 결과 선택 → 폼 자동 채움
placeResults.addEventListener("click", (e) => {
  const li = e.target.closest(".place");
  if (!li) return;
  const p = placeResults._data[Number(li.dataset.i)];
  regName.value = p.place_name;
  regAddress.value = p.road_address_name || p.address_name || "";
  regCategory.value = mapCategory(p.category_name);
  regMenu.value = p.category_name?.split(">").pop()?.trim() || "";
  // 가까운 역 자동 선택
  const lat = Number(p.y);
  const lng = Number(p.x);
  regStation.value = nearestStation(lat, lng);
  pending = { lat, lng, kakaoUrl: p.place_url || "" };
  placeResults.querySelectorAll(".place").forEach((el) => el.classList.remove("sel"));
  li.classList.add("sel");
});

function nearestStation(lat, lng) {
  let best = "뚝섬역";
  let bestD = Infinity;
  for (const [name, c] of Object.entries(STATIONS)) {
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

regForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = {
    name: regName.value.trim(),
    category: regCategory.value,
    station: regStation.value,
    address: regAddress.value.trim(),
    menu: regMenu.value.trim(),
    lat: pending?.lat || STATIONS[regStation.value].lat,
    lng: pending?.lng || STATIONS[regStation.value].lng,
    kakaoUrl: pending?.kakaoUrl || "",
  };
  if (!data.name) {
    regName.focus();
    return;
  }
  await store.addRestaurant(data);
  closeModal();
  await reload();
});

// ── 초기화 ───────────────────────────────────────────────────────
async function init() {
  // 모드 배지
  if (STORE_MODE === "firebase") {
    modeBadge.textContent = "공유 모드";
    modeBadge.classList.add("live");
  } else {
    modeBadge.textContent = "데모 모드 (이 브라우저에만 저장)";
  }

  await reload();

  // 카카오 지도
  kakaoReady = await loadKakao();
  if (kakaoReady) {
    mapHintEl.hidden = true;
    map = createMap(mapEl, STATIONS["뚝섬역"]);
    render(); // 마커 표시
  } else {
    mapEl.hidden = true;
    mapHintEl.hidden = false;
  }
}

init();
