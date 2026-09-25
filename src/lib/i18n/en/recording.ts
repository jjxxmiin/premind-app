import type { EnDict } from '../core';

/**
 * 영어 사전 — recording 영역. 키는 화면의 한국어 문장 그대로.
 * 녹음(app/record), 파일 올리기(app/capture), 마인드팩 만드는 중(app/processing), 그리고 그 화면이 그리는
 * lib, features, services, state 의 한국어 문장(오류, 진행 문구). 서비스 쪽 문장은 한국어 그대로 두고
 * 화면이 t(message) 로 감싼다.
 */
export const EN_RECORDING: EnDict = {
  // ── 녹음 화면 (app/record.tsx) ────────────────────────────────────────────
  'record|녹음': 'Record',
  '강의 녹음': 'Lecture recording',
  '녹음 시작': 'Start recording',
  '녹음을 시작해요': 'Starts recording',
  '탭하면 바로 시작돼요': 'Tap to start right away',
  '원본은 기기에 먼저 저장돼요': 'The original is saved on your device first',
  '원본을 고르면 이어서 마인드팩을 만들어요.': 'Pick an original to go on and make its Mind Pack.',
  '이어갈 녹음 {n}개': { one: '{n} recording to continue', other: '{n} recordings to continue' },
  '녹음 기록': 'Recording history',
  '원본이 없는 기록이 {n}개 있어요. 아래에서 지울 수 있어요.': {
    one: '{n} record has no original. You can delete it below.',
    other: '{n} records have no original. You can delete them below.',
  },
  '원본을 찾을 수 없어요. 기록만 지울 수 있어요.': "We can't find the original. You can only delete the record.",
  '마인드팩 만들기': 'Make Mind Pack',
  '기록 지우기': 'Delete record',
  '다시 불러오기': 'Reload',
  '마이크 권한이 필요해요': 'Microphone access needed',
  '설정에서 마이크를 허용한 뒤 다시 시작해 주세요.': 'Allow the microphone in Settings, then start again.',
  '권한 안내': 'How to allow',
  '설정 열기': 'Open Settings',
  '녹음을 시작하지 못했어요': "Couldn't start recording",
  '녹음 중에도 원본을 브라우저에 저장해 두어 새로고침해도 이어갈 수 있어요.':
    'While you record, the original is saved in your browser, so you can pick up again even after a refresh.',
  '화면이 잠겨도 녹음은 계속돼요. 원본은 기기에 남아요.':
    'Recording keeps going when your screen locks. The original stays on your device.',
  '원본은 그대로 있어요. 아래 안내를 확인해 주세요.': 'Your original is safe. Please check the note below.',
  '녹음 시간 {time}': 'Recording time {time}',
  '마이크 입력 신호를 표시하고 있어요': 'Showing the microphone input level',
  '마이크 입력을 기록하지 않고 있어요': 'Not recording microphone input',
  '현재 상태 {state}. {safety}': 'Current status: {state}. {safety}',
  '원본 상태': 'Original',
  '녹음은 계속되고 있어요': 'Recording is still going',
  '원본 상태를 확인해 주세요': 'Please check your original',
  '원본 저장 중': 'Saving original',
  '녹음을 다시 이어가요': 'Resumes recording',
  '녹음을 잠시 멈춰요': 'Pauses recording',
  'record|계속하기': 'Resume',
  'record|일시정지': 'Pause',
  '지금 시점을 표시해요': 'Marks this moment',
  '중요 표시': 'Mark',
  '녹음을 끝내고 원본을 저장해요': 'Ends the recording and saves the original',
  'record|종료': 'Stop',
  '다시 저장': 'Save again',
  '나중에 하기': 'Later',
  'record|나가기': 'Leave',
  '이 탭을 열어 두세요. 종료하면 원본을 브라우저에 저장해요.':
    'Keep this tab open. When you stop, the original is saved in your browser.',
  '화면을 잠가도 녹음은 계속돼요. 전화가 오면 원본을 자동으로 저장해요.':
    'Recording keeps going when you lock your screen. If a call comes in, the original is saved automatically.',
  '멈춘 동안은 녹음하지 않아요. 지금까지의 원본과 중요 표시는 그대로 있어요.':
    "Nothing is recorded while paused. Your original and marks so far are kept.",
  '계속 녹음': 'Keep recording',
  '녹음 종료': 'Stop recording',
  '원본을 브라우저에 저장한 뒤 마인드팩을 만들어요.': 'We save the original in your browser, then make the Mind Pack.',
  '원본을 기기에 저장한 뒤 마인드팩을 만들어요.': 'We save the original on your device, then make the Mind Pack.',
  '녹음을 종료할까요?': 'Stop recording?',
  '{time} 녹음됨': '{time} recorded',
  '중요 표시 {n}개도 함께 저장돼요.': { one: 'Your {n} mark is saved too.', other: 'Your {n} marks are saved too.' },
  '중요 표시 {n}개': { one: '{n} mark', other: '{n} marks' },
  '아직 중요 표시가 없어요': 'No marks yet',
  '중요 표시 {n}개, 마지막 {time}': { one: '{n} mark, last at {time}', other: '{n} marks, last at {time}' },
  '기억할 순간에 중요 표시를 남겨요': 'Mark the moments you want to remember',
  '{time}에 중요 표시했어요.': 'Marked at {time}.',
  '복구 목록에서 지울까요?': 'Delete from the recovery list?',
  '녹음 파일은 남기고 기록만 지워요.': 'The recording file stays. Only the record is deleted.',
  '{error} 이 화면을 닫기 전에 원본 보관을 다시 시도해 주세요.':
    '{error} Before you close this screen, please try saving the original again.',
  '마이크를 준비하고 있어요': 'Getting the microphone ready',
  '권한과 저장공간 확인이 끝나면 안전하게 종료할 수 있어요.':
    'You can safely leave once the permission and storage checks are done.',
  '녹음을 보관하고 있어요': 'Saving your recording',
  '기기 저장이 끝날 때까지 잠시만 기다려 주세요.': 'Please wait a moment until it is saved on your device.',
  '녹음을 보관하고 나갈까요?': 'Save the recording and leave?',
  '지금까지 녹음한 원본을 브라우저에 저장해요.': 'The original recorded so far is saved in your browser.',
  '지금까지 녹음한 내용은 기기에 남고, 나중에 다시 찾을 수 있어요.':
    'What you have recorded so far stays on your device, and you can find it again later.',
  '보관 후 나가기': 'Save and leave',
  // 공용 버튼(이 화면들이 쓰는 것 — 공통 사전과 같은 뜻)
  취소: 'Cancel',
  확인: 'OK',
  저장: 'Save',
  // 설정 줄, 제목, 폴더
  '제목 없음': 'Untitled',
  '폴더 없음': 'No folder',
  '녹음 제목을 바꿔요': 'Changes the recording title',
  '제목, {title}': 'Title, {title}',
  제목: 'Title',
  '폴더를 골라요': 'Chooses a folder',
  '폴더, {folder}': 'Folder, {folder}',
  폴더: 'Folder',
  '녹음 제목': 'Recording title',
  '최대 80자까지 입력할 수 있어요.': 'You can enter up to 80 characters.',
  '나중에 찾기 쉬운 이름이 좋아요.': "Pick a name that's easy to find later.",
  '예: 인공지능 개론 5주차': 'e.g. Intro to AI, Week 5',
  '폴더 선택': 'Choose folder',
  '폴더 만들기': 'Create folder',
  '녹음을 담을 폴더가 필요해요': 'You need a folder for the recording',
  '폴더가 없어요': 'No folders yet',
  '{title} 폴더': '{title} folder',
  // 녹음 상태 (recordingPresentation, recoveryStatusLabel)
  'state|일시정지': 'Paused',
  '원본 보관 중': 'Saving original',
  '녹음 중': 'Recording',
  '보관 다시 시도': 'Retry saving',
  '원본 보관됨': 'Original saved',
  '확인 필요': 'Needs attention',
  '녹음 완료': 'Recorded',
  '중단 후 보관': 'Saved after stop',
  '일시정지 중 종료': 'Ended while paused',
  '녹음 중 종료': 'Ended while recording',
  '새 음성 입력은 멈췄고, 지금까지의 원본을 안전한 보관 영역으로 옮기고 있어요.':
    'New audio input has stopped, and the original so far is being moved to safe storage.',
  '저장이 끝나면 마인드팩 만들기로 넘어가요.': 'Once saved, we move on to making the Mind Pack.',
  '새 음성은 기록하지 않아요. 계속하기 전까지 녹음 시간도 멈춰 있어요.':
    "No new audio is recorded. The timer stays stopped until you resume.",
  '지금까지 녹음한 원본과 중요 표시는 기기에 남아 있어요.': 'The original and marks recorded so far stay on your device.',
  '마이크 입력을 원본 파일에 기록하고 있어요.': 'Recording microphone input to the original file.',
  '복구 정보는 5초마다 기기에 저장돼요.': 'Recovery info is saved on your device every 5 seconds.',
  '녹음은 멈췄고 원본이 이 화면에 임시로 남아 있어요.': 'Recording has stopped, and the original is held on this screen for now.',
  '이 탭을 닫기 전에 아래 버튼으로 원본 보관을 다시 시도해 주세요.':
    'Before you close this tab, use the button below to try saving the original again.',
  '녹음은 중단됐지만 사용할 수 있는 원본을 기기에 보관했어요.':
    'Recording was interrupted, but a usable original was saved on your device.',
  '저장된 구간으로 마인드팩 만들기를 이어갈 수 있어요.': 'You can go on to make a Mind Pack from the saved part.',
  '녹음 장치가 중단되어 새 음성을 기록하지 않고 있어요.': 'The recorder stopped, so no new audio is being recorded.',
  '아래 안내를 확인한 뒤 안전하게 화면을 나가 주세요.': 'Please check the note below, then leave this screen safely.',
  // 녹음 화면 오류, 안내 (screenError, recoveryLoadError)
  '중단된 녹음 원본이 비어 있어 복구할 수 없어요.': "The interrupted recording is empty, so it can't be recovered.",
  '중단된 녹음 원본을 다시 열 수 없어요.': "We can't reopen the interrupted recording.",
  '녹음을 저장하지 못했어요. 저장공간과 마이크 상태를 확인해 주세요.':
    "We couldn't save the recording. Please check your storage and microphone.",
  '이전에 보관한 녹음 목록을 불러오지 못했어요.': "We couldn't load your saved recordings.",
  '녹음을 담을 폴더를 먼저 선택해 주세요.': 'Please choose a folder for the recording first.',
  '녹음 제목을 입력해 주세요.': 'Please enter a recording title.',
  '복구 정보 저장이 잠시 지연되고 있어요. 녹음은 계속됩니다.':
    'Saving recovery info is delayed for a moment. Recording continues.',
  '보관된 녹음 파일 위치를 찾지 못했어요.': "We couldn't find where the saved recording is.",
  '저장된 녹음 파일을 열 수 없어요. 기록만 지울 수 있어요.':
    "We can't open the saved recording file. You can only delete the record.",
  '녹음을 담을 폴더를 찾을 수 없어요.': "We can't find the folder for this recording.",
  '복구 정보를 지우지 못했어요.': "We couldn't delete the recovery info.",
  '녹음 복구 정보를 찾지 못했어요.': "We couldn't find the recording's recovery info.",
  '마이크 준비가 끝나면 안전하게 나갈 수 있어요.': 'You can leave safely once the microphone is ready.',
  '브라우저 저장소에 원본을 보관하고 있어요. 잠시만 기다려 주세요.':
    'Saving the original in browser storage. Please wait a moment.',
  '이 원본은 아직 임시 저장 상태예요. 다시 저장을 눌러 주세요.':
    'This original is only saved temporarily. Please tap Save again.',
  '주소창 옆 사이트 설정에서 마이크를 허용한 뒤 이 페이지를 새로고침해 주세요.':
    'Allow the microphone in the site settings next to the address bar, then refresh this page.',
  '기기 설정에서 PREMIND의 마이크 권한을 확인해 주세요.':
    "Please check PREMIND's microphone permission in your device settings.",
  // 녹음기 (features/recording/use-premind-recorder.ts)
  '진행 중인 녹음을 먼저 종료해 주세요.': 'Please stop the recording in progress first.',
  '녹음하려면 마이크 권한이 필요해요.': 'You need to allow the microphone to record.',
  '녹음을 준비하지 못했어요.': "We couldn't get recording ready.",
  '브라우저 녹음 복구 저장소를 준비하지 못했어요.': "We couldn't set up browser storage for recording recovery.",
  '녹음 복구 조각을 브라우저에 보관하지 못했어요.': "We couldn't save recording recovery pieces in your browser.",
  '녹음 중일 때만 일시정지할 수 있어요.': 'You can only pause while recording.',
  '일시정지된 녹음만 다시 시작할 수 있어요.': 'You can only resume a paused recording.',
  '종료할 녹음이 없어요.': 'There is no recording to stop.',
  '녹음 파일 위치를 확인하지 못했어요.': "We couldn't find where the recording file is.",
  '녹음을 종료하지 못했어요.': "We couldn't stop the recording.",
  '녹음 중일 때만 중요 표시를 남길 수 있어요.': 'You can only add marks while recording.',
  '시스템 오디오 중단으로 녹음이 멈췄어요.': 'Recording stopped because system audio was interrupted.',
  '시스템 오디오가 재시작되어 녹음이 멈췄어요.': 'Recording stopped because system audio restarted.',
  '다른 오디오 사용으로 녹음이 예기치 않게 멈췄어요.': 'Recording stopped unexpectedly because another app used audio.',
  '녹음 화면이 종료되어 진행 중인 녹음을 안전하게 마쳤어요.':
    'The recording screen closed, so the recording in progress was safely finished.',
  // 브라우저 원본 보관 (features/files/web-media-store.ts, 녹음 화면이 그린다)
  '녹음 복구 ID를 확인하지 못했어요.': "We couldn't check the recording recovery ID.",
  '이 브라우저에서는 로컬 원본 보관을 사용할 수 없어요.': "This browser can't keep originals locally.",
  '브라우저 저장소를 열지 못했어요.': "We couldn't open browser storage.",
  '녹음 복구 조각을 읽지 못했어요.': "We couldn't read the recording recovery pieces.",
  '녹음 복구 조각 정보를 확인하지 못했어요.': "We couldn't check the recording recovery piece info.",
  '녹음 복구 조각을 보관하지 못했어요.': "We couldn't save the recording recovery pieces.",
  '녹음 복구 조각 보관이 중단됐어요.': 'Saving recording recovery pieces was interrupted.',
  '복구할 수 있는 녹음 원본 조각이 아직 없어요.': 'There are no recording pieces to recover yet.',
  '보관된 녹음 원본이 비어 있어요.': 'The saved recording is empty.',
  '녹음 복구 조각을 정리하지 못했어요.': "We couldn't clean up the recording recovery pieces.",
  '녹음 복구 조각 정리가 중단됐어요.': 'Cleaning up recording recovery pieces was interrupted.',
  '브라우저 원본을 삭제하지 못했어요.': "We couldn't delete the original from your browser.",
  '브라우저 원본 삭제가 중단됐어요.': 'Deleting the original from your browser was interrupted.',
  '보관된 원본을 읽지 못했어요.': "We couldn't read the saved original.",
  '브라우저에 원본을 보관하지 못했어요.': "We couldn't save the original in your browser.",
  '브라우저 원본 보관이 중단됐어요.': 'Saving the original in your browser was interrupted.',
  '브라우저 저장소에서 원본을 찾지 못했어요.': "We couldn't find the original in browser storage.",
  '브라우저가 선택한 원본을 읽지 못했어요.': "The browser couldn't read the file you chose.",
  '선택한 원본 파일이 비어 있어요.': 'The file you chose is empty.',
  '브라우저 저장 공간에 원본을 보관하지 못했어요. 저장 공간을 확인해 주세요.':
    "We couldn't save the original in browser storage. Please check your storage space.",

  // ── 파일 올리기 (app/capture.tsx) ──────────────────────────────────────────
  '파일 올리기': 'Upload a file',
  '영상, 음성, 문서를 골라요': 'Choose a video, audio, or document',
  '다시 선택': 'Choose again',
  '파일을 올리지 못했어요': "Couldn't upload the file",
  '지원하는 파일': 'Supported files',
  '최대 4GB': 'Up to 4 GB',
  영상: 'Video',
  'MP4, MOV, WEBM, MKV, AVI 등': 'MP4, MOV, WEBM, MKV, AVI, and more',
  음성: 'Audio',
  'M4A, MP3, WAV, AAC, OGG 등': 'M4A, MP3, WAV, AAC, OGG, and more',
  문서: 'Document',
  '문서는 쪽 단위로 읽어요. 소리가 없으니 재생 대신 쪽 번호가 붙어요. 스캔한 이미지 PDF는 글자가 없어서 읽지 못해요.':
    "Documents are read page by page. There's no sound, so you get page numbers instead of playback. Scanned image PDFs have no text, so they can't be read.",
  '일부 파일은 기기에 따라 재생이 안 될 수 있어요.': "Some files may not play on every device.",
  '원본은 기기에 먼저 저장돼요. 중간에 멈춰도 원본은 남아 있어요.':
    'The original is saved on your device first. If anything stops midway, the original is kept.',
  '파일 선택': 'Choose file',
  '자료를 담을 폴더가 필요해요': 'You need a folder for your materials',
  '그대로 올리기': 'Upload anyway',
  '폴더를 먼저 골라 주세요.': 'Please choose a folder first.',
  '파일 선택을 취소했어요.': 'File selection canceled.',
  '파일 정보를 확인하지 못했어요. 다른 파일로 다시 시도해 주세요.':
    "We couldn't check the file. Please try again with a different file.",
  // 파일 고르기 (features/import, 파일 올리기 화면이 그린다)
  '파일 크기를 확인할 수 없어요. 다른 위치에서 다시 선택해 주세요.':
    "We can't check the file size. Please choose it again from a different location.",
  '선택한 파일 정보를 가져오지 못했어요. 다시 선택해 주세요.': "We couldn't get the file's details. Please choose it again.",
  '음성, 영상, PDF 또는 PPTX 파일을 선택해 주세요.': 'Please choose an audio, video, PDF, or PPTX file.',
  '선택한 원본 파일을 읽을 수 없어요. 다시 선택해 주세요.': "We can't read the file you chose. Please choose it again.",
  '원본 파일을 기기에 안전하게 보관하지 못했어요. 저장 공간을 확인해 주세요.':
    "We couldn't safely keep the file on your device. Please check your storage space.",
  'Wi-Fi가 아니에요': "You're not on Wi-Fi",
  '지금 올리면 이동통신 데이터로 보내요. 요금이 나올 수 있어요.':
    'If you upload now, it uses mobile data. Charges may apply.',

  // ── 마인드팩 만드는 중 (app/processing/[id].tsx) ───────────────────────────
  '만드는 중': 'Making',
  '이 기기에서 자료를 찾을 수 없어요. 홈에서 다시 열어 주세요.':
    "We can't find this material on this device. Please open it again from Home.",
  홈으로: 'Go Home',
  '자료가 없어요': 'Material not found',
  '영상 읽기': 'Reading video',
  대본: 'Transcript',
  마인드팩: 'Mind Pack',
  '원본 저장': 'Original saved',
  '준비 완료': 'Ready',
  요약: 'Summary',
  문제: 'Quiz',
  '{items}까지 준비됐어요. 지금 열어 보세요.': '{items} ready. Open it now.',
  '마인드팩이 준비됐어요. 지금 열어 보세요.': 'Your Mind Pack is ready. Open it now.',
  '마인드팩이 준비됐어요': 'Your Mind Pack is ready',
  '분량 초과': 'Limit reached',
  '연결 대기': 'Waiting for connection',
  '이번 달 처리 분량을 다 썼어요. 원본은 그대로 있으니 스탠다드로 늘리거나 다음 달에 이어가요.':
    "You've used this month's processing limit. Your original is kept, so upgrade to Standard or continue next month.",
  '연결이 끊겨 멈췄어요. Wi-Fi를 확인하고 다시 시도해 주세요.':
    'Stopped because the connection dropped. Check your Wi-Fi and try again.',
  '만들다가 멈췄어요. 링크는 그대로 남아 있어요.': 'Stopped while making it. Your link is still saved.',
  '연결이 끊겨 멈췄어요. 원본은 기기에 있으니 Wi-Fi를 확인하고 이어가 주세요.':
    'Stopped because the connection dropped. Your original is on your device, so check your Wi-Fi and continue.',
  '만들다가 멈췄어요. 원본은 기기에 그대로 있어요.': 'Stopped while making it. Your original is still on your device.',
  '이번 달 분량을 다 썼어요': "You've used this month's limit",
  '연결을 확인해 주세요': 'Check your connection',
  '잠시 멈췄어요': 'Paused for now',
  'processing|생성 중': 'Generating',
  'processing|대본 생성': 'Transcribing',
  'processing|영상 읽기': 'Reading video',
  'processing|올리는 중': 'Uploading',
  'processing|준비 중': 'Preparing',
  '데모라서 예시 대본과 문제로 만들어요.': "It's a demo, so it uses a sample transcript and quiz.",
  '대본 → 요약 → 마인드맵 → 문제 순서로 만들어요. 영상 길이에 따라 시간이 달라요.':
    'We make the transcript, then the summary, mind map, and quiz. Time depends on the video length.',
  '대본 → 요약 → 마인드맵 → 문제 순서로 만들어요. 원본 길이에 따라 시간이 달라요.':
    'We make the transcript, then the summary, mind map, and quiz. Time depends on the length of the original.',
  '마인드팩을 만들고 있어요': 'Making your Mind Pack',
  '데모로 둘러보는 중이에요': "You're exploring a demo",
  '대본, 요약, 마인드맵, 문제는 예시예요.': 'The transcript, summary, mind map, and quiz are samples.',
  '파일은 기기에 남지만 대본, 요약, 마인드맵, 문제는 예시예요.':
    'Your file stays on your device, but the transcript, summary, mind map, and quiz are samples.',
  '유튜브 영상 썸네일': 'YouTube video thumbnail',
  '유튜브 링크': 'YouTube link',
  유튜브: 'YouTube',
  '영상은 내려받지 않고 유튜브에서 바로 재생해요.': "The video isn't downloaded. It plays straight from YouTube.",
  '구독 보기': 'View plans',
  '다시 시도': 'Try again',
  '다시 만들기': 'Make again',
  '이어갈 수 있어요': 'You can pick up where it stopped',
  '마인드팩 만드는 단계': 'Mind Pack steps',
  '모든 단계가 끝났어요. 바로 열 수 있어요.': 'All steps are done. You can open it now.',
  '이 화면을 나가도 앱이 열려 있으면 계속 만들어요.': 'Even if you leave this screen, we keep making it while the app is open.',
  '다시 시도하면 같은 링크로 이어서 만들어요.': 'If you try again, we continue with the same link.',
  '원본은 이미 올라갔어요. 연결되면 이어서 확인해요.': "The original is already uploaded. We'll check again once you're connected.",
  '끊긴 지점부터 이어서 올려요. 자료가 중복되지 않아요.': "We resume the upload where it stopped. You won't get a duplicate.",
  '다시 시도해도 기기의 원본은 지워지지 않아요.': "Trying again won't delete the original on your device.",
  '마인드팩 열기': 'Open Mind Pack',
  '마인드팩을 만들지 못했어요. 다시 시도해 주세요.': "We couldn't make the Mind Pack. Please try again.",
  '만들다가 멈췄어요. 다시 시도해 주세요.': 'Stopped while making it. Please try again.',

  // ── 자료 진행 문구, 오류 (services/study-material-service.ts) ───────────────
  '녹음, 영상, PDF, 슬라이드만 올릴 수 있어요.': 'You can only upload recordings, videos, PDFs, and slides.',
  '새 자료': 'New material',
  '마인드팩 만들기를 중단했어요.': 'Stopped making the Mind Pack.',
  '파일 정보와 폴더를 확인해 주세요.': 'Please check the file details and folder.',
  '기기에 저장됨': 'Saved on device',
  '유튜브 링크 가져오기는 PREMIND 계정으로 로그인했을 때만 쓸 수 있어요.':
    'Importing YouTube links is only available when you log in with a PREMIND account.',
  '유튜브 영상 주소가 아니에요. youtube.com/watch?v=… 또는 youtu.be/… 형태로 넣어 주세요.':
    "That's not a YouTube video link. Please enter it as youtube.com/watch?v=… or youtu.be/….",
  '유튜브 강의': 'YouTube lecture',
  '유튜브 영상을 읽고 대본을 만들고 있어요': 'Reading the YouTube video and making the transcript',
  '보관된 녹음': 'Saved recording',
  '이 녹음을 처리하지 못했어요': "We couldn't process this recording",
  '보관됨 / 마인드팩 만들기 전': 'Saved, Mind Pack not made yet',
  '마인드팩을 불러오고 있어요': 'Loading your Mind Pack',
  '데모 계정에서는 예시 평가만 볼 수 있어요. 새로 평가하려면 PREMIND 계정으로 로그인해 주세요.':
    'The demo account only shows a sample review. To get a new review, log in with a PREMIND account.',
  '마인드팩이 준비된 자료만 평가할 수 있어요.': 'Only materials with a ready Mind Pack can be reviewed.',
  '평가가 예상보다 오래 걸리고 있어요. 잠시 후 자료를 다시 열어 확인해 주세요.':
    'The review is taking longer than expected. Please open the material again in a moment to check.',
  '마인드팩 만들기를 준비하고 있어요': 'Getting ready to make your Mind Pack',
  '말한 내용을 시간순으로 정리하고 있어요': "Putting what's said in time order",
  '핵심 개념과 요약을 만들고 있어요': 'Making key concepts and a summary',
  '문제를 만들고 있어요': 'Making the quiz',
  '마인드팩 준비 완료': 'Mind Pack ready',
  '녹음을 올리고 있어요': 'Uploading the recording',
  '업로드를 준비하고 있어요': 'Getting the upload ready',
  '보관된 원본의 처리 상태를 확인하고 있어요': 'Checking the status of the saved original',
  '이 녹음을 처리하지 못했어요. 원본은 기기에 그대로 있어요.':
    "We couldn't process this recording. The original is still on your device.",
  '음성 인식이 준비되지 않아 마인드팩을 만들지 못했어요. 녹음은 안전하게 올라갔어요.':
    "Speech recognition wasn't ready, so we couldn't make the Mind Pack. Your recording was uploaded safely.",
  '처리가 예상보다 오래 걸리고 있어요. 잠시 후 다시 시도해 주세요.':
    'Processing is taking longer than expected. Please try again in a moment.',
  '말한 내용을 정리하고 마인드팩을 만들고 있어요': "Organizing what's said and making your Mind Pack",

  // ── 앱 상태 (state/app-store.tsx) ─────────────────────────────────────────
  '내 강의': 'My lectures',
  '기본 폴더': 'Default folder',
  '녹음과 가져온 영상이 기본으로 담기는 곳이에요.': 'Recordings and imported videos go here by default.',
  '이메일 또는 비밀번호가 맞지 않아요.': "Your email or password doesn't match.",
  '로그인 시도가 많았어요. 잠시 후 다시 시도해 주세요.': 'There were too many login attempts. Please try again in a moment.',
  '요청을 처리하지 못했어요. 다시 시도해 주세요.': "We couldn't process your request. Please try again.",
  '회원 탈퇴를 진행하려면 다시 로그인해 주세요.': 'Please log in again to delete your account.',
  '로그인 시간이 만료됐어요. 다시 로그인한 뒤 회원 탈퇴를 진행해 주세요.':
    'Your login has expired. Please log in again, then delete your account.',
  '계정은 삭제됐지만 이 기기의 일부 데이터를 정리하지 못했어요. 브라우저 또는 앱 저장공간을 확인해 주세요.':
    "Your account was deleted, but we couldn't clear some data on this device. Please check your browser or app storage.",
  '폴더 이름을 입력해 주세요.': 'Please enter a folder name.',
  '새 폴더': 'New folder',
  '강의를 녹음하면 마인드팩이 만들어져요.': 'Record a lecture and a Mind Pack is made for you.',
  'PREMIND 사용자': 'PREMIND user',
  '올리려면 PREMIND 계정으로 로그인해 주세요. 데모에서는 올릴 수 없어요.':
    "To upload, log in with a PREMIND account. You can't upload in the demo.",
  '자료를 찾을 수 없어요.': "We can't find the material.",
  '이미 마인드팩을 만들고 있어요.': 'The Mind Pack is already being made.',
  '마인드팩을 만들지 못했어요': "Couldn't make the Mind Pack",
  '자료를 담을 폴더를 찾을 수 없어요.': "We can't find the folder for this material.",
  '자료를 저장하려면 먼저 로그인해 주세요.': 'Please log in first to save materials.',
  '이전 녹음 일부를 복구하지 못했어요. 원본은 그대로 보관되어 있고, 앱을 다시 열면 재시도해요.':
    "We couldn't recover some earlier recordings. The originals are kept, and we'll try again when you reopen the app.",
  '이전 녹음을 확인하지 못했어요. 원본은 그대로 보관되어 있고, 앱을 다시 열면 재시도해요.':
    "We couldn't check earlier recordings. The originals are kept, and we'll try again when you reopen the app.",
  '올릴 자료를 찾을 수 없어요.': "We can't find the material to upload.",
  '이미 평가를 만들고 있어요.': 'The review is already being made.',
  '제목을 입력해 주세요.': 'Please enter a title.',
  '폴더를 찾을 수 없어요.': "We can't find the folder.",
  '문제 또는 선택지를 확인할 수 없어요.': "We can't check the question or its choices.",
  '마인드팩이 준비된 자료만 공유할 수 있어요.': 'Only materials with a ready Mind Pack can be shared.',
  '공유할 항목을 하나 이상 선택해 주세요.': 'Please choose at least one item to share.',
  '공유 링크를 찾을 수 없어요.': "We can't find the share link.",
  '끝난 공유 링크는 바꿀 수 없어요.': "An ended share link can't be changed.",
  '공개 중인 공유 링크는 PREMIND 웹에서 바꿔 주세요.': 'Please change a public share link on the PREMIND website.',

  // ── 이전 앱 녹음 옮기기 (features/migration) ──────────────────────────────
  '이전 PREMIND 녹음': 'Earlier PREMIND recording',
  '기존 녹음 복구': 'Recovered recordings',
  'Flutter 앱에서 녹음한 원본을 그대로 보존하며 가져온 학습 자료예요.':
    'Study materials brought over from the earlier app, with the original recordings kept as they were.',
  '파일을 확인하지 못했어요.': "We couldn't check the file.",
  '이전 녹음을 담을 프로젝트를 만들지 못했어요.': "We couldn't create a folder for earlier recordings.",

  // ── 알림 (services/notifications) ─────────────────────────────────────────
  '마인드팩 준비 알림': 'Mind Pack ready alerts',
  '대본, 요약, 문제가 준비되면 알려 줘요.': 'Lets you know when the transcript, summary, and quiz are ready.',
  '{title}의 대본, 요약, 문제를 열어 보세요.': 'Open the transcript, summary, and quiz for {title}.',

  // ── 업로드 (services/api/resumable-upload.ts) ─────────────────────────────
  '업로드를 중단했어요.': 'Upload stopped.',
  '원본 파일을 찾을 수 없어요. 기기에서 삭제되었을 수 있어요.':
    "We can't find the original file. It may have been deleted from your device.",
  '원본 파일이 비어 있어요.': 'The original file is empty.',
  '보관된 파일 크기가 업로드 기록과 달라요. 원본을 다시 선택해 주세요.':
    "The saved file's size doesn't match the upload record. Please choose the original again.",
};
