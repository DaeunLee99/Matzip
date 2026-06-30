# Matzip 🍜

뚝섬역·성수역 맛집을 **조회 · 등록 · 별점**할 수 있는 웹사이트입니다.
URL만 공유하면 누구나(로그인 없이) 맛집을 등록하고 별점을 매길 수 있어요.

- 🗺️ 카카오 지도 위에 맛집 표시
- 🔎 카카오 공식 API로 가게 검색해서 등록 (이름·주소·카테고리 자동 입력)
- ⭐ 사용자 별점(1~5) — 평균 별점과 참여 인원 표시
- 🚇 역(뚝섬/성수) · 카테고리 · 이름/메뉴 검색 필터

> ※ 네이버/카카오의 "방문자 별점"은 공식 API로 제공되지 않아 표시하지 않습니다.
> 별점은 이 사이트 사용자들이 직접 매긴 값입니다.

## 구성

| 파일 | 설명 |
|------|------|
| `index.html` | 페이지 구조 (지도, 필터, 카드, 등록 모달) |
| `style.css` | 스타일 |
| `config.js` | **카카오 / Firebase 키 설정** |
| `data.js` | 데모 모드 시드 데이터 |
| `kakao.js` | 카카오 지도 + 장소 검색 래퍼 |
| `store.js` | 데이터 계층 (Firebase ↔ localStorage 자동 전환) |
| `app.js` | UI 로직 |

## 동작 모드

키를 채우지 않아도 **데모 모드**로 바로 실행됩니다.
- **데모 모드**: 데이터가 *이 브라우저에만* 저장됩니다 (localStorage). 혼자 테스트용.
- **공유 모드**: 카카오 + Firebase 키를 넣으면 지도가 뜨고, 등록·별점이 *모든 사용자에게 공유*됩니다.

## 실행 (로컬)

ES 모듈을 쓰므로 `file://`로 열면 안 되고 로컬 서버가 필요합니다.

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 공유 모드 설정 (1회)

`config.js`를 열어 두 키를 채웁니다.

### 1. 카카오 JavaScript 키
1. <https://developers.kakao.com> → 내 애플리케이션 → 애플리케이션 추가
2. **앱 키 → JavaScript 키**를 `config.js`의 `kakaoJsKey`에 입력
3. **앱 설정 → 플랫폼 → Web → 사이트 도메인**에 배포 주소 등록
   (로컬 테스트는 `http://localhost:8000`도 추가)

### 2. Firebase
1. <https://console.firebase.google.com> → 프로젝트 만들기
2. **빌드 → Firestore Database → 데이터베이스 만들기** (프로덕션 모드)
3. **프로젝트 설정 → 내 앱 → 웹앱(</>) 추가** → 표시되는 설정값을
   `config.js`의 `firebase`에 입력
4. **Firestore 규칙**을 아래처럼 설정 (로그인 없이 읽기/쓰기 허용,
   대신 데이터 형태를 검증):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /restaurants/{id} {
      allow read: if true;
      allow create: if request.resource.data.name is string
                    && request.resource.data.ratingSum == 0
                    && request.resource.data.ratingCount == 0;
      // 별점 집계 업데이트만 허용
      allow update: if request.resource.data.name == resource.data.name;

      match /ratings/{userId} {
        allow read: if true;
        allow write: if request.resource.data.stars >= 1
                     && request.resource.data.stars <= 5;
        allow delete: if true;
      }
    }
  }
}
```

> 로그인이 없으므로 누구나 쓸 수 있습니다. 악용이 걱정되면 나중에
> 간단 로그인(구글/카카오)을 붙여 `request.auth`로 제한할 수 있어요.

## 배포

정적 사이트라 **GitHub Pages**로 바로 배포할 수 있습니다.
Settings → Pages → Branch 선택 → 저장. 발급된 URL을 공유하면 끝.
(카카오 콘솔의 사이트 도메인에 그 URL을 꼭 등록하세요.)
