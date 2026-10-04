# Google Play 등록용 이미지

2026-10-03 등록정보와 이미지 생성 스크립트 갱신. 메시지는 "강의는 요약으로. 복습은 문제로."이며, 실제 자료 정리와 복습 흐름을 먼저 보여줘요.
이 폴더의 변경과 AAB 빌드만으로 Play 등록정보가 바뀌지는 않아요. 콘솔에 이미지와 새 릴리스를 각각 제출해야 해요.
이미지가 실제로 생성된 시각과 앱 버전은 `assets-manifest.json`에서 확인해요. 스크립트 수정 시각만으로 이미지가 갱신됐다고 판단하지 않아요.

## 제출할 파일

| 파일 | 크기 | 용도 |
| --- | --- | --- |
| `app-icon-512.png` | 512×512 | Play 등록 아이콘. `assets/brand/app-icon.png`를 그대로 축소해요. |
| `feature-graphic.png` | 1024×500 | 워드마크, 핵심 가치 문구, 실제 요약 화면 |
| `screenshots/framed/01-home.png` | 1080×1920 | 쌓여 있던 강의를 복습할 자료로 |
| `screenshots/framed/02-material-summary.png` | 1080×1920 | 긴 강의도 핵심부터 읽어요 |
| `screenshots/framed/03-material-mindmap.png` | 1080×1920 | 개념 사이의 연결이 한눈에 보여요 |
| `screenshots/framed/04-chat.png` | 1080×1920 | 헷갈릴 때는 내 자료에 물어봐요 |
| `screenshots/framed/05-mastery.png` | 1080×1920 | 읽고 끝내지 말고 문제로 확인해요 |
| `screenshots/framed/06-lens.png` | 1080×1920 | 발표하기 전에 한 번 더 연습해요 |
| `screenshots/framed/07-report.png` | 1080×1920 | 무엇을 고칠지 근거와 함께 봐요 |
| `screenshots/framed/09-interview.png` | 1080×1920 | 면접 답변도 말하면서 다듬어요 |

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
흰 바탕, 잉크색 글자, 주황색 포인트와 Pretendard는 앱 디자인 시스템을 따라요.
제출 전 8장 모두를 열어 제목 줄바꿈, 하단 잘림, 실제 기능과 문구의 일치를 확인해요.

## Android 업데이트

앱 버전과 Android `versionCode`는 `app.json`을 기준으로 확인해요.
Play Console에서 이미 사용한 값보다 큰 `versionCode`로 서명된 AAB를 제출해야 해요.
화면 수정과 아이콘 변경을 포함한 빌드를 확인한 뒤 이 스크립트로 이미지를 다시 만들어요.
스토어 아이콘, 그래픽 이미지, 스크린샷 8장과 `listing-ko.md`의 설명은 기본 스토어 등록정보에 별도로 반영해요.
이미지의 캡처 버전과 제출할 앱의 화면이 일치하는지 확인하고, 이전 버전의 이미지 묶음을 새 등록정보로 올리지 않아요.
Play 업로드 인증과 실제 출시 상태는 로컬 빌드 성공만으로 확인할 수 없어요.
