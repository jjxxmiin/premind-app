import { setDynamicFallback, type EnDict } from '../core';

/**
 * 영어 사전 — server 영역. 학생 서버(premind-recorder-api)와 앱의 API 클라이언트(services/api)가 보내는
 * 한국어 오류, 안내 문장의 영어. 화면은 받은 문장을 t(message) 로 그려서 영어 화면에서 여기 영어가 나온다.
 * 서버 문장이 바뀌면 여기도 같이 바꿀 것. 면접 쪽 문장은 면접 웹 apps/interview/lib/i18n/server-messages.ts 와 같다.
 */
export const EN_SERVER: EnDict = {
  // ── 면접, 로그인, 기관 (면접 웹 server-messages.ts 와 같은 문장) ──────────────
  // 면접 서버 공통 (lib/server/api-guard.ts, ops-route.ts, student-api.ts, accounts.ts, student-auth.ts)
  "이 페이지에서 다시 시도해 주세요.": "Please try again from this page.",
  "요청을 확인해 주세요.": "Please check your request.",
  "로그인이 필요해요. 다시 로그인해 주세요.": "You need to log in. Please log in again.",
  "이 연습의 사용이 확인되지 않았어요. 연습을 다시 시작해 주세요.": "We couldn't confirm this practice. Please start the practice again.",
  "오늘 사용할 수 있는 AI 요청 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.": "You've used all of today's AI requests. Please try again tomorrow.",
  "운영자만 볼 수 있어요.": "Only admins can see this.",
  "서버 설정이 끝나지 않았어요. 잠시 후 다시 시도해 주세요.": "The server isn't fully set up yet. Please try again in a moment.",
  "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't connect to the server. Please try again in a moment.",
  "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't process your request. Please try again in a moment.",
  "학생 계정 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't connect to the student account server. Please try again in a moment.",
  "로그인이 만료됐어요. 다시 로그인해 주세요.": "Your login has expired. Please log in again.",
  "학생 계정을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't verify your student account. Please try again in a moment.",
  "학생 계정 정보를 읽지 못했어요.": "We couldn't read your student account details.",
  // 로그인, 가입, 계정 (app/api/auth/*, app/api/account)
  "로그인 방식이 바뀌었어요. 화면을 새로고침한 뒤 PREMIND 학생 계정(이메일)으로 로그인해 주세요.": "The way you log in has changed. Refresh the page and log in with your PREMIND student account (email).",
  "로그인 정보를 받지 못했어요. 다시 시도해 주세요.": "We didn't receive your login details. Please try again.",
  "로그인 시도가 너무 많아요. 잠시 후 다시 시도해 주세요.": "Too many login attempts. Please try again in a moment.",
  "운영자 계정은 여기서 삭제할 수 없어요.": "Admin accounts can't be deleted here.",
  "확인 문구를 입력해 주세요.": "Please type the confirmation phrase.",
  // 기관, 초대 코드, 공유 (app/api/org/*, app/api/invites, app/api/auth/join)
  "기관 담당자만 볼 수 있어요.": "Only institution managers can see this.",
  "기관 담당자만 만들 수 있어요.": "Only institution managers can create this.",
  "기관 담당자만 마감할 수 있어요.": "Only institution managers can close this.",
  "공유할 연습 내용을 확인해 주세요.": "Please check the practice you want to share.",
  "사용할 수 없는 초대 코드예요. 담당 선생님이나 센터에 확인해 주세요.": "This invite code can't be used. Please check with your teacher or center.",
  "잠시 후 다시 시도해 주세요.": "Please try again in a moment.",
  "초대 코드를 확인해 주세요.": "Please check the invite code.",
  "참여 현황 공유에 동의해 주세요.": "Please agree to share your participation status.",
  "만 14세 이상만 참여할 수 있어요. 만 14세 미만은 보호자 동의 절차가 필요해 지금은 참여할 수 없어요.": "You must be 14 or older to join. Users under 14 need a guardian consent process, so they can't join for now.",
  "오늘은 참여를 더 받을 수 없어요. 내일 다시 시도해 주세요.": "We can't accept more people joining today. Please try again tomorrow.",
  // 문의, 백업 (lib/server/inquiries.ts, app/api/access-requests, app/api/backups)
  "만 14세 이상만 문의할 수 있어요.": "You must be 14 or older to send an inquiry.",
  "이름, 이메일과 개인정보 수집 동의를 확인해 주세요.": "Please check your name, email, and consent to the collection of personal information.",
  "오늘은 문의를 더 받을 수 없어요. 내일 다시 시도해 주세요.": "We can't accept more inquiries today. Please try again tomorrow.",
  "백업할 기록을 확인해 주세요.": "Please check the record you want to back up.",
  "영상과 음성은 백업하지 않아요.": "Video and audio are not backed up.",
  "면접 연습": "Interview practice",
  // 1문항 체험 (app/api/trial)
  "체험할 질문을 골라 주세요.": "Please choose a question to try.",
  "체험은 90초까지 답할 수 있어요.": "In the free trial, you can answer for up to 90 seconds.",
  "3초 이상 말해 주세요.": "Please speak for at least 3 seconds.",
  "20자 이상 적어 주세요.": "Please write at least 20 characters.",
  "오늘 체험 횟수를 다 썼어요. 무료로 가입하고 계속 연습해 보세요.": "You've used today's free tries. Sign up for free to keep practicing.",
  "말소리가 잘 들리지 않았어요. 조금 더 크게 다시 말해 주세요.": "We couldn't hear you clearly. Please try again a little louder.",
  "피드백을 만들지 못했어요. 다시 시도해 주세요.": "We couldn't create feedback. Please try again.",
  "녹음을 읽지 못했어요. 다시 녹음하거나 글로 답해 주세요.": "We couldn't read the recording. Record again or answer in writing.",
  "답변 내용을 조금 더 길게 해 주세요.": "Please make your answer a little longer.",
  "지금은 AI가 바빠요. 잠시 후 다시 시도해 주세요.": "The AI is busy right now. Please try again in a moment.",
  "체험을 처리하지 못했어요.": "We couldn't process your free trial.",
  // AI 피드백: 요청 경계 (lib/interview/transcription-route.server.ts, guided-route.server.ts)
  "입력 내용을 확인해 주세요.": "Please check what you entered.",
  "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.": "Too many requests. Please try again in a moment.",
  "AI 피드백 사용량 설정을 확인하고 있어요.": "We're checking the AI feedback usage settings.",
  "오늘 사용할 수 있는 AI 피드백 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.": "You've used all of today's AI feedback. Please try again tomorrow.",
  "요청 형식을 확인해 주세요.": "Please check the request format.",
  "요청 크기가 너무 커요.": "The request is too large.",
  "AI 피드백 동시 실행 설정을 확인하고 있어요.": "We're checking the AI feedback concurrency settings.",
  "다른 답변을 분석하고 있어요. 잠시 후 다시 시도해 주세요.": "Another answer is being analyzed. Please try again in a moment.",
  "AI 피드백을 준비하지 못했어요.": "We couldn't get AI feedback ready.",
  "음성 파일이 너무 커요.": "The audio file is too large.",
  "음성 업로드 시간이 초과됐어요. 연결을 확인한 뒤 다시 시도해 주세요.": "The audio upload timed out. Check your connection and try again.",
  "음성 요청을 확인해 주세요.": "Please check the audio request.",
  "평가 내용이 너무 길어요.": "The content to evaluate is too long.",
  "평가 요청 전송 시간이 초과됐어요. 다시 시도해 주세요.": "Sending the evaluation request timed out. Please try again.",
  "평가 내용을 확인해 주세요.": "Please check the content to evaluate.",
  // AI 피드백: 답변 평가 (app/api/interview/evaluate)
  "답변 평가 서비스를 준비하지 못했어요.": "We couldn't get the answer evaluation service ready.",
  "답변 평가 시간이 초과됐어요. 다시 시도해 주세요.": "Evaluating your answer timed out. Please try again.",
  "AI 답변 평가 요청이 많아요. 잠시 후 다시 시도해 주세요.": "There are a lot of AI evaluation requests right now. Please try again in a moment.",
  "답변 평가 서비스 설정을 확인하고 있어요.": "We're checking the answer evaluation service settings.",
  "현재 답변 내용으로 피드백을 만들 수 없어요.": "We can't create feedback from this answer.",
  "유효한 피드백을 만들지 못했어요. 다시 시도해 주세요.": "We couldn't create valid feedback. Please try again.",
  "답변을 평가하지 못했어요. 다시 시도해 주세요.": "We couldn't evaluate your answer. Please try again.",
  "답변을 평가하지 못했어요.": "We couldn't evaluate your answer.",
  // AI 피드백: 음성 전사 (app/api/interview/transcribe)
  "지원하지 않는 음성 형식이에요.": "This audio format isn't supported.",
  "음성 전사 서비스를 준비하지 못했어요.": "We couldn't get the transcription service ready.",
  "음성 전사 시간이 초과됐어요. 다시 시도해 주세요.": "Transcription timed out. Please try again.",
  "AI 음성 전사 요청이 많아요. 잠시 후 다시 시도해 주세요.": "There are a lot of AI transcription requests right now. Please try again in a moment.",
  "음성 전사 서비스 설정을 확인하고 있어요.": "We're checking the transcription service settings.",
  "이 음성을 전사할 수 없어요. 답변을 다시 녹음해 주세요.": "We can't transcribe this audio. Please record your answer again.",
  "음성을 전사하지 못했어요. 다시 시도해 주세요.": "We couldn't transcribe the audio. Please try again.",
  "한 답변은 최대 5분까지만 전사할 수 있어요. 이 질문을 다시 답변해 주세요.": "Each answer can be transcribed for up to 5 minutes. Please answer this question again.",
  "음성 길이 확인 서비스를 준비하지 못했어요.": "We couldn't get the audio length check ready.",
  "음성 길이를 확인하지 못했어요. 이 질문을 다시 답변해 주세요.": "We couldn't check the audio length. Please answer this question again.",
  "답변 시간이 너무 짧아요. 3초 이상 답변해 주세요.": "Your answer is too short. Please answer for at least 3 seconds.",
  "음성을 전사하지 못했어요.": "We couldn't transcribe the audio.",
  // AI 질문 만들기 (app/api/interview/guided, guided/expand)
  "질문을 준비하지 못했습니다.": "We couldn't prepare the questions.",
  "AI 질문 생성 서비스를 준비하지 못했어요.": "We couldn't get the AI question service ready.",
  "질문 생성 시간이 초과됐어요. 다시 시도해 주세요.": "Creating questions timed out. Please try again.",
  "AI가 유효한 질문을 만들지 못했어요. 다시 시도해 주세요.": "The AI couldn't create valid questions. Please try again.",
  "AI 질문을 만들지 못했어요. 다시 시도해 주세요.": "We couldn't create AI questions. Please try again.",
  // 학생 서버 면접 API (premind-recorder-api app/interview/routes.py, service.py)
  "로그아웃된 세션이에요. 다시 로그인해 주세요.": "This session has been logged out. Please log in again.",
  "그룹 이름과 인원(1~500명)을 확인해 주세요.": "Please check the group name and size (1 to 500 people).",
  "기관 초대 코드로 참여한 계정만 공유할 수 있어요.": "Only accounts that joined with an institution invite code can share.",
  "백업을 찾을 수 없어요.": "We couldn't find the backup.",
  "이름과 이메일을 확인해 주세요.": "Please check the name and email.",
  "기관을 찾을 수 없어요.": "We couldn't find the institution.",
  "처리할 항목을 찾지 못했어요.": "We couldn't find the item to process.",
  "온라인 결제를 준비하고 있어요. 결제 문의로 알려 주시면 바로 안내해 드려요.": "Online payment is being set up. Send us a payment inquiry and we'll help you right away.",
  "결제 창을 열지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't open the payment page. Please try again in a moment.",
  "대학 취업진로센터": "University career center",
  "대학일자리플러스센터": "University Job Plus Center",
  "고등학교": "High school",
  "기타 기관": "Other institution",
  "계정을 찾을 수 없어요. 다시 로그인해 주세요.": "We couldn't find your account. Please log in again.",
  "다른 창에서 같은 연습을 시작하고 있어요. 잠시 후 다시 시도해 주세요.": "The same practice is starting in another window. Please try again in a moment.",
  "시작 대기 시간이 지났어요. 다시 시도해 주세요.": "Waiting to start took too long. Please try again.",
  "운영자나 담당자 계정은 초대 코드로 참여할 수 없어요.": "Admin and manager accounts can't join with an invite code.",
  "이미 이 기관에 참여하고 있어요.": "You've already joined this institution.",
  "이미 다른 기관에 참여하고 있어요. 기관을 옮기려면 문의하기로 알려 주세요.": "You've already joined another institution. To switch institutions, please send us an inquiry.",
  "사용 중인 초대 코드가 너무 많아요. 필요 없는 코드를 마감해 주세요.": "Too many invite codes are active. Please close the ones you don't need.",
  "그룹 없음": "No group",
  "학생 계정 이메일을 확인해 주세요.": "Please check the student account email.",
  "역할을 확인해 주세요.": "Please check the role.",
  "담당자는 기관을 정해야 해요.": "A manager must be assigned to an institution.",
  "기관 종류를 골라 주세요.": "Please choose the institution type.",
  "기관 이름을 입력해 주세요.": "Please enter the institution name.",
  "기간은 1~730일로 입력해 주세요.": "Please enter a period of 1 to 730 days.",
  "그 이메일의 학생 계정을 찾을 수 없어요.": "We couldn't find a student account with that email.",
  // 학생 서버 가입, 로그인 (premind-recorder-api app/auth/routes.py, 로그인 화면이 detail 을 그대로 보여 준다)
  "비밀번호는 8자 이상 256자 이하로 입력해주세요.": "Your password must be 8 to 256 characters.",
  "비밀번호에 영문자와 숫자를 각각 1자 이상 포함해주세요.": "Your password must include at least one letter and one number.",
  "올바른 이메일 주소를 입력해주세요.": "Please enter a valid email address.",
  "이름은 1자 이상 80자 이하로 입력해주세요.": "Your name must be 1 to 80 characters.",
  "잠시 후 다시 시도해주세요": "Please try again in a moment.",
  "이미 가입된 이메일이에요": "This email is already registered.",
  "이미 가입된 이메일이에요. 기존에 가입한 방법으로 로그인해 주세요.": "This email is already registered. Please log in the way you signed up before.",
  "이 서버에는 해당 소셜 로그인이 설정되어 있지 않아요.": "This social login isn't set up on this server.",
  "사용할 수 없는 계정이에요.": "This account can't be used.",
  "카카오 로그인이 아직 준비되지 않았어요.": "Kakao login isn't ready yet.",
  "잘못된 로그인 응답이에요.": "The login response is invalid.",
  "이메일 또는 비밀번호가 올바르지 않습니다.": "Your email or password is incorrect.",

  // ── 학생 서버: 녹음, 자료 (app/recordings/routes.py, document.py, youtube.py) ──
  "녹음을 찾을 수 없어요.": "We couldn't find the recording.",
  "유튜브 영상 주소가 아니에요. youtube.com/watch?v=… 또는 youtu.be/… 형태의 주소를 넣어 주세요.":
    "That's not a YouTube video link. Please enter a link like youtube.com/watch?v=… or youtu.be/….",
  "공개된 유튜브 영상만 가져올 수 있어요. 주소가 맞는지, 비공개 영상은 아닌지 확인해 주세요.":
    "Only public YouTube videos can be imported. Check that the link is right and the video isn't private.",
  "유튜브 영상은 서버에 저장된 파일이 없어요. 유튜브 플레이어로 재생해 주세요.":
    "YouTube videos aren't stored on our server. Please play it in the YouTube player.",
  "녹음 파일을 찾을 수 없어요.": "We couldn't find the recording file.",
  "그런 쪽은 없어요.": "That page doesn't exist.",
  "그 쪽 이미지가 없어요.": "There's no image for that page.",
  "질문을 입력해 주세요.": "Please enter a question.",
  "대본이 준비된 뒤에 질문할 수 있어요.": "You can ask once the transcript is ready.",
  "지금은 답을 만들지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't make an answer right now. Please try again in a moment.",
  "대본이 준비된 뒤에 리포트를 만들 수 있어요.": "You can make a report once the transcript is ready.",
  "PDF와 슬라이드는 말소리가 없어서 발표 평가를 할 수 없어요.":
    "PDFs and slides have no speech, so they can't get a presentation review.",
  "이 서버에는 분석 엔진이 설정되어 있지 않아요.": "The analysis engine isn't set up on this server.",
  "유튜브 강의": "YouTube lecture",
  "강의 녹음": "Lecture recording",
  "PDF를 읽을 수 있는 구성이 아니에요.": "This server isn't set up to read PDFs.",
  "PDF 파일을 열지 못했어요.": "We couldn't open the PDF file.",
  "잠긴 PDF는 읽을 수 없어요.": "Locked PDFs can't be read.",
  "슬라이드를 읽을 수 있는 구성이 아니에요.": "This server isn't set up to read slides.",
  "슬라이드 파일을 열지 못했어요.": "We couldn't open the slide file.",
  "글자를 찾지 못했어요. 스캔한 이미지 PDF는 아직 읽을 수 없어요.":
    "We couldn't find any text. Scanned image PDFs can't be read yet.",
  "영상을 전사하지 못했어요. 잠시 후 다시 시도해 주세요.": "We couldn't transcribe the video. Please try again in a moment.",
  // 요금제 한도 (app/billing/plans.py) — 화면은 '처리 분량' 이 들어 있는지로 한도 초과를 알아본다(한국어 그대로 둔다)
  "이번 달 처리 분량을 다 썼어요. 스탠다드로 늘리거나 다음 달에 다시 시도해 주세요.":
    "You've used this month's processing limit. Upgrade to Standard or try again next month.",
  // 발표 평가 (app/ai/speech_check.py, lens.py 채점 항목 이름)
  "평가하려면 실제 문장이 담긴 1분 이상의 발표가 필요해요. 음, 어 같은 소리만으로는 채점하지 않아요.":
    "A review needs at least 1 minute of presentation with real sentences. Sounds like \"um\" and \"uh\" alone aren't scored.",
  "발표가 너무 짧아요. 평가하려면 1분 이상 이어서 말한 녹음이 필요해요.":
    "The presentation is too short. A review needs a recording of at least 1 minute of continuous speaking.",
  "발표 내용이 너무 적어요. 평가하려면 실제 문장이 담긴 1분 이상의 발표가 필요해요.":
    "There's too little content. A review needs at least 1 minute of presentation with real sentences.",
  "평가할 수 있는 발표예요.": "This presentation can be reviewed.",
  "구조": "Structure",
  "명료성": "Clarity",
  "근거 활용": "Use of evidence",
  "전달력": "Delivery",
  // 업로드 (app/uploads/*)
  "업로드 세션을 찾을 수 없어요.": "We couldn't find the upload session.",
  "이미 취소된 업로드예요.": "This upload was already canceled.",
  "이미 완료된 업로드예요.": "This upload is already complete.",
  "잘못된 청크 번호예요.": "Invalid chunk number.",
  "올바른 파일 이름이 아니에요.": "That's not a valid file name.",
  // 인증 (app/api/deps.py, app/auth/oauth.py, kakao_flow.py)
  "유효하지 않은 인증 정보입니다.": "Your sign-in details aren't valid.",
  "소셜 로그인 서버에 연결하지 못했어요.": "We couldn't connect to the social login server.",
  "소셜 로그인 정보를 확인하지 못했어요.": "We couldn't verify your social login details.",
  "다른 앱에서 발급된 로그인 정보예요.": "These login details were issued by a different app.",
  "이메일이 확인되지 않은 구글 계정이에요.": "This Google account's email isn't verified.",
  "구글 계정 정보를 읽지 못했어요.": "We couldn't read your Google account details.",
  "카카오 계정 정보를 읽지 못했어요.": "We couldn't read your Kakao account details.",
  "카카오 계정의 이메일 제공에 동의해야 가입할 수 있어요.":
    "To sign up, you need to agree to share your Kakao account email.",
  "이메일이 확인되지 않은 카카오 계정이에요.": "This Kakao account's email isn't verified.",
  "카카오 계정 정보가 일치하지 않아요.": "Your Kakao account details don't match.",
  "로그인 요청이 만료되었어요. 다시 시도해 주세요.": "The login request expired. Please try again.",
  "카카오 로그인 정보를 받지 못했어요.": "We didn't receive your Kakao login details.",
  "로그인 요청이 일치하지 않아요.": "The login request doesn't match.",
  "카카오 로그인을 완료하지 못했어요. 다시 시도해 주세요.": "We couldn't finish Kakao login. Please try again.",
  "카카오 로그인 서버에 연결하지 못했어요.": "We couldn't connect to the Kakao login server.",
  // 결제 (app/billing/routes.py, app/interview/routes.py)
  "인앱 결제 웹훅이 설정되지 않았어요.": "In-app payment isn't set up yet.",
  "확인할 수 없는 요청이에요.": "We couldn't verify this request.",
  "본문을 읽을 수 없어요.": "We couldn't read the request.",
  "연 결제는 준비하고 있어요. 월 결제로 시작하시거나 결제 문의로 알려 주세요.":
    "Yearly billing is being set up. Start with monthly billing, or send us a payment inquiry.",

  // ── 앱의 API 클라이언트 (services/api/client.ts, session-manager.ts) ──────────
  "응답 형식을 확인할 수 없어요. 다시 시도해 주세요.": "We couldn't read the response. Please try again.",
  "녹음 응답에 ID가 없어요.": "The recording response has no ID.",
  "업로드 응답에 ID가 없어요. 다시 시도해 주세요.": "The upload response has no ID. Please try again.",
  "업로드 조각 크기를 확인할 수 없어요. 다시 시도해 주세요.": "We couldn't check the upload chunk size. Please try again.",
  "로그인을 준비하지 못했어요.": "We couldn't get login ready.",
  "로그인 주소를 확인하지 못했어요.": "We couldn't check the login address.",
  "사용자 응답 형식을 확인할 수 없어요.": "We couldn't read the user response.",
  "업로드 결과에 녹음 ID가 없어요.": "The upload result has no recording ID.",
  "녹음 목록 형식을 확인할 수 없어요.": "We couldn't read the recording list.",
  "대본 구간 형식을 확인할 수 없어요.": "We couldn't read the transcript segments.",
  "평가 이력 형식을 확인할 수 없어요.": "We couldn't read the review history.",
  "답변 형식을 확인할 수 없어요.": "We couldn't read the answer.",
  "로그인 응답 형식을 확인할 수 없어요.": "We couldn't read the login response.",
  "다시 로그인해 주세요.": "Please log in again.",
  "응답이 늦어지고 있어요. 다시 시도해 주세요.": "The response is taking too long. Please try again.",
  "연결하지 못했어요. 네트워크를 확인해 주세요.": "We couldn't connect. Please check your network.",
  "데모에서는 쓸 수 없는 기능이에요. PREMIND 계정으로 로그인해 주세요.":
    "This isn't available in the demo. Please log in with a PREMIND account.",
};

const plural = (n: string | undefined, one: string, other: string): string => (n === '1' ? one : other);

type DynamicRule = readonly [RegExp, (match: RegExpMatchArray) => string];

/**
 * 숫자나 이름이 끼어 있어 사전 키가 될 수 없는 문장의 영어. 서버 문장이 바뀌면 정규식도 바꿀 것.
 * 면접 쪽 네 줄은 면접 웹 server-messages.ts 의 DYNAMIC_RULES 와 같다.
 */
const DYNAMIC_RULES: readonly DynamicRule[] = [
  // 학생 서버 면접 한도 (app/interview/service.py)
  [
    /^무료 체험을 이미 썼어요\. AI 피드백 연습은 스탠다드에서 매달 (\d+)회 할 수 있어요\.$/u,
    (m) =>
      `You've already used your free trial. With Standard, you can do AI feedback practice ${m[1]} ${plural(m[1], 'time', 'times')} a month.`,
  ],
  [
    /^이번 달 AI 피드백 연습 (\d+)회를 모두 썼어요\. 다음 달 1일에 다시 채워져요\.$/u,
    (m) =>
      `You've used all ${m[1]} AI feedback ${plural(m[1], 'practice', 'practices')} for this month. They refill on the 1st of next month.`,
  ],
  [
    /^이번 달 자기소개서 질문 만들기 (\d+)회를 모두 썼어요\.( 스탠다드에서는 더 많이 만들 수 있어요\.)?$/u,
    (m) =>
      `You've used all ${m[1]} cover letter question ${plural(m[1], 'set', 'sets')} for this month.` +
      (m[2] ? ' You can make more with Standard.' : ''),
  ],
  [/^백업은 (\d+)개까지 할 수 있어요\.$/u, (m) => `You can keep up to ${m[1]} ${plural(m[1], 'backup', 'backups')}.`],
  // 업로드 (app/uploads/service.py)
  [/^파일이 너무 큽니다 \(최대 (\d+)GB\)\.$/u, (m) => `The file is too large (up to ${m[1]} GB).`],
  [
    /^청크 크기가 올바르지 않아요 \(기대 (\d+)바이트, 받은 (\d+)바이트\)\.$/u,
    (m) => `The chunk size is wrong (expected ${m[1]} bytes, got ${m[2]} bytes).`,
  ],
  [/^아직 도착하지 않은 청크가 있어요: (.+)$/su, (m) => `Some chunks haven't arrived yet: ${m[1]}`],
  [/^조립된 크기가 예상과 달라요 \((.+)\)\.$/su, (m) => `The assembled size isn't what we expected (${m[1]}).`],
  [/^파일을 저장하지 못했어요: (.+)$/su, (m) => `We couldn't save the file: ${m[1]}`],
  // 인증 (app/auth/oauth.py)
  [/^지원하지 않는 로그인 방식이에요: (.+)$/su, (m) => `This login method isn't supported: ${m[1]}`],
  // 앱의 API 클라이언트: 상태 코드가 붙은 기본 문장 (services/api/client.ts)
  [/^요청을 처리하지 못했어요\. \((\d+)\)$/u, (m) => `We couldn't process your request. (${m[1]})`],
  // 파일 고르기 (features/import): 크기 한도, 이동통신 데이터 경고
  [/^(.+) 이하의 파일을 선택해 주세요\.$/su, (m) => `Please choose a file of ${m[1]} or less.`],
  [
    /^지금 올리면 이동통신 데이터로 (.+)를 보내요\. 요금이 나올 수 있어요\.$/su,
    (m) => `If you upload now, ${m[1]} is sent over mobile data. Charges may apply.`,
  ],
];

/**
 * 사전에 없는 영어 문장의 마지막 대체. 모르는 문장이면 null.
 * FastAPI 검증 오류는 앞에 'Value error, ' 가 붙어 오므로 떼고 이 사전에서 다시 찾는다.
 */
export function enServerDynamic(message: string): string | null {
  if (typeof message !== 'string') return null;
  const text = message.trim();
  const validation = /^Value error, (.+)$/su.exec(text);
  if (validation) {
    const value = EN_SERVER[(validation[1] ?? '').trim()];
    if (typeof value === 'string') return value;
  }
  if (text !== message) {
    const value = EN_SERVER[text];
    if (typeof value === 'string') return value;
  }
  for (const [pattern, render] of DYNAMIC_RULES) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  return null;
}

// 사전 다음 단계로 이 대체를 쓰게 한다(lib/i18n/core.ts translate). 다른 영역이 대체를 더 두려면
// 이 함수를 불러 합칠 것 — setDynamicFallback 은 자리가 하나다.
setDynamicFallback(enServerDynamic);
