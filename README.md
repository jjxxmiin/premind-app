# PREMIND Flutter MVP

PREMIND는 강의를 녹음하고, 로컬에 안전하게 보관한 뒤 AI 정리 결과를 확인하는 교수자용 Flutter 앱 MVP입니다.

현재 구현 범위는 Phase 1~2와 다음 흐름의 Mock 처리까지입니다.

`개발용 로그인 → 홈 → 강의 정보 입력 → 실제 녹음 → Pause/Resume → 중요 표시 → 종료 확인 → 로컬 파일 확정 → Mock AI 처리 → 결과/오디오 재생 → 공유 링크 생성·시스템 공유`

## 실행 환경

- Flutter 3.38.5 / Dart 3.10.4 기준
- Android API 24 이상
- Android SDK Platform 37 설치
- Android 빌드는 JDK 17 이상 25 미만 권장
- iOS 13 이상

```bash
flutter pub get
flutter analyze
flutter test
flutter run
```

Android 실기기에서는 USB 디버깅을 켠 뒤 `flutter devices`로 기기를 확인하고 `flutter run -d <device-id>`를 실행합니다.

## 프로젝트 구조

```text
lib/
  app/                 # 앱, 테마, go_router, 하단 내비게이션
  core/                # 색상/문구/공통 위젯/유틸리티
  features/
    auth/              # Mock 인증과 세션 유지
    home/              # 홈과 미업로드 세션 복구 안내
    lectures/          # 모델, Mock 저장소, 목록, 상세, 오디오 재생
    processing/        # 단계 기반 Mock AI 처리
    profile/           # 사용자/앱 설정 UI
    recording/         # 실제 녹음, 세션 영속화, 완료 화면
    sharing/           # Mock 링크 생성, 시스템 공유, 공유 목록
```

## UI/UX

- Warm white 기반의 중립적인 화면과 Navy/Indigo 포인트를 사용합니다.
- 홈은 하나의 강의 녹음 Primary Action과 작은 녹화 보조 액션으로 우선순위를 구분합니다.
- 강의·공유 목록은 카드 반복 대신 구분선 기반의 정보 목록을 사용합니다.
- 강의 상세는 오디오 플레이어, AI 요약, 핵심 내용, 중요 구간, 접힌 스크립트를 한 흐름으로 보여줍니다.
- 목록과 상세 로딩에는 지연형 Skeleton을 사용해 짧은 로딩에서 화면이 번쩍이지 않도록 했습니다.
- `share_plus`는 Android/iOS 시스템 공유 시트를 연결하기 위해 사용합니다.

## 로컬 데이터와 녹음

- 녹음은 AAC-LC mono 44.1 kHz, 128 kbps의 `.m4a` 파일로 앱 Documents 디렉터리의 `recordings/` 아래 저장됩니다.
- Android에서는 `record`의 microphone foreground service를 사용해 화면 잠금·백그라운드 중 녹음 지속성을 높입니다.
- 녹음 시작 전에 `RecordingSession`과 `Lecture` 메타데이터를 먼저 생성합니다.
- 녹음 중 5초마다, Pause 및 앱 lifecycle 변화 시 세션 스냅샷을 SharedPreferences에 저장합니다.
- Stop 시 파일을 확정하고 세션 상태를 `completed`로 변경합니다.
- Mock 처리가 끝날 때까지 로컬 파일을 삭제하지 않습니다.
- 재실행 시 미완료 또는 미업로드 세션이 있으면 홈에 복구 배너를 표시합니다.

## Mock인 기능

- Google / Apple / 이메일 인증
- Object Storage 업로드 및 업로드 재시도
- AI 음성 인식, 요약, 타임라인, 스크립트 생성
- 공유 링크 서버 발급(현재는 로컬에 영속되는 Mock URL)
- 녹화 기능

개발용 로그인, Mock 강의/AI 처리 결과, 공유 URL은 앱 전체 흐름을 서버 없이 확인할 수 있도록 실제 로컬 영속성을 사용합니다. 링크 복사, 시스템 공유 시트, 로컬 공유 중지는 동작합니다.

## 플랫폼 권한

- Android: `RECORD_AUDIO`, foreground microphone service, Bluetooth SCO용 `MODIFY_AUDIO_SETTINGS`, 향후 녹화용 `CAMERA`
- iOS: `NSMicrophoneUsageDescription`, 향후 녹화용 `NSCameraUsageDescription`, background audio mode
- iOS `Podfile`: permission_handler의 microphone/camera 전처리 정의 포함

실기기에서는 최초 녹음 시작 시 권한 허용/거부/영구 거부와 설정 이동 흐름을 각각 확인해야 합니다.
