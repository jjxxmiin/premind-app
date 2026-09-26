import type { EnDict } from '../core';

/** 영어 사전 — home 영역. 키는 화면의 한국어 문장 그대로. */
export const EN_HOME: EnDict = {
  // ── 홈(src/app/(tabs)/index.tsx) ─────────────────────────────────────────
  저장함: 'Saved',
  '전체 {n}개': 'All, {n}',
  '완료 {n}개': 'Done, {n}',
  '진행 중 {n}개': 'In progress, {n}',
  '확인 필요 {n}개': 'Needs attention, {n}',
  '공개 유튜브 영상 주소를 확인해 주세요.': 'Check that this is a public YouTube video link.',
  '먼저 폴더를 만들어 주세요.': 'Create a folder first.',
  '링크를 가져오지 못했어요. 주소를 확인하고 다시 시도해 주세요.':
    "We couldn't import the link. Check the address and try again.",
  '새 폴더': 'New folder',
  '폴더 이름을 입력해 주세요.': 'Enter a folder name.',
  '폴더를 만들지 못했어요. 다시 시도해 주세요.': "We couldn't create the folder. Please try again.",
  '아직 평가할 수 없어요': "You can't review this yet",
  '마인드팩이 준비되면 평가할 수 있어요.': 'You can review it once the Mind Pack is ready.',
  '평가를 시작하지 못했어요': "We couldn't start the review",
  '{folder}(으)로 옮겼어요': 'Moved to {folder}',
  '옮기지 못했어요': "Couldn't move it",
  '제목을 입력해 주세요.': 'Enter a title.',
  '이름을 바꾸지 못했어요. 다시 시도해 주세요.': "We couldn't rename it. Please try again.",
  '삭제하지 못했어요': "Couldn't delete it",
  '저장을 해제했어요': 'Removed from Saved',
  '저장함에 담았어요': 'Added to Saved',
  '이 상태의 자료가 없어요': 'No materials with this status',
  '저장한 자료가 없어요': 'No saved materials',
  '아직 자료가 없어요': 'No materials yet',
  '필터를 바꾸면 다른 자료를 볼 수 있어요.': 'Change the filter to see other materials.',
  '자료 메뉴에서 저장하면 여기에 모여요.': 'Save materials from their menu and they show up here.',
  '녹음하거나 파일을 올리면 대본, 요약, 마인드맵, 문제가 여기에 모여요':
    'Record or upload a file, and its transcript, summary, mind map and quiz show up here',
  '안내 닫기': 'Dismiss',
  '정렬, 상태, 보기 방식을 바꿔요': 'Change the sort, status and view',
  '{sort}, 필터 적용됨': '{sort}, filtered',
  '녹음 시작': 'Start recording',
  '폴더별 자료, {folder}. 좌우로 밀어 폴더를 바꿔요':
    'Materials by folder, {folder}. Swipe left or right to switch folders',
  '녹음하거나 파일을 올리면 마인드팩이 만들어져요.':
    'Record or upload a file and we make a Mind Pack from it.',
  '자료 추가': 'Add material',
  '바로 녹음을 시작해요': 'Starts recording right away',
  '강의나 발표를 그 자리에서': 'A lecture or talk, right where you are',
  녹음하기: 'Record',
  '파일 앱에서 골라요': 'Pick from your files',
  'PDF, 슬라이드, 영상, 음성': 'PDF, slides, video, audio',
  '파일 올리기': 'Upload a file',
  '공개 유튜브 영상 주소를 붙여 넣어요': 'Paste a public YouTube video link',
  '공개 영상 주소를 붙여 넣어요': 'Paste a public video link',
  '이 자료를 담을 폴더를 골라요.': 'Choose a folder for this material.',
  '폴더 옮기기': 'Move to folder',
  '이미 이 폴더에 있어요.': "It's already in this folder.",
  '이 폴더로 옮겨요.': 'Moves it to this folder.',
  '지금 이 폴더에 있어요': 'In this folder now',
  '폴더 만들기': 'Create a folder',
  '자료를 담을 폴더가 아직 없어요': "You don't have a folder for materials yet",
  '폴더가 없어요': 'No folders',
  '자료 메뉴': 'Material menu',
  '마인드팩 열기': 'Open Mind Pack',
  '진행 상황 보기': 'See progress',
  '평가하고 있어요': 'Reviewing now',
  '평가 결과 보기': 'See the review',
  평가하기: 'Review',
  '저장 취소': 'Unsave',
  저장하기: 'Save',
  '이름 바꾸기': 'Rename',
  '폴더별로 자료를 묶어 두면 찾기 쉬워요.': 'Group materials by folder to find them easily.',
  '폴더 이름': 'Folder name',
  '예: 인공지능 개론': 'e.g. Intro to AI',
  '학기 (선택)': 'Term (optional)',
  학기: 'Term',
  '예: 2026학년도 2학기': 'e.g. Fall 2026',
  '공개 영상 주소를 붙여 넣어 주세요. 영상은 내려받지 않아요.':
    "Paste a public video link. We don't download the video.",
  '유튜브 주소': 'YouTube link',
  제목: 'Title',
  '자료 제목': 'Material title',
  '“{title}”의 원본, 대본, 마인드팩이 모두 지워져요. 되돌릴 수 없어요.':
    'The original, transcript and Mind Pack for “{title}” will all be deleted. This can’t be undone.',
  '자료를 삭제할까요?': 'Delete this material?',

  // ── 목록(src/components/home/*) ─────────────────────────────────────────
  최신순: 'Newest',
  오래된순: 'Oldest',
  이름순: 'Name',
  '자료 {n}개': { one: '{n} material', other: '{n} materials' },
  '자료 {total}개 중 {n}개': '{n} of {total} materials',
  '자료 없음': 'No materials',
  '저장한 자료 {n}개': { one: '{n} saved material', other: '{n} saved materials' },
  '저장한 자료 {total}개 중 {n}개': '{n} of {total} saved materials',
  '저장한 자료 없음': 'No saved materials',
  '마인드팩이 준비됐어요': 'Your Mind Pack is ready',
  '만들지 못했어요. 눌러서 다시 시도해 주세요.': "We couldn't make it. Tap to try again.",
  가져옴: 'Imported',
  '원본만 저장했어요. 눌러서 마인드팩을 만들어요.':
    'Only the original is saved. Tap to make the Mind Pack.',
  이어가기: 'Resume',
  '멈춰 있어요. 눌러서 이어가요.': "It's paused. Tap to continue.",
  '대본 생성': 'Transcribing',
  '{title} 메뉴': '{title} menu',
  '자료를 열어요': 'Opens the material',
  '{folder} 자료': '{folder} materials',
  '{folder} 자료 {n}개': { one: '{folder}, {n} material', other: '{folder}, {n} materials' },
  '새 폴더를 만들어요': 'Creates a new folder',
  카드: 'Cards',
  목록: 'List',
  '정렬과 필터를 처음 상태로 되돌려요': 'Resets sort and filters',
  '정렬과 필터': 'Sort and filter',
  정렬: 'Sort',
  상태: 'Status',
  '자료 상태 필터': 'Material status filter',
  '저장한 자료만 보기, {n}개': 'Show saved materials only, {n}',
  '저장한 자료만': 'Saved only',
  보기: 'View',

  // ── 검색(src/app/search.tsx) ─────────────────────────────────────────────
  검색어: 'Search',
  '제목, 파일명, 폴더': 'Title, file name, folder',
  '검색어 지우기': 'Clear search',
  '다른 말로 다시 찾아보세요': 'Try different words',
  '검색 결과가 없어요': 'No results',
  '자료 제목과 파일 이름, 폴더 이름에서 찾아요. 대본은 자료를 연 뒤 그 안에서 검색해요.':
    'Searches material titles, file names and folder names. To search a transcript, open the material and search inside it.',
  '무엇을 찾을까요?': 'What are you looking for?',
  '“{query}” 검색 결과 {n}개': { one: '{n} result for “{query}”', other: '{n} results for “{query}”' },

  // ── 알림(src/app/notifications.tsx) ──────────────────────────────────────
  '준비 완료': 'Ready',
  '대본, 요약, 마인드맵, 문제를 바로 볼 수 있어요.':
    'Your transcript, summary, mind map and quiz are ready to view.',
  '마인드팩을 만들지 못했어요': "We couldn't make the Mind Pack",
  '원본은 그대로 있어요. 눌러서 다시 시도해 주세요.': 'Your original is safe. Tap to try again.',
  '마인드팩을 만들고 있어요': 'Making your Mind Pack',
  '알림이 꺼져 있어요': 'Notifications are off',
  '켜면 마인드팩이 준비될 때 알려드려요.': "Turn them on and we'll tell you when a Mind Pack is ready.",
  '마인드팩을 만들면 진행 소식이 여기에 모여요': 'Updates show up here when you make a Mind Pack',
  '아직 알림이 없어요': 'No notifications yet',
  '최근 소식': 'Recent',

  // ── 공용 UI(src/components/ui/*, AppHeader, BrandSplash, MediaArtwork) ─────
  '진행 단계': 'Progress',
  '{label}. {count}단계 중 {n}단계. {spoken}': '{label}. Step {n} of {count}. {spoken}',
  '{summary}. 미리보기 열기': '{summary}. Open preview',
  'PREMIND 활용 팁': 'PREMIND tips',
  '두 번 탭하면 열려요.': 'Double-tap to open.',
  '수업을 담기만 하면 복습이 준비돼요': 'Capture your class, and your review is ready',
  'AI 정리 중': 'AI is organizing',

  // ── 유튜브 재생 오류(src/lib/youtube-embed.ts) ──────────────────────────
  '이 영상은 다른 앱에서 재생할 수 없게 설정돼 있어요. 유튜브에서 보고 돌아오세요. 대본과 요약은 그대로 볼 수 있어요.':
    "This video can't be played in other apps. Watch it on YouTube and come back. Your transcript and summary are still here.",
  '영상을 찾을 수 없어요. 삭제됐거나 비공개로 바뀌었을 수 있어요. 대본과 요약은 그대로 볼 수 있어요.':
    "We can't find this video. It may have been deleted or made private. Your transcript and summary are still here.",
  '영상 주소를 읽지 못했어요. 링크를 다시 올려 주세요.': "We couldn't read the video link. Please add the link again.",
  '영상을 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.':
    "We couldn't load the video. Check your connection and try again.",
  '재생하다가 멈췄어요. 다시 시도하거나 유튜브에서 보세요.':
    'Playback stopped. Try again or watch it on YouTube.',
  '이 영상을 앱 안에서 열지 못했어요. 다시 시도하거나 유튜브에서 보세요. 대본과 요약은 그대로 볼 수 있어요.':
    "We couldn't open this video in the app. Try again or watch it on YouTube. Your transcript and summary are still here.",
  '영상이 열리지 않아요. 다시 시도하거나 유튜브에서 보세요. 대본과 요약은 그대로 볼 수 있어요.':
    "The video won't open. Try again or watch it on YouTube. Your transcript and summary are still here.",

  // ── 올리기(src/features/import/*) ───────────────────────────────────────
  '파일 크기를 확인할 수 없어요. 다른 위치에서 다시 선택해 주세요.':
    "We can't tell the file size. Please choose it again from another location.",
  '4GB 이하의 파일을 선택해 주세요.': 'Choose a file of 4 GB or less.',
  '40MB 이하의 파일을 선택해 주세요.': 'Choose a file of 40 MB or less.',
  '선택한 파일 정보를 가져오지 못했어요. 다시 선택해 주세요.':
    "We couldn't read the file you chose. Please choose it again.",
  '음성, 영상, PDF 또는 PPTX 파일을 선택해 주세요.': 'Choose an audio, video, PDF or PPTX file.',
  '선택한 원본 파일을 읽을 수 없어요. 다시 선택해 주세요.':
    "We can't read the file you chose. Please choose it again.",
  '원본 파일을 기기에 안전하게 보관하지 못했어요. 저장 공간을 확인해 주세요.':
    "We couldn't keep the original file safely on your device. Check your storage.",
  'Wi-Fi가 아니에요': "You're not on Wi-Fi",
  '지금 올리면 이동통신 데이터로 {size}를 보내요. 요금이 나올 수 있어요.':
    'Uploading now sends {size} over mobile data. You may be charged.',
  '지금 올리면 이동통신 데이터로 보내요. 요금이 나올 수 있어요.':
    'Uploading now uses mobile data. You may be charged.',

  // ── 브라우저 원본 보관(src/features/files/*) ────────────────────────────
  '녹음 복구 ID를 확인하지 못했어요.': "We couldn't verify the recording recovery ID.",
  '이 브라우저에서는 로컬 원본 보관을 사용할 수 없어요.':
    "This browser can't keep originals locally.",
  '브라우저 저장소를 열지 못했어요.': "We couldn't open the browser storage.",
  '녹음 복구 조각을 읽지 못했어요.': "We couldn't read a recording recovery chunk.",
  '녹음 복구 조각 정보를 확인하지 못했어요.': "We couldn't verify the recording recovery chunk.",
  '녹음 복구 조각을 보관하지 못했어요.': "We couldn't save a recording recovery chunk.",
  '녹음 복구 조각 보관이 중단됐어요.': 'Saving a recording recovery chunk was interrupted.',
  '복구할 수 있는 녹음 원본 조각이 아직 없어요.': 'There are no recording chunks to recover yet.',
  '보관된 녹음 원본이 비어 있어요.': 'The saved recording is empty.',
  '녹음 복구 조각을 정리하지 못했어요.': "We couldn't clean up the recording recovery chunks.",
  '녹음 복구 조각 정리가 중단됐어요.': 'Cleaning up the recording recovery chunks was interrupted.',
  '브라우저 원본을 삭제하지 못했어요.': "We couldn't delete the original from the browser.",
  '브라우저 원본 삭제가 중단됐어요.': 'Deleting the original from the browser was interrupted.',
  '보관된 원본을 읽지 못했어요.': "We couldn't read the saved original.",
  '브라우저에 원본을 보관하지 못했어요.': "We couldn't save the original in the browser.",
  '브라우저 원본 보관이 중단됐어요.': 'Saving the original in the browser was interrupted.',
  '브라우저 저장소에서 원본을 찾지 못했어요.': "We couldn't find the original in the browser storage.",
  '브라우저가 선택한 원본을 읽지 못했어요.': "The browser couldn't read the file you chose.",
  '선택한 원본 파일이 비어 있어요.': 'The file you chose is empty.',
  '브라우저 저장 공간에 원본을 보관하지 못했어요. 저장 공간을 확인해 주세요.':
    "We couldn't save the original in the browser's storage. Check your storage space.",
  '이 브라우저에서는 서버 원본 스트리밍을 지원하지 않아요.':
    "This browser doesn't support streaming the original from the server.",
  '보안 스트리밍을 준비하지 못했어요. 페이지를 새로고침해 주세요.':
    "We couldn't set up secure streaming. Please refresh the page.",
  '서버 원본 스트리밍 설정이 지연되고 있어요.': 'Setting up streaming from the server is taking a while.',
  '서버 원본 스트리밍을 설정하지 못했어요.': "We couldn't set up streaming from the server.",
  '갱신할 미디어 세션이 없어요.': 'There is no media session to refresh.',

  // ── 데스크톱 홈(src/components/home/HomeDesktop.tsx) ─────────────────────
  '안녕하세요, {name}님': 'Hi, {name}',
  '이어서 보기': 'Continue',
  '이어서 보기, {title}': 'Continue, {title}',
};
