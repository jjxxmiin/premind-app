import type { EnDict } from '../core';

/** 영어 사전 — account 영역. 키는 화면의 한국어 문장 그대로. */
export const EN_ACCOUNT: EnDict = {
  // ── MY (profile) ──────────────────────────────────────────────────────────
  'PREMIND 사용자': 'PREMIND user',
  알림: 'Notifications',
  로그인하기: 'Sign in',
  '이 환경에서는 알림을 지원하지 않아요. 앱에서 켜 주세요.':
    "Notifications aren't supported here. Turn them on in the app.",
  '알림 권한이 꺼져 있어요. 기기 설정에서 PREMIND 알림을 허용해 주세요.':
    'Notifications are off. Allow PREMIND notifications in your device settings.',
  '알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't turn on notifications. Please try again in a moment.",
  구독: 'Subscription',
  'settings|정보': 'About',
  '사용 가이드': 'User guide',
  문의하기: 'Contact us',
  이용약관: 'Terms of Service',
  '개인정보 처리방침': 'Privacy Policy',
  '데모 종료': 'Exit demo',
  로그아웃: 'Sign out',
  '데모 초기화': 'Reset demo',
  '회원 탈퇴': 'Delete account',
  취소: 'Cancel',
  '데모를 종료하고 로그인 화면으로 돌아가요.': "You'll leave the demo and go back to the sign-in screen.",
  '이 기기에 저장된 원본은 그대로 남고, 마인드팩은 다시 로그인하면 볼 수 있어요.':
    'Originals saved on this device stay here, and you can see your Mind Packs when you sign in again.',
  '데모를 종료할까요?': 'Exit the demo?',
  '로그아웃할까요?': 'Sign out?',
  초기화: 'Reset',
  탈퇴하기: 'Delete account',
  '이 기기의 데모 자료를 모두 지워요. 다시 들어오면 예시 자료가 새로 만들어져요.':
    "This erases all demo materials on this device. You'll get fresh sample materials when you come back.",
  '폴더, 자료, 마인드팩이 모두 지워져요. 되돌릴 수 없어요.':
    'All your folders, materials, and Mind Packs will be deleted. This cannot be undone.',
  '데모를 초기화할까요?': 'Reset the demo?',
  '정말 탈퇴할까요?': 'Delete your account?',
  // The phrase to type: in English the user types DELETE (the screen compares against t('탈퇴합니다')).
  탈퇴합니다: 'DELETE',
  '계속하려면 ‘탈퇴합니다’를 입력해 주세요.': 'To continue, type ‘DELETE’.',
  '회원 탈퇴 확인 문구': 'Account deletion confirmation',
  '계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't delete your account. Please try again in a moment.",

  // ── Login ────────────────────────────────────────────────────────────────
  '면접 연습을\n이어서 시작해요': 'Pick up your\ninterview practice',
  'PREMIND 계정으로 로그인하면 면접 연습으로 바로 가요':
    "Sign in with your PREMIND account and you'll go straight to interview practice",
  '강의를 담기만 하면\n복습이 준비돼요': 'Capture a lecture,\nyour review is ready',
  '녹음 한 번으로 대본, 요약, 마인드맵, 문제까지':
    'One recording gets you a transcript, summary, mind map, and quiz',
  'PREMIND 로그인': 'PREMIND sign in',
  'PREMIND에 로그인해요': 'Sign in to PREMIND',
  '다시 만나서 반가워요': 'Good to see you again',
  // Desktop brand panel beside the sign-in and sign-up forms (AuthSplit).
  '강의 하나로\n복습까지 끝내요': 'From one lecture\nto a finished review',
  '녹음하거나 올리면 마인드팩이 만들어져요': 'Record or upload, and your Mind Pack is made',
  '대본, 요약, 마인드맵, 문제로 복습해요': 'Review with a transcript, summary, mind map, and quiz',
  '문제를 풀수록 이해도가 쌓여요': 'Every quiz you solve builds your understanding',
  '면접도 연습하면\n익숙해져요': 'Interviews get easier\nwith practice',
  '질문마다 타이머에 맞춰 답해요': 'Answer each question against a timer',
  '내가 한 말을 전사문으로 돌아봐요': 'Look back at what you said in a transcript',
  '다음에 먼저 고칠 것 하나를 알려줘요': 'Get the one thing to fix first next time',
  '(주)캐모릭스': 'Camorix Inc.',
  이메일: 'Email',
  '이메일을 입력해 주세요': 'Enter your email',
  비밀번호: 'Password',
  '비밀번호를 입력해 주세요': 'Enter your password',
  '비밀번호 숨기기': 'Hide password',
  '비밀번호 표시': 'Show password',
  로그인: 'Sign in',
  회원가입: 'Sign up',
  '비밀번호 찾기': 'Forgot password',
  또는: 'or',
  '데모로 둘러보기': 'Try the demo',
  '예시 자료로 먼저 둘러볼 수 있어요': 'Look around with sample materials first',
  '이 빌드에서는 데모로만 둘러볼 수 있어요': 'This build only offers the demo',
  '로그인하면 PREMIND 이용약관과 개인정보 처리방침에 동의한 것으로 봐요':
    "By signing in, you agree to PREMIND's Terms of Service and Privacy Policy",
  '이 빌드에서는 로그인할 수 없어요. 데모로 둘러보거나 EXPO_PUBLIC_API_URL을 설정해 주세요.':
    "You can't sign in on this build. Try the demo or set EXPO_PUBLIC_API_URL.",
  '올바른 이메일 주소를 입력해 주세요.': 'Enter a valid email address.',
  '비밀번호를 입력해 주세요.': 'Enter your password.',
  '데모를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't start the demo. Please try again in a moment.",

  // ── Sign up ──────────────────────────────────────────────────────────────
  '가입 정보를\n입력해 주세요': 'Enter your\ndetails',
  'PREMIND 회원가입': 'PREMIND sign up',
  이름: 'Name',
  '이름을 입력해 주세요': 'Enter your name',
  '8자 이상': '8+ characters',
  'password|영문': 'Letters',
  'password|숫자': 'Numbers',
  '비밀번호 확인': 'Confirm password',
  '한 번 더 입력해 주세요': 'Enter it once more',
  '모두 동의해요': 'I agree to all',
  '[필수] 이용약관': '[Required] Terms of Service',
  '이용약관 보기': 'View Terms of Service',
  '[필수] 개인정보 처리방침': '[Required] Privacy Policy',
  '개인정보 처리방침 보기': 'View Privacy Policy',
  'terms|보기': 'View',
  '가입 완료': 'Create account',
  '이미 계정이 있나요?': 'Already have an account?',
  '이름을 입력해 주세요.': 'Enter your name.',
  '이름은 80자까지 쓸 수 있어요.': 'Your name can be up to 80 characters.',
  '이메일을 입력해 주세요.': 'Enter your email.',
  '아래 조건을 모두 만족해야 해요.': 'Your password must meet all the conditions below.',
  '비밀번호를 한 번 더 입력해 주세요.': 'Enter your password once more.',
  '비밀번호가 서로 달라요.': "The passwords don't match.",
  '이 빌드에서는 가입할 수 없어요. EXPO_PUBLIC_API_URL이 설정된 빌드를 사용해 주세요.':
    "You can't sign up on this build. Use a build with EXPO_PUBLIC_API_URL set.",
  '필수 약관에 동의해 주세요.': 'Please agree to the required terms.',
  '가입하지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't create your account. Please try again in a moment.",

  // ── Social sign-in ───────────────────────────────────────────────────────
  '카카오로 계속하기': 'Continue with Kakao',
  '구글로 계속하기': 'Continue with Google',
  '간편 로그인': 'Quick sign-in',
  '필수 약관에 동의하면 간편 가입을 사용할 수 있어요.':
    'Agree to the required terms to use quick sign-up.',
  '소셜 로그인에 실패했어요.': 'Social sign-in failed.',
  '로그인을 취소했어요.': 'Sign-in was cancelled.',
  '로그인을 준비하지 못했어요.': "We couldn't get sign-in ready.",
  '구글 로그인이 지원되는 최신 앱으로 업데이트해 주세요.':
    'Please update to the latest app to sign in with Google.',
  '구글 로그인 정보를 받지 못했어요.': "We didn't receive your Google sign-in details.",
  'Google Play 서비스를 업데이트한 뒤 다시 시도해 주세요.':
    'Update Google Play services, then try again.',
  '구글 로그인이 진행 중이에요. 잠시 기다려 주세요.':
    'Google sign-in is in progress. Please wait a moment.',
  '구글 로그인을 완료하지 못했어요.': "We couldn't finish signing in with Google.",
  '로그인 요청이 일치하지 않아요. 다시 시도해 주세요.':
    "The sign-in request didn't match. Please try again.",
  '카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.':
    "We couldn't finish signing in with Kakao. Please try again.",
  '카카오 로그인 정보를 받지 못했어요.': "We didn't receive your Kakao sign-in details.",

  // ── Subscription ─────────────────────────────────────────────────────────
  월간: 'Monthly',
  '연간 (2개월 무료)': 'Yearly (2 months free)',
  '[PREMIND] 구독 문의': '[PREMIND] Subscription question',
  스탠다드: 'Standard',
  무료: 'Free',
  '지금 요금제 {planName} / 다음 갱신일 {renewsText}':
    'Current plan {planName} / Next renewal {renewsText}',
  '지금 요금제 {planName}': 'Current plan {planName}',
  '{used}분 / {limit}분': '{used} / {limit} min',
  '스탠다드가 시작됐어요': 'Standard has started',
  '구독을 복원했어요': 'Subscription restored',
  '더 많이 담고, 오래 남겨요': 'Capture more, keep it longer',
  '이번 달 처리 분량': 'Processing this month',
  '이번 달 분량을 다 썼어요. 다음 달 1일에 다시 채워져요.':
    "You've used this month's time. It refills on the 1st of next month.",
  '이용 중': 'Current plan',
  'plan|없음': 'Not included',
  'plan|포함': 'Included',
  '결제 안내': 'Billing details',
  '구독을 관리해요': 'Manage your subscription',
  '결제와 해지는 PREMIND 웹에서 진행돼요.': 'Payment and cancellation happen on the PREMIND web.',
  '결제와 해지는 {store} 구독에서 관리돼요.':
    'Payment and cancellation are managed in {store} subscriptions.',
  '지금 버전에서는 앱에서 바로 구독할 수 없어요. 스토어에서 앱을 업데이트하면 구독할 수 있어요.':
    "You can't subscribe in this version of the app. Update the app from the store to subscribe.",
  'App Store에서 해지하거나 결제 수단을 바꿔요': 'Cancel or change your payment method in the App Store',
  'Google Play에서 해지하거나 결제 수단을 바꿔요':
    'Cancel or change your payment method in Google Play',
  '구독 관리': 'Manage subscription',
  '다른 기기에서 산 구독을 가져와요': 'Bring over a subscription bought on another device',
  '구매 복원': 'Restore purchase',
  '돌아가기': 'Go back',
  '스탠다드 구독하기': 'Subscribe to Standard',
  '나중에 할게요': 'Maybe later',
  '지금은 구독 상품을 불러올 수 없어요. 스토어에 상품이 준비되면 바로 구독할 수 있어요.':
    "We can't load subscription products right now. You can subscribe as soon as they're ready in the store.",
  '구독 시작하기': 'Start subscription',
  '결제 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't open checkout. Please try again in a moment.",

  // Plan benefits table (data/subscription-plans.ts)
  '월 처리 분량': 'Monthly processing',
  '120분': '120 min',
  '1,200분': '1,200 min',
  '마인드팩 자동 생성': 'Automatic Mind Packs',
  '우선 처리': 'Priority processing',
  '자료에 질문': 'Ask your materials',
  '하루 10회': '10 a day',
  무제한: 'Unlimited',
  '발표 평가': 'Presentation review',
  '체험 1회': '1 trial',
  '월 5회': '5 a month',
  '면접 AI 피드백': 'Interview AI feedback',
  '월 10회': '10 a month',
  '유튜브 링크': 'YouTube links',
  '월 3개': '3 a month',
  '보관 기간': 'Storage period',
  '30일': '30 days',
  '대본, 요약 내보내기': 'Export transcripts and summaries',
  '원본 클라우드 백업': 'Cloud backup of originals',

  // Purchase notices (features/billing/purchase-machine.ts)
  'Google Play에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't connect to Google Play. Please try again in a moment.",
  '상품 정보를 아직 못 불러왔어요. 잠시 후 다시 시도해 주세요.':
    "Product details haven't loaded yet. Please try again in a moment.",
  '결제가 승인되지 않았어요. 결제 수단을 확인하고 다시 시도해 주세요.':
    "The payment wasn't approved. Check your payment method and try again.",
  '이 기기에서는 결제를 진행할 수 없어요.': "Payments aren't available on this device.",
  '네트워크 연결을 확인하고 다시 시도해 주세요.': 'Check your network connection and try again.',
  '결제를 마치지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't complete the payment. Please try again in a moment.",
  '스탠다드가 시작됐어요. 바로 쓸 수 있어요.': 'Standard has started. You can use it right away.',
  '결제가 접수됐어요. 반영되면 스탠다드로 바뀌어요.':
    "Your payment was received. You'll switch to Standard once it goes through.",
  '이미 구독 중인 계정이에요. 구매 복원을 눌러 주세요.':
    'This account is already subscribed. Tap Restore purchase.',
  '결제 승인을 기다리고 있어요. 승인되면 스탠다드가 켜져요.':
    "We're waiting for payment approval. Standard turns on once it's approved.",
  '구독을 복원했어요.': 'Subscription restored.',
  '복원할 구독이 없어요. 구매한 Google 계정으로 로그인했는지 확인해 주세요.':
    "There's no subscription to restore. Check that you're signed in with the Google account you bought it with.",
  '구매를 복원하지 못했어요. 잠시 후 다시 시도해 주세요.':
    "We couldn't restore your purchase. Please try again in a moment.",
  '결제가 확인됐어요. 계정에 반영되기까지 잠시 걸릴 수 있어요.':
    'Payment confirmed. It may take a moment to show up on your account.',
  '결제는 끝났어요. 계정 반영이 늦어지면 앱을 다시 열어 주세요.':
    "Your payment went through. If your account doesn't update soon, reopen the app.",
  '구독 정보를 계정에 반영하지 못했어요.': "We couldn't apply the subscription to your account.",

  // ── User guide ───────────────────────────────────────────────────────────
  '녹음 한 번으로 복습까지': 'From one recording to review',
  '처음이라면 순서대로 따라해 보세요': "New here? Follow along step by step",
  '전체 흐름: {items}': 'How it works: {items}',
  '전체 흐름': 'How it works',
  '녹음, 올리기': 'Record, upload',
  마인드팩: 'Mind Pack',
  이해도: 'Mastery',
  말하기: 'Speaking',
  '메일 앱이 열려요': 'Opens your mail app',
  'guide|접어요': 'Collapse',
  'guide|펼쳐요': 'Expand',
  'guide|시작하기': 'Getting started',
  '가입하면 바로 시작할 수 있어요': 'Start right after you sign up',
  '이메일이나 소셜 계정으로 가입하면 바로 무료로 시작해요.':
    'Sign up with email or a social account and start for free right away.',
  '녹음 탭을 누르거나 파일을 올리면 첫 마인드팩이 만들어져요.':
    'Record or upload a file, and your first Mind Pack is made.',
  '알림과 녹음 품질은 MY 탭에서 언제든 바꿀 수 있어요.':
    'You can change notifications and recording quality anytime in the Me tab.',
  '녹음 / 영상, 음성, 문서 / 유튜브 링크': 'Recording / video, audio, documents / YouTube links',
  '녹음하면 원본을 기기에 먼저 저장해요.': 'When you record, the original is saved on your device first.',
  '영상, 음성 파일을 올려도 같은 방식으로 마인드팩을 만들어요.':
    'Upload video or audio files and you get a Mind Pack the same way.',
  'PDF와 PPTX는 쪽 단위로 읽어서 같은 마인드팩을 만들어요. 소리가 없으니 평가만 빼고 다 돼요.':
    "PDF and PPTX files are read page by page into the same Mind Pack. There's no audio, so everything works except reviews.",
  '공개 유튜브 링크를 붙여 넣으면 내려받지 않고 대본을 만들어요.':
    'Paste a public YouTube link and we make a transcript without downloading it.',
  '끊긴 업로드는 같은 자료로 이어서 올려요. 중복이 생기지 않아요.':
    'An interrupted upload picks up on the same material, so no duplicates are made.',
  '대본 / 요약 / 마인드맵 / 문제 / 질문': 'Transcript / summary / mind map / quiz / questions',
  '대본의 시점을 누르면 그 순간으로 바로 이동해요.':
    'Tap a timestamp in the transcript to jump right to that moment.',
  '요약은 한눈에 보기와 꼭 기억할 내용으로 짧게 정리돼요. 확인한 내용은 체크해 두세요.':
    'The summary is a short overview plus the key points to remember. Check off what you have reviewed.',
  '마인드맵은 개념 사이의 관계를 그림으로 보여줘요.':
    'The mind map shows how concepts connect as a picture.',
  '아래의 "이 자료에 물어보기"를 누르면 대본을 근거로 답해 줘요.':
    'Tap "Ask this material" at the bottom to get answers based on the transcript.',
  '복습과 연습': 'Review and Practice',
  '복습 탭 / 연습 탭': 'Review tab / Practice tab',
  '복습 탭은 푼 문제와 확인한 핵심 내용으로 자료마다 이해도를 계산해요.':
    'The Review tab works out your mastery of each material from the quizzes you solved and the key points you checked.',
  '헷갈린 개념은 다시 들을 시점과 함께 알려줘요.':
    'Confusing spots come with the moment to listen to again.',
  '연습 탭의 발표는 내 발표나 스피치 연습을 녹음하면 구조, 명료성, 근거, 전달력을 채점해요.':
    'In the Practice tab, record a presentation or speech practice and Presentation review scores its structure, clarity, evidence, and delivery.',
  '연습 탭의 면접은 질문에 타이머 맞춰 답하고, 내가 한 말을 전사문과 피드백으로 돌아봐요.':
    'In the Practice tab, interview practice has you answer questions on a timer, then look back at what you said with a transcript and feedback.',
  '먼저 고칠 것 하나만 다음 연습에서 바꿔 보세요.':
    'Pick just one thing to fix first and change it in your next practice.',
  '무료와 스탠다드': 'Free and Standard',
  '무료로도 모든 기능을 써요': 'Every feature works on Free',
  '녹음, 올리기, 마인드팩, 질문, 평가까지 무료로 모두 써요.':
    'Recording, uploads, Mind Packs, questions, and reviews are all free to use.',
  '무료는 한 달에 120분까지 처리해요. 스탠다드는 1,200분까지 늘어나요.':
    'Free processes up to 120 minutes a month. Standard raises that to 1,200 minutes.',
  '지금 어떤 요금제인지는 MY 탭의 구독에서 확인해요.':
    'See which plan you are on under Subscription in the Me tab.',

  // ── 2026-09-26 덜어내기 ────────────────────────────────────────────────────
  '언어 / Language': 'Language / 언어',
  '혜택 모두 보기': 'See all benefits',
};
