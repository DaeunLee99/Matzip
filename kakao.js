// ────────────────────────────────────────────────────────────────
// 카카오 지도 SDK 래퍼
//
// - loadKakao()              : SDK 동적 로드 (키 없으면 false 반환)
// - createMap(el, center)    : 지도 생성
// - setMarkers(map, list)    : 맛집 목록을 마커로 표시 (클릭 콜백 지원)
// - searchPlaces(keyword)    : 카카오 장소(키워드) 검색
// ────────────────────────────────────────────────────────────────

import { CONFIG, hasKakao } from "./config.js";

let loadPromise = null;

export function loadKakao() {
  if (!hasKakao) return Promise.resolve(false);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src =
      "https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&libraries=services&appkey=" +
      CONFIG.kakaoJsKey;
    script.onload = () => window.kakao.maps.load(() => resolve(true));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function createMap(el, center) {
  const { kakao } = window;
  return new kakao.maps.Map(el, {
    center: new kakao.maps.LatLng(center.lat, center.lng),
    level: 4,
  });
}

let markers = [];
export function setMarkers(map, list, onClick) {
  const { kakao } = window;
  markers.forEach((m) => m.setMap(null));
  markers = [];
  const bounds = new kakao.maps.LatLngBounds();
  list.forEach((r) => {
    if (!r.lat || !r.lng) return;
    const pos = new kakao.maps.LatLng(r.lat, r.lng);
    const marker = new kakao.maps.Marker({ position: pos, map });
    const label = new kakao.maps.CustomOverlay({
      position: pos,
      yAnchor: 2.3,
      content: `<div class="map-label">${r.name}</div>`,
    });
    label.setMap(map);
    if (onClick) kakao.maps.event.addListener(marker, "click", () => onClick(r));
    markers.push(marker, label);
    bounds.extend(pos);
  });
  if (!list.length) return;
  map.setBounds(bounds);
}

export function panTo(map, r) {
  const { kakao } = window;
  if (!r.lat || !r.lng) return;
  map.panTo(new kakao.maps.LatLng(r.lat, r.lng));
}

// 카카오 키워드 장소 검색. center 좌표 주변을 우선 검색.
export function searchPlaces(keyword, center) {
  return new Promise((resolve, reject) => {
    const { kakao } = window;
    const ps = new kakao.maps.services.Places();
    const opts = {};
    if (center) {
      opts.location = new kakao.maps.LatLng(center.lat, center.lng);
      opts.radius = 1500;
      opts.sort = kakao.maps.services.SortBy.DISTANCE;
    }
    ps.keywordSearch(
      keyword,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) resolve(data);
        else if (status === kakao.maps.services.Status.ZERO_RESULT) resolve([]);
        else reject(new Error("검색 실패"));
      },
      opts
    );
  });
}

// 카카오 카테고리 문자열 → 우리 사이트 카테고리 매핑.
export function mapCategory(categoryName = "") {
  if (categoryName.includes("카페") || categoryName.includes("디저트"))
    return "카페";
  if (categoryName.includes("일식") || categoryName.includes("초밥"))
    return "일식";
  if (
    categoryName.includes("양식") ||
    categoryName.includes("파스타") ||
    categoryName.includes("피자") ||
    categoryName.includes("스테이크")
  )
    return "양식";
  if (
    categoryName.includes("술집") ||
    categoryName.includes("호프") ||
    categoryName.includes("바") ||
    categoryName.includes("포차")
  )
    return "술집";
  return "한식";
}
