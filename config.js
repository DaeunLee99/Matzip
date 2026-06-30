// ────────────────────────────────────────────────────────────────
// Matzip 설정 파일
//
// 아래 키를 채우면 "실제 공유 모드"(카카오 지도 + Firebase)로 동작하고,
// 비워두면 "데모 모드"(브라우저 localStorage)로 동작합니다.
//
// 두 키 모두 클라이언트(브라우저)에 노출되는 공개 키라 코드에 넣어도 됩니다.
// 대신 카카오/Firebase 콘솔에서 "허용 도메인"과 "보안 규칙"으로 보호하세요.
// ────────────────────────────────────────────────────────────────

export const CONFIG = {
  // 카카오 JavaScript 키
  //   https://developers.kakao.com → 내 애플리케이션 → 앱 키 → "JavaScript 키"
  //   앱 설정 → 플랫폼 → Web → 사이트 도메인에 배포 주소를 등록해야 합니다.
  kakaoJsKey: "",

  // Firebase 웹앱 설정
  //   https://console.firebase.google.com → 프로젝트 설정 → 내 앱 → 웹앱(</>)
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
};

// 지도 중심으로 쓰는 역 좌표 (위도/경도)
export const STATIONS = {
  뚝섬역: { lat: 37.547197, lng: 127.047273 },
  성수역: { lat: 37.544577, lng: 127.055961 },
};

export const hasKakao = Boolean(CONFIG.kakaoJsKey);
export const hasFirebase = Boolean(CONFIG.firebase && CONFIG.firebase.projectId);
