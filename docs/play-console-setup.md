# Play Console 첫 출시와 CLI 배포 설정

처음 한 번은 콘솔에서 해야 합니다. 순서를 지키는 게 중요합니다. 앱을 만들고,
첫 AAB를 올리고, 그다음에 API 키를 붙이는 순서입니다. 반대로 하면 서비스 계정에
줄 앱이 없어서 권한 화면에서 막힙니다.

전체는 두 덩어리입니다.

- **A. 첫 출시**: 앱 만들기 → 앱 콘텐츠 작성 → AAB 업로드 → 내부 테스트 배포
- **B. CLI 배포 준비**: 서비스 계정 만들기 → 권한 주기 → 키 파일 두기

---

## A. 첫 출시 (콘솔)

### A-1. 앱 만들기

1. https://play.google.com/console 접속. 개발자 계정으로 로그인합니다.
2. **모든 앱** → **앱 만들기**.
3. 입력값:
   - 앱 이름: `PREMIND`
   - 기본 언어: `한국어 - ko-KR`
   - 앱 또는 게임: **앱**
   - 무료 또는 유료: **무료**
     - 주의: 무료로 만들면 나중에 유료로 바꿀 수 없습니다. 이 칸은 앱을 내려받는
       값만 정합니다. 구독은 여기가 아니라 앱 내 결제이므로, 구독 앱은 전부
       여기서 무료입니다.
   - 선언 두 개(개발자 프로그램 정책, 미국 수출법)에 체크.
4. **앱 만들기**.

### A-2. 앱 콘텐츠 (왼쪽 메뉴 → 정책 → 앱 콘텐츠)

여기 항목을 다 채워야 출시가 열립니다. 답은 `docs/release-checklist.md`에
정리돼 있고, 요약하면 이렇습니다.

| 항목 | 답 |
| --- | --- |
| 개인정보처리방침 | `https://premind.co.kr/privacy` |
| 앱 액세스 | "일부 기능이 제한됨" → 테스트 계정 이메일과 비밀번호 입력 (`~/.premind/reviewer-account.txt`) |
| 광고 | 광고 없음 |
| 콘텐츠 등급 | 설문 진행. 교육용, 폭력/성적 콘텐츠 없음 → 전체 이용가 |
| 타겟층 | 18세 이상 (또는 13세 이상). 아동 대상 아님 |
| 데이터 보안 | 아래 참고 |
| 정부 앱 | 아니요 |
| 금융 기능 | 아니요 |
| 건강 앱 | 아니요 |

**데이터 보안**에서 물어보는 것:

- 데이터를 수집하거나 공유하나요 → **예**
- 수집 항목: 이름, 이메일 주소(계정 관리), 사용자가 만든 오디오/동영상(앱 기능),
  기타 사용자 콘텐츠(유튜브 링크)
- 전송 중 암호화 → **예**
- 사용자가 데이터 삭제를 요청할 수 있나요 → **예**
- 계정 삭제 URL: premind.co.kr에 계정 삭제 안내 페이지가 필요합니다.
  아직 없으면 만들어야 통과합니다.
- 제3자 공유 → 없음. 음성은 처리 목적으로 Google Vertex AI에 전달되지만
  이는 "앱 기능"을 위한 처리이며 광고나 판매 목적이 아닙니다.

**포그라운드 서비스 권한 선언**(별도 화면에 뜹니다):

- `FOREGROUND_SERVICE_MICROPHONE` 사용 이유:
  "화면을 끄거나 다른 앱을 보는 동안에도 강의 녹음을 이어 가기 위해서입니다."
- 시연 영상 링크를 요구합니다. 30초짜리로 충분합니다.
  녹음 시작 → 홈 버튼으로 나감 → 다른 앱 사용 → 앱으로 돌아오니 녹음이 이어짐.
  YouTube에 **미등록(일부 공개)** 으로 올리고 그 링크를 넣으면 됩니다.

### A-3. 스토어 등록정보 (왼쪽 메뉴 → 성장 → 기본 스토어 등록정보)

- 앱 이름, 간단한 설명, 자세한 설명: `store/listing-ko.md` 내용을 복사합니다.
- 앱 아이콘: `store/app-icon-512.png`
- 그래픽 이미지: `store/feature-graphic.png`
- 휴대전화 스크린샷: `store/screenshots/framed/` 에서 4장 이상.
  8번(녹음 화면)은 웹 캡처라 폰에서 직접 찍은 것으로 바꾸거나 빼세요.

### A-4. 첫 AAB 올리기 (왼쪽 메뉴 → 테스트 → 내부 테스트)

1. **새 버전 만들기**.
2. **Play 앱 서명**: 처음이면 "Google에서 생성한 키 사용" 또는 우리 키 업로드를
   묻습니다. **Google이 앱 서명 키를 관리하도록** 두세요. 그러면 우리 키스토어를
   잃어도 구글이 복구해 줍니다. (그래도 `~/.premind/premind-release.keystore`
   백업은 반드시 하세요. 업로드 키는 여전히 우리 것입니다.)
3. `dist/android/premind-1.0.0-release.aab` 를 드래그해서 업로드.
4. 출시명과 출시 노트 입력.
5. **테스터** 탭에서 이메일 목록을 만들고 본인 계정을 넣습니다.
6. **검토** → **내부 테스트로 출시 시작**.

여기까지 하면 몇 분 뒤 테스터에게 링크가 갑니다. 그리고 **이 시점부터 CLI가
열립니다.**

---

## B. CLI 배포 준비

### B-1. Google Cloud 프로젝트 연결

1. Play Console → 왼쪽 맨 아래 **설정** → **API 액세스**.
2. 약관에 동의하면 "새 프로젝트 만들기" 또는 기존 프로젝트 연결이 나옵니다.
   - 이미 `teachingflow` 프로젝트를 쓰고 있으니 그걸 연결해도 되고,
     새로 만들어도 됩니다. 새로 만드는 쪽이 권한이 깔끔합니다.

### B-2. 서비스 계정 만들기

1. 같은 **API 액세스** 화면에서 **서비스 계정** 섹션 → **새 서비스 계정 만들기**.
2. 안내 팝업의 **Google Cloud Platform** 링크를 누르면 클라우드 콘솔이 열립니다.
3. 클라우드 콘솔에서 **서비스 계정 만들기**:
   - 이름: `premind-play-deploy`
   - 역할: **비워 두세요**. Play 권한은 Play Console에서 따로 줍니다.
   - 완료.
4. 만든 계정을 클릭 → **키** 탭 → **키 추가** → **새 키 만들기** → **JSON** → 만들기.
   브라우저가 JSON 파일을 내려받습니다. 이 파일은 다시 받을 수 없습니다.
5. Play Console의 API 액세스 화면으로 돌아와 **새로고침**을 누르면 목록에
   방금 만든 서비스 계정이 보입니다.

### B-3. 권한 주기

1. Play Console → **사용자 및 권한** → **사용자 초대**.
2. 이메일에 서비스 계정 주소를 넣습니다. `premind-play-deploy@<프로젝트>.iam.gserviceaccount.com`
   형태이고, JSON 파일 안 `client_email` 값과 같습니다.
3. **앱 권한** 탭에서 PREMIND를 선택하고 **릴리스 관리자**를 줍니다.
   - 계정 권한(전체 계정)은 줄 필요 없습니다.
4. 초대. 반영에 5분에서 길게는 24시간 걸립니다. 보통은 몇 분입니다.

### B-4. 키 파일 두기

```bash
mkdir -p ~/.premind
mv ~/다운로드/<내려받은파일>.json ~/.premind/play-service-account.json
chmod 600 ~/.premind/play-service-account.json
```

```bash
echo 'export GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=$HOME/.premind/play-service-account.json' >> ~/.bashrc
```

새 터미널을 열거나 `source ~/.bashrc` 를 실행하면 적용됩니다.

### B-5. 확인

먼저 아무것도 바꾸지 않는 예행 연습부터:

```bash
uv run --with google-auth --with requests scripts/play-deploy.py --aab dist/android/premind-1.0.0-release.aab --track internal --dry-run
```

`dry run: edit discarded, Play is unchanged` 가 나오면 준비 완료입니다.
실제로 올릴 때는 `--dry-run` 을 빼고 출시 노트를 붙입니다.

```bash
uv run --with google-auth --with requests scripts/play-deploy.py --aab dist/android/premind-1.0.0-release.aab --track internal --notes "형광펜과 암기 카드 추가"
```

---

## C. 앱 내 결제 (RevenueCat + Play 구독)

2026-09-08에 실제로 끝까지 통과한 순서입니다. 순서가 중요합니다. **Play에 앱이
있어야 구독 상품을 만들 수 있고, 구독 상품이 있어야 RevenueCat이 카탈로그를
읽습니다.** 거꾸로 하면 자격 증명 화면에서 영원히 물음표가 남습니다.

### C-1. RevenueCat에 앱 등록 (여기서 `goog_` 키가 나옴)

`Project settings` → `Apps` → `+ New` → **Google Play Store**

| 칸 | 값 |
| --- | --- |
| App name | `PREMIND` |
| Google Play package | `kr.co.premind.premind` |

저장하면 `Public app-specific API key`(`goog_`로 시작)가 나옵니다. 이게 빌드에
들어가는 키입니다. `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`로 넘깁니다.

### C-2. 서비스 계정 만들기

Google Cloud Console → `IAM 및 관리자` → `서비스 계정` → 만들기 → `키` 탭 →
`키 추가` → JSON 내려받기.

**조직 정책에 막히면**: Workspace 조직은 `iam.disableServiceAccountKeyCreation`이
기본으로 걸려 있습니다. 조직 수준에서 `IAM 및 관리자` → `조직 정책`으로 가서 그
제약조건을 비활성으로 바꾸면 됩니다(`조직 정책 관리자` 역할 필요). 반영에 몇 분
걸립니다. 못 풀면 조직 밖 개인 프로젝트에서 만들어도 됩니다. Play는 키가 어느
프로젝트 소속인지 따지지 않습니다.

### C-3. 그 서비스 계정을 Play에 초대

Play Console → `사용자 및 권한` → `신규 사용자 초대` → 서비스 계정 이메일
(`...@....iam.gserviceaccount.com`) → 아래 네 권한:

- 재무 데이터, 주문, 취소 설문 응답 보기
- 주문 및 구독 관리
- 앱 정보 및 다운로드 대량 보고서 보기
- 제품 관련 정보 관리

서비스 계정은 수락 절차 없이 바로 활성이 됩니다.

### C-4. API 켜기

**서비스 계정이 있는 그 프로젝트에서** 켜야 합니다. Vertex 프로젝트가 아닙니다.

- `Google Play Android Developer API` — 필수
- `Cloud Pub/Sub API` — 실시간 결제 알림을 쓸 때만. 서비스 계정에 `Pub/Sub 관리자`
  역할도 필요합니다. 필수는 아닙니다. 우리 서버는 결제 직후 RevenueCat에 직접
  조회하므로(`POST /api/billing/revenuecat/sync`) 알림 없이도 요금제가 반영됩니다.

### C-5. JSON 올리고 **저장**

RevenueCat 앱 설정 → `Service Account Credentials JSON`에 파일을 올린 뒤 반드시
우측 하단 **`Save changes`**를 누릅니다. 올리기만 하고 저장을 안 하면
"Upload your service account credentials file and save"가 계속 뜹니다.

### C-6. Play에 구독 상품 두 개

`수익 창출` → `상품` → `구독`. 상품 ID는 앱 코드
(`src/services/billing.ts`의 `PRODUCT_IDS`)가 이 문자열을 그대로 찾습니다.

| 구독 ID | 기본 요금제 | 계획가 |
| --- | --- | --- |
| `premind_standard_monthly` | 1개월 자동 갱신 | 9,900원 |
| `premind_standard_yearly` | 1년 자동 갱신 | 99,000원 |

각 구독에 **기본 요금제를 추가하고 활성화**까지 해야 합니다. 초안 상태면
RevenueCat이 읽지 못합니다.

### C-7. RevenueCat에서 묶기

- `Products`에 위 두 상품 ID 등록
- `Entitlements`에 `premind_pro` 만들고 두 상품 붙이기
- `Offerings` → default에 `$rc_monthly`, `$rc_annual` 패키지로 넣기

자격 이름은 `premind_pro`와 `standard` 둘 다 앱이 인정합니다
(`ENTITLEMENT_IDS`). 대시보드에서 이름을 바꿔도 결제한 사람이 잠기지 않습니다.

### C-8. 확인

RevenueCat 앱 설정 → `Check credentials`. 세 줄 다 초록이어야 합니다.

- 첫 줄(구독 결제 검증)은 앱이 없어도 통과합니다
- 아래 두 줄(상품 카탈로그, 구독 카탈로그)은 **Play에 앱과 상품이 있어야** 통과합니다
- 권한 변경이 Play API에 반영되는 데 최대 24시간 걸립니다

---

## 자주 막히는 곳

| 증상 | 원인과 해결 |
| --- | --- |
| `403 The caller does not have permission` | 권한이 아직 반영되지 않았거나, 앱 권한이 아니라 계정 권한만 준 경우. 사용자 및 권한에서 PREMIND 앱에 릴리스 관리자가 있는지 확인 |
| `404 not found` | 패키지 이름이 다르거나, 아직 첫 AAB를 콘솔에 올리지 않은 경우 |
| `APK specifies a version code that has already been used` | 같은 versionCode 재업로드. `app.json` 의 `version`, `android.versionCode`, `ios.buildNumber` 를 함께 올리고 다시 빌드 |
| `Only releases with status draft may be created on draft app` | 앱이 아직 한 번도 출시되지 않은 상태. 콘솔에서 내부 테스트를 한 번 출시하면 풀립니다 |
| 업로드는 되는데 테스터에게 안 보임 | 초안 상태입니다. 콘솔에서 출시하거나 `--status completed` 로 올리세요 |

**AAB 업로드가 "인증서 체인이 2개 이상"으로 거부됨**
`scripts/build-android.sh`가 Gradle이 디버그 키로 서명한 번들 위에 다시 서명해서
생기던 문제입니다. 2026-09-08에 고쳤습니다. 스크립트가 서명 전에 기존 서명 파일을
지우고, 서명 후 체인이 1개인지 검사해 아니면 빌드를 실패시킵니다.

**테스터에게 안 보임**
`내부 테스트` → `테스터` 탭에서 이메일 목록을 만들고 체크한 뒤 저장해야 합니다.
그다음 같은 화면의 참여 링크를 테스터 계정으로 열어 수락해야 Play에 나타납니다.
반영에 몇 분에서 몇 시간 걸립니다.

**난독화 파일 경고**
R8이 꺼져 있어서(`android.enableMinifyInReleaseBuilds` 기본 false) 올릴 매핑
파일이 없습니다. 경고일 뿐 출시를 막지 않습니다.

## 버전 올리기

다음 빌드부터는 세 곳을 함께 올립니다.

```bash
# app.json: "version": "1.0.1", "android": { "versionCode": 2 }, "ios": { "buildNumber": "2" }
EXPO_PUBLIC_API_URL=https://api.premind.co.kr npm run build:android
```
