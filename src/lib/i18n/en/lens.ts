import type { EnDict } from '../core';

/** 영어 사전 — lens 영역. 키는 화면의 한국어 문장 그대로. */
export const EN_LENS: EnDict = {
  // ── 말하기 탭: 발표/면접 고르는 줄 ─────────────────────────────────────────
  'speak|발표': 'Presentation',
  'speak|면접': 'Interview',
  '발표 평가': 'Presentation review',
  'AI가 만든 평가예요. 틀릴 수 있으니 참고로만 봐 주세요.': 'This review is made by AI and may contain mistakes, so use it only as a reference.',
  '면접 연습': 'Interview practice',

  // ── 발표 홈 (PresentationHome) ─────────────────────────────────────────────
  '폴더 없음': 'No folder',
  알림: 'Notifications',
  '새 평가 시작': 'Start a new review',
  '발표 녹음하기': 'Record a presentation',
  '새로 평가받기': 'Get a new review',
  '가진 자료를 고르거나 지금 녹음해요.': 'Pick a material you have, or record one now.',
  '지난 평가': 'Past reviews',
  '점수가 제대로 나오는 녹음이에요.': 'For a recording that scores fairly.',
  '평가 시작': 'Start review',
  '녹음 시작': 'Start recording',
  '평가할 자료가 없어요': 'Nothing to review yet',
  확인: 'OK',
  '평가를 시작하지 못했어요': "Couldn't start the review",
  '아직 평가할 수 없어요': "Can't review this yet",
  '평가를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.':
    "Couldn't start the review. Please try again in a moment.",
  '유튜브 링크': 'YouTube link',
  영상: 'Video',
  문서: 'Document',
  녹음: 'Recording',
  음성: 'Audio',

  // ── 첫 화면 소개, 팁 ────────────────────────────────────────────────────────
  '내 발표를 채점해요': 'Get your presentation scored',
  '발표, 스피치, 면접 연습을 녹음하거나 올리면 대본을 근거로 점수와 먼저 고칠 것 하나를 알려줘요':
    'Record or upload a presentation, speech, or interview practice, and we give you a score and the one thing to fix first, based on the transcript',
  '채점 항목: {items}': 'Scored on: {items}',
  'rubric|구조': 'Structure',
  'rubric|명료성': 'Clarity',
  'rubric|근거': 'Evidence',
  'rubric|전달력': 'Delivery',
  'rubric|말하기 습관': 'Speaking habits',
  '가진 자료로 평가': 'Review a material',

  // ── 최근 평가 카드, 목록 ────────────────────────────────────────────────────
  '최근 평가, {title}. {meta}.': 'Latest review, {title}. {meta}.',
  '발표 평가 결과를 열어요': 'Opens the presentation review',
  '전체 평가': 'Overall',
  '먼저 고칠 것': 'Fix first',
  '자세히 보기': 'See details',
  'lens|최근': 'Latest',
  '{score}점': '{score} points',
  '평가 중': 'Reviewing',

  // ── 점수 구간 말 ────────────────────────────────────────────────────────────
  'lens|아주 좋아요': 'Excellent',
  'lens|좋아요': 'Good',
  'lens|보통이에요': 'Fair',
  'lens|아쉬워요': 'Needs work',

  // ── 평가 이력, 추이 ─────────────────────────────────────────────────────────
  '첫 평가': 'First review',
  'lens|같음': 'Same',
  '지난 평가와 같아요': 'Same as last review',
  '지난 평가보다 {delta}점': '{delta} from last review',
  '이 평가를 화면에 보여요': 'Shows this review on screen',
  'lens-unit|점': 'pts',
  '평가 추이, {n}번. 점수 {scores}. {delta}': {
    one: 'Score trend, {n} review. Scores {scores}. {delta}',
    other: 'Score trend, {n} reviews. Scores {scores}. {delta}',
  },
  추이: 'Trend',

  // ── 차트 ────────────────────────────────────────────────────────────────────
  '강점 {strengths}개, 보완 {improvements}개, 모두 {total}개':
    'Strengths {strengths}, to improve {improvements}, {total} in all',
  '강점 {n}개': 'Strengths {n}',
  '보완 {n}개': 'To improve {n}',
  '{time}부터 잘한 점 {strengths}개, 더 좋아질 점 {improvements}개':
    'from {time}, {strengths} went well, {improvements} to improve',
  '구간별 근거 분포, {n}구간.': 'Evidence by section, {n} sections.',
  '구간별 근거 분포': 'Evidence by section',
  '잘한 점': 'Went well',
  '더 좋아질 점': 'To improve',
  '강의 전체 길이 기준이에요. 표시를 누르면 그 근거로 이동해요.':
    'Drawn against the full length. Tap a marker to jump to that evidence.',
  '강의 길이를 몰라 마지막 근거까지만 그렸어요. 표시를 누르면 그 근거로 이동해요.':
    "The length is unknown, so this runs to the last piece of evidence. Tap a marker to jump to that evidence.",
  '시간 정보가 없어 순서대로 나란히 놓았어요. 표시를 누르면 그 근거로 이동해요.':
    'There are no timestamps, so the markers are placed in order. Tap a marker to jump to that evidence.',
  '근거 시점, {n}개. {summary}': 'Evidence points, {n}. {summary}',
  '목록에서 이 근거로 이동해요.': 'Jumps to this evidence in the list.',
  '{score}점, {band} 구간. {max}점 만점에 {edges}이 구간을 나눠요.':
    '{score} points, {band} band. Out of {max}, the bands split at {edges}.',
  '{label} {previous}에서 {current}, {delta}': '{label} from {previous} to {current}, {delta}',
  '지난 평가와 비교, {max}점 만점.': 'Compared with last review, out of {max}.',
  '총점 {previous}에서 {current}, {delta}.': 'Total from {previous} to {current}, {delta}.',
  총점: 'Total',
  '이번 {date}': 'This time {date}',
  '지난 {date}': 'Last time {date}',
  '항목별 점수, {max}점 만점. {summary}': 'Scores by item, out of {max}. {summary}',
  '항목별 점수. {spoken}': 'Scores by item. {spoken}',

  // ── 말하기 습관 (speech-metrics.ts 의 한국어 말) ───────────────────────────
  'speech|말 속도': 'Pace',
  'speech|군말': 'Filler words',
  'speech|긴 멈춤': 'Long pauses',
  'speech|분당 글자': 'chars/min',
  'speech|분당 회': 'per min',
  'speech|번': 'times',
  'speech|느려요': 'Slow',
  'speech|빨라요': 'Fast',
  'speech|알맞아요': 'Just right',
  'speech|적어요': 'Few',
  'speech|많아요': 'A lot',
  'speech|보통이에요': 'Moderate',
  'speech|없어요': 'None',
  'speech|괜찮아요': 'Fine',
  'speech|조금 더 힘 있게 이어가요': 'Keep going with a bit more energy',
  'speech|문장 끝에서 한 박자 쉬어요': 'Take a beat at the end of each sentence',
  'speech|지금 속도를 유지해요': 'Keep this pace',
  'speech|군말이 적어 듣기 편해요': 'Few fillers, so you are easy to listen to',
  'speech|말 사이를 침묵으로 채워요': 'Fill the gaps between words with silence',
  'speech|음, 어 대신 잠깐 멈춰요': 'Pause briefly instead of saying "um" or "uh"',
  'speech|흐름이 끊기지 않았어요': 'Your flow never broke',
  'speech|다음 말을 정해 두고 시작해요': 'Know your next line before you start it',
  'speech|긴 멈춤은 강조에 써요': 'Save long pauses for emphasis',
  'speech|분당 0에서 480 글자': '0 to 480 characters per minute',
  'speech|분당 0에서 8회': '0 to 8 per minute',
  'speech|0에서 6번': '0 to 6 times',
  '눈금은 {range}, 알맞은 구간은 {min}에서 {max}예요.':
    'The scale runs {range}, and the healthy range is {min} to {max}.',
  '눈금 밖이라 끝에 표시했어요.': 'Off the scale, so it is shown at the end.',
  '{unit}, 눈금 밖': '{unit}, off scale',

  // ── 리포트 화면 (report/[id]) ───────────────────────────────────────────────
  '이 자료를 찾을 수 없어요. 내 자료에서 다시 골라 주세요.':
    "We can't find this material. Please pick it again from your materials.",
  돌아가기: 'Go back',
  '내 발표를 읽고 평가하고 있어요': "We're reading and reviewing your presentation",
  '길이에 따라 몇 초에서 몇 분 걸려요. 이 화면을 나가도 평가는 이어져요.':
    'It takes a few seconds to a few minutes, depending on length. The review keeps going if you leave this screen.',
  '얼마나 잘했나요': 'How did you do',
  '내 발표 녹음이라면 평가를 시작해 보세요. 점수와 근거가 여기에 생겨요.':
    "If this is a recording of your presentation, start a review. Your score and evidence will show up here.",
  '아직 평가가 없어요': 'No review yet',
  '내 발표를 평가했어요': 'Your presentation review',
  '발표, 스피치, 면접 연습 녹음을 대본으로 채점했어요. 결론부터 읽고, 시간을 눌러 그 부분을 들어요.':
    'We scored your presentation, speech, or interview practice from its transcript. Read the conclusion first, then tap a time to hear that part.',
  '지금 보는 평가: {date}': 'Viewing review: {date}',
  총평: 'Summary',
  '가장 잘한 것': 'Best moment',
  '대본에서 바로 잰 숫자예요. 눈금의 진한 구간이 알맞은 범위예요.':
    'Numbers measured straight from the transcript. The darker stretch on each scale is the healthy range.',
  '말하기 습관': 'Speaking habits',
  '지난번과 비교': 'Compared with last time',
  '{label}, {explanation}. {max}점 만점에 {score}점, {band} 구간이에요. 기준은 2.5 보통, 3.5 좋아요, 4.5 아주 좋아요예요.':
    '{label}, {explanation}. {score} out of {max}, in the {band} band. The bands are Fair from 2.5, Good from 3.5, Excellent from 4.5.',
  '무엇이 좋았나요': 'What went well',
  '무엇부터 고칠까요': 'What to fix first',
  우선순위: 'Priority',
  '이렇게 해요': 'Try this',
  '{time}부터 듣기': 'Listen from {time}',
  '어디를 다시 들을까요': 'Where to listen again',
  '평가 이력': 'Review history',
  '같은 대본으로 평가를 새로 만들어요.': 'Makes a new review from the same transcript.',
  '다시 평가': 'Review again',
  '그 부분부터 재생해요.': 'Plays from that point.',

  // ── 2026-09-26 앱다운 재설계: 말하기 탭 큰 제목, 머리 카드, 리포트 ─────────────────
  '한 번 더 말해 볼까요?': 'Ready for another run?',
  '발표를 들려주세요': "Let's hear your presentation",
  '녹음 화면을 열어요': 'Opens the recorder',
  '다시 녹음하기': 'Record again',

  // ── 2026-09-26 덜어내기 ────────────────────────────────────────────────────
  '자료로 평가': 'Review a file',
  '말이 담긴 자료를 골라 주세요.': 'Pick a material with speech in it.',
  'PDF와 PPTX는 말소리가 없어 평가할 수 없어요.': "PDFs and PPTX files have no speech, so they can't be reviewed.",
  '{score}점, {verdict}.': '{score} points, {verdict}.',
  '먼저 고칠 것, {text}': 'Fix first, {text}',
  'fold|접기': 'Show less',
};
