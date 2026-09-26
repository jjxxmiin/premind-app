import type { EnDict } from '../core';

/**
 * 영어 사전 — common 영역. 키는 화면의 한국어 문장 그대로.
 * 여러 화면이 같은 뜻으로 쓰는 짧은 말만 둔다(이 사전이 다른 영역 사전보다 우선한다).
 */
export const EN_COMMON: EnDict = {
  // 없는 주소(src/app/+not-found.tsx)
  '페이지를 찾을 수 없어요': "We couldn't find this page",
  '주소가 바뀌었거나 없는 페이지예요': 'The address has changed or the page does not exist',
  // 탭(src/app/(tabs)/_layout.tsx)
  홈: 'Home',
  '홈, 내 자료': 'Home, your materials',
  이해도: 'Mastery',
  복습: 'Review',
  '복습, 자료별 이해도와 다시 볼 곳': 'Review, your mastery and what to revisit for each material',
  추가: 'Add',
  '자료 추가, 녹음하거나 파일을 올려요': 'Add material, record or upload a file',
  말하기: 'Speaking',
  연습: 'Practice',
  '연습, 발표 평가와 면접 연습': 'Practice, presentation review and interview practice',
  MY: 'Me',
  '내 정보와 설정': 'Your account and settings',

  // 공용 버튼, 머리말
  취소: 'Cancel',
  저장: 'Save',
  삭제: 'Delete',
  확인: 'OK',
  닫기: 'Close',
  뒤로: 'Back',
  만들기: 'Create',
  가져오기: 'Import',
  '다시 시도': 'Try again',
  더보기: 'More',
  바로가기: 'Open',
  검색: 'Search',
  알림: 'Notifications',
  설정: 'Settings',
  켜기: 'Turn on',
  초기화: 'Reset',
  대화상자: 'Dialog',
  '불러오는 중': 'Loading',
  '문제가 생겼어요': 'Something went wrong',
  '잠시 후 다시 시도해 주세요.': 'Please try again in a moment.',

  // 상태
  전체: 'All',
  완료: 'Done',
  '진행 중': 'In progress',
  '확인 필요': 'Needs attention',
  대기: 'Waiting',
  '준비 중': 'Getting ready',
  '생성 중': 'Generating',
  '평가 중': 'Reviewing',

  유튜브: 'YouTube',
  '유튜브 링크': 'YouTube link',
  폴더: 'Folder',
  // 문장 가운데 쓰는 자리("{folder}(으)로 옮겼어요" 에서 폴더 이름이 없을 때)
  'inline|폴더': 'the folder',
  '폴더 없음': 'No folder',

  // 사이드바 계정 칸(src/components/AppTabBar.tsx)
  'PREMIND 사용자': 'PREMIND user',
  '자료 추가': 'Add material',
};
