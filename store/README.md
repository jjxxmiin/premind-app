# Google Play 등록용 이미지

2026-10-01 갱신. 앱의 새 연필 쥔 P 심볼과 현재 홈, 복습, 추가, 연습, MY 화면을 기준으로 만들었어요.
이 폴더의 변경과 AAB 빌드만으로 Play 등록정보가 바뀌지는 않아요. 콘솔에 이미지와 새 릴리스를 각각 제출해야 해요.

## 제출할 파일

| 파일 | 크기 | 용도 |
| --- | --- | --- |
| `app-icon-512.png` | 512×512 | Play 등록 아이콘. `assets/brand/app-icon.png`를 그대로 축소해요. |
| `feature-graphic.png` | 1024×500 | 새 심볼, 워드마크와 제품 설명을 넣은 그래픽 이미지 |
| `screenshots/framed/01-home.png` | 1080×1920 | 내 자료를 한곳에 |
| `screenshots/framed/02-material-summary.png` | 1080×1920 | 핵심만 담은 요약 |
| `screenshots/framed/03-material-mindmap.png` | 1080×1920 | 한눈에 보는 마인드맵 |
| `screenshots/framed/04-chat.png` | 1080×1920 | 내 자료를 근거로 질문 |
| `screenshots/framed/05-mastery.png` | 1080×1920 | 다시 볼 곳을 찾아 복습 |
| `screenshots/framed/06-lens.png` | 1080×1920 | 발표를 연습하고 평가 |
| `screenshots/framed/07-report.png` | 1080×1920 | 근거와 함께 보는 피드백 |
| `screenshots/framed/09-interview.png` | 1080×1920 | 면접도 차근차근 연습 |

위 8장을 순서대로 사용해요. 프레임 없는 원본은 `screenshots/`에 있어요.
`08-record.png`도 현재 화면으로 갱신하지만, 브라우저 전용 녹음 안내가 있어 **Play 제출 목록에서 제외**했어요.
캡처는 같은 Expo 소스의 한국어 웹 데모(360×640, 3배 배율)이며 실제 Android 기기 캡처는 아니에요.
현재 스토어 설명은 `listing-ko.md`, 생성 정보와 정확한 제출 파일 목록은 `assets-manifest.json`에 있어요.

## 다시 생성하기

```bash
npm ci
npx playwright install chromium
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL= EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB= EXPO_PUBLIC_ENABLE_KAKAO_AUTH=false npx expo export --platform web --clear --output-dir dist/store-preview
PREMIND_PREVIEW_ROOT=dist/store-preview PREMIND_PREVIEW_PORT=18197 npm run preview:web
```

다른 터미널에서 실행해요.

```bash
node scripts/refresh-store-assets.mjs
```

이미 설치된 Chrome을 쓰려면 `PREMIND_CHROMIUM_PATH`에 실행 파일 경로를 지정해요.
다른 로컬 포트는 `PREMIND_STORE_PREVIEW_URL`로 지정할 수 있어요.
스크립트는 새 브라우저 프로필에서 데모에 로그인하고 API 요청을 차단해요.
앱 화면을 실제로 캡처하며, 로고를 새로 그리지 않고 원본을 사용해요.

## Android 업데이트

이번 소스 버전은 `1.0.3`, Android `versionCode 6`예요.
서명된 제출 파일은 `dist/android/premind-1.0.3-release.aab`, 설치 확인용은 같은 폴더의 `.apk`예요.
이 버전은 구글/카카오 로그인 버튼을 실제 텍스트와 SVG 아이콘을 사용하는 공통 컴포넌트로 교체했어요.
기존 `1.0.2` AAB에는 이 수정이 없으므로 새 AAB를 제출해야 해요.
Play Console에서 현재 사용된 versionCode를 확인하고, 6이 이미 사용됐다면 더 큰 값으로 다시 빌드해야 해요.
스토어 아이콘과 스크린샷은 기본 스토어 등록정보에 별도로 올려야 해요.
제출용 8장에는 로그인 화면이 없어, 이번 버튼 수정 때문에 이미지를 다시 만들 필요는 없어요.
`premind-1.0.3-play-assets.zip`은 기존 최신 이미지에 이 버전의 안내를 함께 묶은 파일이에요.
이미 새 아이콘과 이미지를 등록했다면 재업로드는 필요 없고, 아직 옛 이미지라면 이 묶음으로 교체하세요.
Play 업로드 인증과 실제 출시 상태는 로컬 빌드 성공만으로 확인할 수 없어요.
