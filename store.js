// ────────────────────────────────────────────────────────────────
// 데이터 계층(store)
//
// 같은 API를 두 가지 방식으로 구현합니다.
//   - FirebaseStore   : Firebase Firestore (여러 사용자가 실시간 공유)
//   - LocalStore      : 브라우저 localStorage (데모 / 키 없이 동작)
//
// config.js 에 Firebase 설정이 있으면 FirebaseStore, 없으면 LocalStore.
//
// 공통 API:
//   listRestaurants()              → [{ id, name, ... , ratingAvg, ratingCount, myRating }]
//   addRestaurant(data)            → 새 맛집 추가
//   rateRestaurant(id, stars)      → 별점 등록/수정 (별점 0이면 취소)
// ────────────────────────────────────────────────────────────────

import { CONFIG, hasFirebase } from "./config.js";
import { SEED_RESTAURANTS } from "./data.js";

const ANON_KEY = "matzip_anon_id";
const MY_RATINGS_KEY = "matzip_my_ratings";

// 이 브라우저를 식별하는 익명 ID (로그인 없이 "내가 매긴 별점"을 추적).
function anonId() {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id =
      "u_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

// 이 브라우저가 매긴 별점 캐시: { [restaurantId]: stars }
function myRatingsMap() {
  try {
    return JSON.parse(localStorage.getItem(MY_RATINGS_KEY)) || {};
  } catch {
    return {};
  }
}
function setMyRating(id, stars) {
  const m = myRatingsMap();
  if (stars > 0) m[id] = stars;
  else delete m[id];
  localStorage.setItem(MY_RATINGS_KEY, JSON.stringify(m));
}

function withDerived(r) {
  const ratingCount = r.ratingCount || 0;
  const ratingAvg = ratingCount > 0 ? r.ratingSum / ratingCount : 0;
  return {
    ...r,
    ratingAvg,
    ratingCount,
    myRating: myRatingsMap()[r.id] || 0,
  };
}

// ── localStorage 구현 ───────────────────────────────────────────
class LocalStore {
  constructor() {
    this.KEY = "matzip_restaurants";
  }
  _read() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.KEY));
      if (Array.isArray(saved)) return saved;
    } catch {
      /* fall through */
    }
    const seeded = SEED_RESTAURANTS.map((r) => ({ ...r }));
    localStorage.setItem(this.KEY, JSON.stringify(seeded));
    return seeded;
  }
  _write(list) {
    localStorage.setItem(this.KEY, JSON.stringify(list));
  }
  async listRestaurants() {
    return this._read().map(withDerived);
  }
  async addRestaurant(data) {
    const list = this._read();
    const r = {
      id: "r_" + Date.now().toString(36),
      ratingSum: 0,
      ratingCount: 0,
      ...data,
    };
    list.unshift(r);
    this._write(list);
    return r.id;
  }
  async rateRestaurant(id, stars) {
    const list = this._read();
    const r = list.find((x) => x.id === id);
    if (!r) return;
    const prev = myRatingsMap()[id] || 0;
    if (prev) {
      r.ratingSum -= prev;
      r.ratingCount -= 1;
    }
    if (stars > 0) {
      r.ratingSum += stars;
      r.ratingCount += 1;
    }
    this._write(list);
    setMyRating(id, stars);
  }
}

// ── Firebase Firestore 구현 ─────────────────────────────────────
class FirebaseStore {
  async _init() {
    if (this._db) return this._db;
    const [{ initializeApp }, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]);
    this.fs = fs;
    const app = initializeApp(CONFIG.firebase);
    this._db = fs.getFirestore(app);
    return this._db;
  }
  async listRestaurants() {
    const db = await this._init();
    const { collection, getDocs, query, orderBy } = this.fs;
    const q = query(
      collection(db, "restaurants"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => withDerived({ id: d.id, ...d.data() }));
  }
  async addRestaurant(data) {
    const db = await this._init();
    const { collection, addDoc, serverTimestamp } = this.fs;
    const ref = await addDoc(collection(db, "restaurants"), {
      ...data,
      ratingSum: 0,
      ratingCount: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }
  async rateRestaurant(id, stars) {
    const db = await this._init();
    const { doc, runTransaction, serverTimestamp } = this.fs;
    const rRef = doc(db, "restaurants", id);
    const myRef = doc(db, "restaurants", id, "ratings", anonId());
    await runTransaction(db, async (tx) => {
      const rSnap = await tx.get(rRef);
      if (!rSnap.exists()) return;
      const mySnap = await tx.get(myRef);
      let sum = rSnap.data().ratingSum || 0;
      let count = rSnap.data().ratingCount || 0;
      if (mySnap.exists()) {
        sum -= mySnap.data().stars;
        count -= 1;
      }
      if (stars > 0) {
        sum += stars;
        count += 1;
        tx.set(myRef, { stars, updatedAt: serverTimestamp() });
      } else {
        tx.delete(myRef);
      }
      tx.update(rRef, { ratingSum: sum, ratingCount: count });
    });
    setMyRating(id, stars);
  }
}

export const store = hasFirebase ? new FirebaseStore() : new LocalStore();
export const STORE_MODE = hasFirebase ? "firebase" : "local";
