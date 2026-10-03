# PREMIND 1.0.3 배포 인계

Android versionCode: **6**. 기존 1.0.2/versionCode 5 AAB 대신 새 파일을 제출합니다.

## Android / Play

- `dist/android/premind-1.0.3-release.aab`: Play 제출용, 운영 API 및 구글/카카오 로그인 설정 포함.
- `dist/android/premind-1.0.3-release.apk`: 기기 설치 확인용.
- `dist/android/premind-1.0.3-play-assets.zip`: 최신 아이콘, 그래픽 이미지, 스크린샷 8장, 등록정보 안내.
- 버튼은 공통 컴포넌트, 실제 텍스트, SVG 아이콘으로 변경했습니다. 문구는 **카카오 로그인 / 구글 로그인**입니다.
- 제출 이미지에는 로그인 화면이 없습니다. 1.0.2 준비 때 만든 최신 이미지와 픽셀은 동일합니다. 이미 이 이미지를 등록했다면 다시 올릴 필요는 없습니다. 스토어가 옛 이미지라면 ZIP의 이미지로 교체합니다.
- Play 콘솔에서 versionCode 6 미사용 여부를 확인합니다. 로컬에서는 Play 출시/심사 상태를 확인하지 못했습니다.
- 실제 계정을 사용하는 Android 로그인과 결제 검증은 별도로 진행해야 합니다.

권장 출시 노트:

> 앱 아이콘과 화면 이미지를 업데이트했어요. 구글 로그인과 카카오 로그인 버튼을 더 선명하고 일관되게 개선했어요.

## 웹 — 반드시 API와 함께 배포

웹 산출물: `dist/web-production/`, ZIP: `dist/android/premind-1.0.3-web.zip`.
이 ZIP의 내용을 기존 학생 웹의 `/app` 정적 파일 루트에 배포합니다.
`oauth/kakao.html`도 빠짐없이 포함해야 합니다.

재빌드:

```bash
npm run export:web:production
```

새 스크립트는 `.env`의 공개 소셜 설정만 읽고 운영 API 및 `/app` 경로를 명시합니다.
후속 요청(학생 쪽 업데이트)에 따라 `../premind/docs/ops-build-student-web.sh`도 이 exporter로 연결했습니다.
학생 웹 운영 배포는 기존대로 `../premind/docs/ops-deploy-student-web.sh`가 담당합니다.

### 출시 전 필요한 외부 설정

1. **Google Cloud Console**의 해당 웹 OAuth 클라이언트에서 승인된 리디렉션 URI에
   `https://premind.co.kr/app/login`을 추가합니다. 승인된 자바스크립트 원본은 `https://premind.co.kr`입니다.
   2026-10-01 실제 Google 인증 화면 확인 결과 이 리디렉션은 `redirect_uri_mismatch`로 거절되었습니다.
   콘솔 변경 전에는 웹 구글 로그인이 완료되지 않습니다. Android 네이티브 구글 로그인과는 별도 설정입니다.
2. **recorder API**를 웹 카카오 지원 버전으로 배포합니다. 변경된 로컬 소스는
   `../premind-recorder-api/app/auth/kakao_flow.py`, `app/auth/routes.py`이며 테스트도 함께 추가했습니다.
   전달용 패치는 `dist/android/premind-1.0.3-web-auth-backend.patch`입니다.
   배포할 서버 체크아웃에서 먼저 `git apply --check`로 적용 가능 여부를 확인하고,
   기존 API 배포 절차로 빌드/재시작합니다. 운영 환경변수와 DB는 그대로 유지합니다.
3. API `GET https://api.premind.co.kr/api/auth/providers`에서 `kakao_web_code_flow: true`를 확인합니다.
   그 전에는 웹 카카오 버튼이 의도적으로 숨겨집니다. 앱 카카오는 기존 기능을 유지합니다.
4. 웹 정적 파일을 배포하고 캐시를 갱신합니다. `/app/login`에서 두 버튼과 한국어 문구를 확인합니다.
5. 실제 구글/카카오 계정으로 로그인, 취소, 재로그인을 확인합니다.

카카오가 직접 돌아오는 주소는 기존 API의 `/api/auth/oauth/kakao/callback`입니다.
새 웹 주소를 카카오 개발자 콘솔에 임의로 추가할 필요는 없습니다. API가 검증한 state의
platform에 따라 앱 또는 고정된 `https://premind.co.kr/app/oauth/kakao.html`로만 보냅니다.
브라우저가 보낸 임의 복귀 주소는 허용하지 않습니다.

## 검증 범위

- 앱 TypeScript/ESLint 및 전체 Jest 테스트.
- API 카카오/구글 관련 테스트(실제 OAuth 제공자 응답은 mock).
- Chromium에서 실제 웹 export의 두 버튼 → 팝업 → callback → 토큰 교환 요청 확인.
  이 테스트는 제공자/API 응답을 mock하며, 실계정 인증 성공을 의미하지 않습니다.
- `scripts/smoke-web-social.mjs`: 위 브라우저 검증을 재현합니다.
- Android APK/AAB 서명과 버전, 운영 API 및 로그인 설정 포함 여부.

Play 업로드는 아직 수행하지 않았습니다. 후속 학생 웹 운영 배포 기록은
`../premind/docs/student-web-social-release-20261001.md`에 남깁니다.
