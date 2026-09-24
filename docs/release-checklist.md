# 스토어 심사 체크리스트

2026-09-07 기준. 앱 안에서 끝낼 수 있는 항목은 이미 반영했고, 콘솔에서 사람이 입력해야 하는 항목은 "할 일"로 남겼습니다.

**2026-09-07 결정: 이 앱은 인앱 결제를 합니다.** 스탠다드 구독을 Google Play 인앱
결제(RevenueCat 경유)로 앱 안에서 팝니다. 예전의 "앱 안에서는 구독할 수 없다"는
구성은 끝났고, 그에 맞춰 데이터 보안, 콘텐츠 등급, 심사 메모가 모두 바뀝니다.

## 앱 안에서 이미 반영한 것

- 결제: 구독 화면(`src/app/subscription.tsx`)에서 "구독 시작하기"를 누르면 Google Play
  결제 시트가 열립니다. 가격은 스토어가 답한 현지 가격을 그대로 씁니다(앱 안 표에
  적힌 9,900원은 스토어가 답하기 전까지의 대체값일 뿐이라, Play Console에서 가격을
  바꿔도 앱을 다시 올릴 필요가 없습니다).
- Play 정책이 요구하는 문구를 결제 버튼 위에 한 덩어리로 보여 줍니다: 선택한 주기의
  정확한 금액과 결제 주기, 해지 전까지 자동 갱신된다는 사실, "Google Play 구독에서
  언제든 해지할 수 있어요"라는 해지 방법. 문장은 `src/features/billing/purchase-copy.ts`
  에 있고 테스트가 지킵니다.
- "구매 복원"이 항상 보입니다(미구독자는 하단 바, 구독자는 구독 관리 카드).
  이용약관과 개인정보 처리방침 링크도 같은 화면에 있습니다.
- 구독자에게는 지금 요금제, 다음 갱신일, 그리고 Play 구독 페이지를 여는 "구독 관리"
  행을 보여 줍니다(`https://play.google.com/store/account/subscriptions?sku=...&package=kr.co.premind.premind`).
  이 링크는 정책이 요구하는 링크이며 외부 결제 링크가 아닙니다.
- 결제가 끝나면 `POST /api/billing/revenuecat/sync`로 RevenueCat app user id를 서버에
  보내고 `/api/auth/me`를 다시 읽어, 웹훅을 기다리지 않고 요금제와 남은 분량이 바로
  바뀝니다. 서버가 202(아직 반영 전)를 주면 "잠시 걸릴 수 있어요"라고만 말하고
  결제를 실패로 다루지 않습니다.
- 결제 취소(뒤로 가기)는 오류가 아닙니다. 사용자가 결제 시트를 닫으면 화면은 아무
  일도 없었던 것처럼 돌아가고, 카드 거절, 네트워크 오류, 이미 구독 중, 승인 대기는
  각각 다른 문장을 보여 줍니다.
- `configureBilling`에 로그인한 사용자 id를 넘기므로 구독이 기기가 아니라 계정을
  따라갑니다. 재설치하거나 다른 기기에서 로그인해도 구독이 유지됩니다.
- 키가 없는 빌드(Expo Go 포함)에서는 네이티브 모듈을 아예 불러오지 않습니다. 화면은
  그대로 뜨고 "지금 버전에서는 앱에서 바로 구독할 수 없다"고만 말합니다. 크래시는
  없습니다.
- `app.json`에 추가할 것은 없습니다. `com.android.vending.BILLING` 권한은
  `react-native-purchases`가 끌어오는 Play Billing 라이브러리의 매니페스트에서
  병합됩니다(빌드된 merged manifest에서 확인). Play 구독 링크는 이미 선언된 https
  `<queries>` 항목으로 열립니다.
- 빌드할 때 `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`(Play용 `goog_`로 시작하는 키)를
  환경변수로 넣어야 결제가 켜집니다. 없으면 위의 "구독할 수 없음" 화면이 됩니다.
  iOS는 `EXPO_PUBLIC_REVENUECAT_IOS_KEY`가 같은 역할을 합니다.
- 크레딧 화면과 공유방, 시청 화면은 삭제했습니다. 심사자가 도달할 수 없는 화면이 남아 있지 않습니다.
- 권한: `app.json`의 `android.blockedPermissions`로 `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW`를 제거했습니다. 남는 권한은 `RECORD_AUDIO`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE(_MICROPHONE, _MEDIA_PLAYBACK)`, `INTERNET`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE`뿐입니다.
- 마이크 권한 문구(안드로이드, iOS)는 "발표와 강의를 녹음해 마인드팩을 만들 수 있도록 마이크 접근을 허용해 주세요"로 통일했습니다. 알림 권한은 녹음 시작 전에 요청하고, 거절하면 백그라운드 녹음만 끕니다.
- 계정 삭제: MY 탭 > 계정 > 회원 탈퇴에서 "탈퇴합니다" 입력 후 삭제됩니다. Play와 App Store 모두 앱 안 삭제 경로를 요구합니다.
- 이용약관(https://premind.co.kr/terms)과 개인정보 처리방침(https://premind.co.kr/privacy)이 MY 탭에서 열리고, 두 주소 모두 200으로 응답합니다.
- iOS `ITSAppUsesNonExemptEncryption: false`, `buildNumber` 1. 안드로이드 `versionCode` 1.
- 데모 로그인: 서버가 설정된 릴리스 빌드에서는 "데모로 둘러보기"가 나오지 않습니다 (`__DEV__` 이거나 API 주소가 없을 때만 보임). 심사자는 앱 액세스에 적어 둔 실제 계정으로 로그인합니다.
- 발표 평가는 사용자가 시작할 때만 실행되고, 말이 거의 없는 녹음은 서버가 422로 거절합니다. 자동 채점이 없으므로 심사자가 의도치 않게 평가를 만들 일이 없습니다.

## 구독 상품 만들기 (인앱 결제, 여기부터 하세요)

이 순서를 지키세요. 앱이 상품을 못 찾으면 "구독 시작하기"가 눌리지 않습니다.

1. **판매자 계정부터**: Play Console > 설정 > 결제 프로필. 결제 프로필(판매자 계정)이
   없으면 구독 상품 자체를 만들 수 없습니다. 사업자 정보와 은행 계좌, 한국 세금
   정보까지 입력해서 "활성" 상태가 되어야 합니다. 승인에 며칠 걸립니다.
2. **AAB를 먼저 한 번 올리세요**: Play Console > 테스트 > 내부 테스트에 앱을 올려야
   인앱 상품 메뉴가 열리고, 기기에서 `getOfferings`가 답을 줍니다. 아직 출시하지
   않아도 됩니다.
3. **월간 구독 만들기**: Play Console > 수익 창출 > 상품 > 구독 > **구독 만들기**
   - 제품 ID: `premind_standard_monthly` (한 번 정하면 못 바꿉니다. 정확히 이 문자열)
   - 이름: `스탠다드 월간`, 설명: 마인드팩 처리 분량과 보관을 늘리는 요금제
   - 기본 요금제 추가 > **자동 갱신**, 결제 기간 **1개월**, 갱신 유형 자동 갱신
   - 지역과 가격: 대한민국 **₩9,900**
   - 기본 요금제를 **활성화**하고, 구독도 **활성화**하세요. 둘 다 활성이 아니면
     앱에서 상품이 안 보입니다.
4. **연간 구독 만들기**: 같은 자리에서 한 번 더
   - 제품 ID: `premind_standard_yearly`
   - 이름: `스탠다드 연간`, 기본 요금제 결제 기간 **1년**, 가격 대한민국 **₩99,000**
   - 마찬가지로 기본 요금제와 구독을 모두 활성화
5. **RevenueCat 연결**: https://app.revenuecat.com 에서 프로젝트를 만들고
   - Apps > **+ New** > Google Play Store, 패키지 이름 `kr.co.premind.premind`
   - Play Console > 설정 > API 액세스에서 만든 서비스 계정 JSON 키를 RevenueCat에
     업로드합니다. 그 서비스 계정에는 Play Console > 사용자 및 권한에서 **재무 데이터
     보기**와 **주문 관리** 권한을 주세요. 반영까지 최대 36시간 걸립니다.
   - Products > Import 또는 수동 추가로 `premind_standard_monthly`,
     `premind_standard_yearly`를 등록합니다(Play는 `상품ID:기본요금제ID` 형식으로
     보일 수 있는데, 그대로 두면 됩니다).
   - Entitlements > **+ New**, identifier 를 정확히 **`standard`** 로 만들고 위 두
     상품을 붙입니다. 이 문자열은 앱 코드(`ENTITLEMENT_ID`)와 같아야 합니다.
   - Offerings > 기본 offering을 **Current**로 두고, 그 안에 패키지 두 개를 만듭니다.
     월간은 **Monthly (`$rc_monthly`)**, 연간은 **Annual (`$rc_annual`)** 유형이어야
     합니다. 앱은 이 두 자리만 읽습니다. 다른 이름으로 만들면 가격이 안 보입니다.
   - Project settings > API keys에서 **Google Play용 공개 키**(`goog_`로 시작)를
     복사해 빌드할 때 `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`로 넣으세요.
   - Integrations > Webhooks에 서버 주소(`https://api.premind.co.kr/api/billing/webhooks/revenuecat`)
     를 등록합니다. 앱이 직접 부르는 `/sync`는 웹훅이 늦을 때를 위한 보조입니다.
6. **결제 테스트**: Play Console > 설정 > 라이선스 테스트에 테스터 Gmail 주소를
   넣으면 실제 청구 없이 구독을 사고 해지해 볼 수 있습니다. 내부 테스트 트랙에서
   받은 앱으로 테스트하세요. 디버그 빌드에서는 Play 결제가 열리지 않습니다.

## Google Play 콘솔에서 할 일

1. **개인정보처리방침 URL**: https://premind.co.kr/privacy
2. **데이터 보안 양식**: 수집 항목은 이메일, 이름(계정), 사용자가 올린 음성과 영상, 유튜브 링크. 전송 중 암호화 예. 삭제 요청 가능 예(앱 안 탈퇴). 광고 없음. 제3자 공유 없음(음성은 처리용으로 Google Vertex AI에 전달되므로 "앱 기능" 목적의 처리 위탁으로 기재).
   **인앱 결제가 생겼으니 여기에 한 줄 추가하세요**: 금융 정보 > **구매 내역**을
   수집함으로 표시하고, 목적은 "앱 기능"과 "계정 관리", 수집이 필수인지에는 "선택"
   (구독하는 사용자만), 암호화 예, 삭제 요청 가능 예로 답합니다. 결제 수단 정보는
   Google Play가 처리하고 앱은 받지 않으므로 "결제 정보"는 체크하지 않습니다.
   구매 내역은 RevenueCat(처리 위탁)과 PREMIND 서버로 전달됩니다.
3. **앱 콘텐츠 > 콘텐츠 등급 설문**: "앱에서 디지털 상품이나 서비스를 구매할 수
   있나요"에 **예**로 답해야 합니다. 예전 답변이 아니오였다면 설문을 다시 제출하세요.
4. **구독 취소 안내**: Play는 앱 안에 해지 경로가 있기를 요구합니다. 구독 화면의
   "구독 관리" 행이 그 역할을 하므로 추가 작업은 없습니다. 심사 메모에 "MY > 구독 >
   구독 관리"라고 적어 두면 심사자가 헤매지 않습니다.
5. **계정 삭제 웹 URL**: Play는 앱 밖에서도 삭제를 요청할 수 있는 웹 주소를 요구합니다. premind.co.kr에 계정 삭제 안내 페이지(예: /account/delete)가 아직 없다면 만들어야 합니다. 구독 중인 계정을 지울 때 구독은 자동으로 해지되지 않는다는 안내를 그 페이지에 함께 적으세요.
6. **포그라운드 서비스 신고**: `FOREGROUND_SERVICE_MICROPHONE` 사용 이유는 "화면을 끄거나 다른 앱을 보는 동안 강의 녹음을 이어 가기". 콘솔이 요구하는 짧은 시연 영상(녹음 시작 후 홈으로 나가도 녹음이 이어지는 장면)을 준비하세요.
7. **타깃 API 레벨**: Expo SDK 57 기본값(API 36)이라 추가 작업 없음.
8. **심사용 계정**: 운영 서버에 `qa-reviewer@premind.co.kr` 계정을 만들어 두었습니다(비밀번호는 `~/.premind/reviewer-account.txt`). "앱 액세스" 항목에 이 이메일과 비밀번호를 적으세요. 계정에는 마인드팩이 완성된 유튜브 자료 하나가 들어 있어 심사자가 바로 둘러볼 수 있습니다. 심사자가 구독을 눌러 볼 수 있도록 이 계정의 Gmail 주소를 라이선스 테스트에도 넣어 두면 좋습니다.
9. **스토어 등록 정보**: 구독 상품을 등록하면 Play가 "인앱 구매" 배지를 자동으로 붙입니다. 설명에 "웹에서 결제" 같은 문구를 넣으면 안 되고, 가격을 적을 거면 스토어 상품 가격(월 9,900원 / 연 99,000원)과 정확히 같아야 합니다. 스크린샷은 홈, 녹음, 마인드팩(대본/요약/노트/마인드맵), 평가 4장이면 충분합니다.
10. **서명**: 로컬 빌드는 `~/.premind/premind-release.keystore`로 서명합니다. 이 파일과 `keystore.password`를 잃으면 업데이트를 올릴 수 없으니 반드시 백업하세요.

## CLI로 배포하기

첫 출시만 콘솔에서 하고, 그 뒤로는 명령 한 줄로 올릴 수 있습니다. Google이 앱의
**첫 번째 AAB만** 콘솔 업로드를 요구하기 때문입니다.

준비(한 번만):

1. Play Console > 설정 > API 액세스에서 Google Cloud 프로젝트를 연결합니다.
2. 그 프로젝트에 서비스 계정을 만들고 JSON 키를 내려받습니다.
3. Play Console > 사용자 및 권한에서 그 서비스 계정을 초대하고, 이 앱에 대해
   "릴리스 관리자" 권한을 줍니다. 반영에 몇 분 걸립니다.
4. 키 파일을 저장소 밖에 두고 경로를 환경변수로 지정합니다.

```bash
export GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=$HOME/.premind/play-service-account.json
```

올리기:

```bash
uv run --with google-auth --with requests scripts/play-deploy.py --aab dist/android/premind-1.0.0-release.aab --track internal --notes "첫 내부 테스트"
```

- `--track`은 internal, alpha, beta, production 중 하나입니다.
- 기본값 `--status draft`는 콘솔에서 검토하고 직접 출시하도록 초안으로 둡니다.
  바로 배포하려면 `--status completed`.
- `--dry-run`은 업로드와 트랙 지정까지만 하고 커밋하지 않습니다. Play는 그대로입니다.
- 버전을 올리지 않고 다시 올리면 "version code already used"로 거절됩니다.
  `app.json`의 `version`, `android.versionCode`, `ios.buildNumber`를 함께 올리세요.

## App Store에서 할 일

1. **Sign in with Apple**: 구글, 카카오 로그인을 제공하면 Apple 로그인도 반드시 있어야 합니다(가이드라인 4.8). iOS 제출 전에 추가하거나, iOS 빌드에서는 소셜 로그인을 숨겨야 합니다.
2. **자동 갱신 구독 상품**: App Store Connect > 앱 > 수익 창출 > 구독에서 같은 제품 ID(`premind_standard_monthly`, `premind_standard_yearly`)로 구독 그룹 하나와 상품 두 개를 만들고, RevenueCat에 App Store 앱과 앱별 공유 비밀(App-Specific Shared Secret)을 등록하세요. `EXPO_PUBLIC_REVENUECAT_IOS_KEY`(`appl_`로 시작)를 빌드에 넣으면 같은 화면이 App Store 결제로 동작합니다.
3. **심사 메모**: 결제는 앱 안에서 App Store 인앱 결제로 이뤄지고, 해지는 화면의 "구독 관리"가 App Store 구독 설정으로 보낸다고 적으세요. 예전의 "웹에서만 결제" 메모는 더 이상 맞지 않으니 지워야 합니다.
4. **개인정보 라벨**: Play 데이터 보안과 같은 내용으로 채웁니다. 구매 내역 항목도 함께 표시하세요.

## 빌드 전 확인

```bash
npx tsc --noEmit && npx expo lint && npx jest
```

```bash
EXPO_PUBLIC_API_URL=https://api.premind.co.kr \
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_... \
npm run build:android
```

- RevenueCat 키를 빼먹은 빌드는 크래시하지는 않지만 구독 화면에서 결제가 아예
  열리지 않습니다. 스토어에 올리기 전에 기기에서 "구독 시작하기"가 Play 시트를
  띄우는지 반드시 확인하세요.

- 운영 API는 `https://api.premind.co.kr`(GCP VM 34.64.235.126, `premind-recorder-api/infra/`의 compose 스택)입니다. 개발 서버(127.0.0.1:8100)를 가리키는 빌드는 기기에서 로그인이 되지 않습니다.
- 서버 코드를 바꾼 뒤 재배포: 바뀐 파일을 VM의 `~/premind-recorder-api/`에 올리고 `sudo bash infra/deploy.sh`.
- 버전을 올릴 때는 `app.json`의 `version`, `android.versionCode`, `ios.buildNumber`를 함께 올립니다.
- 산출물은 `dist/android/premind-<version>-release.aab`(콘솔 업로드용)와 `.apk`(기기 설치용)입니다.
