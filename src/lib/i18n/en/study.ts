import type { EnDict } from '../core';

/** 영어 사전 — study 영역. 키는 화면의 한국어 문장 그대로. */
export const EN_STUDY: EnDict = {
  // ── 이해도 탭 (app/(tabs)/mastery.tsx, components/mastery) ──
  알림: 'Notifications',
  이해도: 'Mastery',
  '푼 문제와 확인한 내용으로 자료마다 계산해요':
    'Worked out for each material from the questions you answered and the points you checked',
  '마인드팩 만들기': 'Make a Mind Pack',
  '문제를 풀고 꼭 기억할 내용을 확인하면 여기에 자료별 이해도가 채워져요':
    'Answer questions and check the key points, and your Mastery for each material shows up here',
  '아직 이해도를 볼 자료가 없어요': 'No materials to show Mastery for yet',
  '누르면 그 대목으로 가요. 알게 됐으면 지워 주세요.':
    'Tap to jump to that part. Clear it once you get it.',
  '헷갈린다고 표시한 곳': 'Spots you marked as confusing',
  '표시한 곳 {total}개 중 최근 {shown}개예요': 'Showing the latest {shown} of {total} marked spots',
  '자료를 누르면 취약 개념과 무엇부터 볼지 알려 줘요.':
    'Tap a material to see your weak concepts and what to review first.',
  '자료별 이해도': 'Mastery by material',
  '자료 {n}개 더 보기': { one: 'Show {n} more material', other: 'Show {n} more materials' },
  '더 보기 {n}개': 'Show {n} more',
  '표시한 대목을 대본에서 열어요.': 'Opens the marked part in the transcript.',
  '{reason} 표시 지우기': 'Clear mark: {reason}',

  // 헷갈려요 이유 (lib/confusion-spots.ts)
  '용어가 어려워요': 'The terms are hard',
  '예시가 더 필요해요': 'I need more examples',
  '설명이 너무 빨라요': 'It goes too fast',
  '무슨 말인지 모르겠어요': "I don't get what it means",

  // 이번 주 활동 (ActivityStrip, lib/mastery.ts weekdayActivity)
  'weekday|월': 'Mon',
  'weekday|화': 'Tue',
  'weekday|수': 'Wed',
  'weekday|목': 'Thu',
  'weekday|금': 'Fri',
  'weekday|토': 'Sat',
  'weekday|일': 'Sun',
  '{day} 문제 {n}개': { one: '{day} {n} question', other: '{day} {n} questions' },
  '{day} 없음': '{day} none',
  '최근 7일 활동. {spoken}. {caption}': 'Last 7 days of activity. {spoken}. {caption}',
  '이번 주는 아직 안 풀었어요': "You haven't answered any questions this week",
  '이번 주 문제 {n}개, 정답률 {percent}%': {
    one: '{n} question this week, {percent}% correct',
    other: '{n} questions this week, {percent}% correct',
  },

  // MasteryHero
  '이해도 시작 전': 'Mastery not started',
  '전체 이해도 {score}%, {verdict}': 'Overall Mastery {score}%, {verdict}',
  '가장 최근 자료의 문제를 열어요': 'Opens the questions for your latest material',
  '문제 풀러 가기': 'Answer questions',
  '시작 전': 'Not started',
  '최근 7일': 'Last 7 days',
  '첫 문제를 풀면 이해도가 시작돼요': 'Answer your first question to start your Mastery',
  '자료 {total}개 중 {studied}개를 공부했어요': "You've studied {studied} of {total} materials",
  '{term}{josa} 다시 볼 차례예요': 'Time to review {term}',
  '남은 문제 {n}개를 풀어 봐요': {
    one: 'Try the {n} question left',
    other: 'Try the {n} questions left',
  },
  '푼 문제를 모두 맞혔어요': 'You got every question you answered right',

  // 판정 (lib/mastery.ts masteryVerdict)
  '아주 잘 알아요': 'Know it very well',
  '잘 알아요': 'Know it well',
  '조금 더 봐요': 'Review a bit more',
  '다시 봐요': 'Review again',

  // MaterialMasteryRow, lib/mastery.ts masteryLine
  '이해도와 취약 개념을 열어요': 'Opens Mastery and weak concepts',
  '문제를 풀어요': 'Answer the questions',
  '요약에서 핵심 내용을 확인해요': 'Check the key points in the summary',
  '{title}. 이해도 {score}%, {verdict}. {line}': '{title}. Mastery {score}%, {verdict}. {line}',
  '문제 {n}개가 기다려요': { one: '{n} question waiting', other: '{n} questions waiting' },
  '핵심 내용 {n}개를 확인해요': { one: 'Check {n} key point', other: 'Check {n} key points' },
  '아직 이해도를 볼 게 없어요': 'Nothing to measure yet',
  '문제 {total}개 중 {correct}개 맞힘': '{correct} of {total} questions right',
  '취약 개념 {n}개': { one: '{n} weak concept', other: '{n} weak concepts' },
  '취약 개념 없음': 'No weak concepts',
  '핵심 내용 {total}개 중 {checked}개 확인': '{checked} of {total} key points checked',

  // PlanRow
  '그 시점부터 대본과 함께 재생해요': 'Plays from that moment with the transcript',
  '이 자료의 문제를 다시 풀어요': 'Retake the questions for this material',
  '이 자료의 문제를 풀어요': 'Answer the questions for this material',

  // 다음에 할 일, 학습 계획 (lib/mastery.ts nextSteps, studyPlan)
  '문제 풀기': 'Answer questions',
  '문제 {n}개를 풀면 이해도가 생겨요': {
    one: 'Answer {n} question to get your Mastery',
    other: 'Answer {n} questions to get your Mastery',
  },
  '핵심 내용 확인': 'Check key points',
  '핵심 내용 {n}개를 확인하면 이해도가 생겨요': {
    one: 'Check {n} key point to get your Mastery',
    other: 'Check {n} key points to get your Mastery',
  },
  '{at} 다시 보기': 'Review {at}',
  '{at}부터 다시 듣기': 'Replay from {at}',
  '{term}{josa} 헷갈렸어요': 'You mixed up {term}',
  '틀린 문제 {n}개': { one: '{n} wrong answer', other: '{n} wrong answers' },
  '안 푼 문제 {n}개': { one: '{n} unanswered', other: '{n} unanswered' },
  '문제 다시 풀기': 'Retake questions',
  '아직 확인하지 않은 내용 {n}개': {
    one: '{n} point not checked yet',
    other: '{n} points not checked yet',
  },
  '{title} / {at}부터': '{title} / from {at}',
  '{title} / 틀린 문제 {n}개': {
    one: '{title} / {n} wrong answer',
    other: '{title} / {n} wrong answers',
  },
  '안 푼 문제 풀기': 'Answer unanswered questions',
  '{title} / 문제 {n}개': { one: '{title} / {n} question', other: '{title} / {n} questions' },

  // 이해도 상세 (app/mastery/[id].tsx, lib/mastery.ts masteryHeadline)
  '아직 이해도를 볼 게 없어요.': 'Nothing to measure yet.',
  '이 자료는 {score}% 이해했어요.': 'You understand {score}% of this material.',
  '{first} {terms}{josa} 헷갈렸어요.': '{first} You mixed up {terms}.',
  '{first} 헷갈린 개념이 없어요.': '{first} No concepts mixed up.',
  '{first} 문제를 풀면 더 정확해져요.': '{first} Answer questions to make it more accurate.',
  '이 자료를 찾을 수 없어요. 평가에서 다시 골라 주세요.':
    "Couldn't find this material. Pick it again from Mastery.",
  돌아가기: 'Go back',
  '폴더 없음': 'No folder',
  '요약 보기': 'View summary',
  '문제 {n}개를 풀면 이해도와 취약 개념이 생겨요.': {
    one: 'Answer {n} question to see your Mastery and weak concepts.',
    other: 'Answer {n} questions to see your Mastery and weak concepts.',
  },
  '요약에서 핵심 내용을 확인하면 이해도가 생겨요.':
    'Check the key points in the summary to get your Mastery.',
  '문제 정답률 {weight}%': 'Quiz accuracy {weight}%',
  '아직 안 풀었어요': 'Not answered yet',
  '{total}개 중 {correct}개 맞힘, {percent}%': '{correct} of {total} right, {percent}%',
  '핵심 내용 확인 {weight}%': 'Key points checked {weight}%',
  '핵심 내용이 없어요': 'No key points',
  '{total}개 중 {checked}개 확인, {percent}%': '{checked} of {total} checked, {percent}%',
  '마지막 답이 틀린 개념이에요. 시간을 누르면 그 부분부터 들어요.':
    'Concepts whose last answer was wrong. Tap the time to listen from that part.',
  '헷갈린 개념': 'Mixed-up concepts',
  없어요: 'None',
  '푼 문제는 모두 맞혔어요.': 'You got every question you answered right.',
  '문제를 풀면 헷갈린 개념이 보여요.': 'Answer questions to see which concepts you mixed up.',
  '{total}개 중 {checked}개를 확인했어요.': "You've checked {checked} of {total}.",
  '핵심 내용': 'Key points',
  확인함: 'Checked',
  '아직 확인 안 함': 'Not checked yet',
  '날짜별로 맞힌 비율이에요.': 'The share you got right, by day.',
  '정답률 추이': 'Accuracy trend',
  '정답률 추이, {n}일. {values}': {
    one: 'Accuracy trend, {n} day. {values}',
    other: 'Accuracy trend, {n} days. {values}',
  },
  '{when}, 문제 {n}개': { one: '{when}, {n} question', other: '{when}, {n} questions' },
  '다른 날 한 번 더 풀면 추이가 보여요.': 'Answer again on another day to see a trend.',
  '문제를 풀면 추이가 보여요.': 'Answer questions to see a trend.',
  '다 했어요': 'All done',
  '문제도 다 맞히고 핵심 내용도 다 확인했어요.':
    'You got every question right and checked every key point.',
  기타: 'Other',
  '{total}개 중 {correct}개': '{correct} of {total}',
  '물어본 것': 'What was asked',
  '그 시점부터 대본과 함께 재생해요.': 'Plays from that moment with the transcript.',

  // 문제 (app/quiz/[id].tsx)
  '자료에 없는 내용이에요': "It's not in the material",
  '정답이 틀린 것 같아요': 'The answer looks wrong',
  '문제가 이해되지 않아요': "I don't understand the question",
  'quiz|문제': 'Quiz',
  '아직 풀 수 있는 문제가 없어요. 마인드팩이 준비되면 다시 열어 주세요.':
    'No questions to answer yet. Open this again once the Mind Pack is ready.',
  '알려 줘서 고마워요. 이 문제는 다시 보지 않을게요.':
    "Thanks for letting us know. You won't see this question again.",
  '알려 준 문제를 빼니 남은 문제가 없어요. 새 문제가 만들어지면 다시 열어 주세요.':
    'With the reported questions taken out, none are left. Open this again when new ones are made.',
  '풀 문제가 없어요': 'No questions to answer',
  'quiz|결과': 'Results',
  점수: 'Score',
  'score-unit|점': ' pts',
  잘했어요: 'Well done',
  '한 번 더': 'One more time',
  '{total}문제 중 {correct}개 정답': '{correct} of {total} correct',
  '{total}문제 중 {correct}개를 맞혔어요. 틀린 문제는 근거를 다시 들어 보세요.':
    'You got {correct} of {total} right. For the ones you missed, listen to the source again.',
  'quiz|정답': 'Correct',
  '다시 볼 문제': 'To review',
  '설명이 나온 시점부터 재생해요.': 'Plays from where it was explained.',
  '모든 문제를 맞혔어요 🎉': 'You got every question right 🎉',
  '이번엔 마인드맵의 개념을 내 말로 설명해 보세요.':
    'Next, try explaining the concepts in the mind map in your own words.',
  '다시 풀기': 'Try again',
  '{total}문제 중 {n}번째': 'Question {n} of {total}',
  '{total}문제 중 {n}번째, 맞힌 문제 {correct}개':
    'Question {n} of {total}, {correct} right so far',
  정답이에요: 'Correct',
  아쉬워요: 'Not quite',
  '{at} 근거 보기': 'See source at {at}',
  '{at} 근거 듣기': 'Hear source at {at}',
  '틀린 문제나 이해되지 않는 문제를 알려요': 'Report a wrong or unclear question',
  '이 문제가 이상해요': 'Report this question',
  '결과 보기': 'See results',
  '다음 문제': 'Next question',
  '어떤 점이 이상했는지 알려 주면 문제를 다시 만들 때 반영해요.':
    "Tell us what seemed off and we'll use it when we remake the questions.",
  보내기: 'Send',
  '한 줄 설명 (선택)': 'One-line note (optional)',
  '어떤 점이 이상했나요?': 'What seemed off?',

  // 암기 카드 (app/cards/[id].tsx, components/cards, lib/flashcards.ts)
  '암기 카드': 'Flashcards',
  '자료를 찾지 못했어요. 목록에서 다시 열어 주세요.':
    "Couldn't find the material. Open it again from the list.",
  '자료가 없어요': 'No material',
  '자료 보기': 'View material',
  '마인드팩이 준비되면 개념과 꼭 기억할 내용으로 카드가 만들어져요. 요약에서 문장을 칠해도 카드가 늘어요.':
    'Once the Mind Pack is ready, cards are made from its concepts and key points. Highlighting sentences in the summary adds more cards.',
  '아직 만들 카드가 없어요': 'No cards to make yet',
  '다시 볼 것만 복습': 'Review only the ones to see again',
  닫기: 'Close',
  '처음부터 다시': 'Start over',
  '카드 {total}개 중 {n}번째': 'Card {n} of {total}',
  '이 카드를 다시 볼 목록에 담아요': 'Adds this card to the see-again pile',
  '다시 볼래요': 'See again',
  '이 카드를 외운 것으로 표시해요': 'Marks this card as known',
  알아요: 'I know it',
  '카드를 옆으로 밀어도 넘어가요': 'You can also swipe the card sideways',
  '{total}개 중 {known}개를 알아요': 'You know {known} of {total}',
  '다 외웠어요': 'All memorized',
  '오늘은 여기까지 해도 좋아요. 내일 한 번 더 보면 오래 남아요.':
    'You can stop here for today. One more look tomorrow helps it stick.',
  '다시 볼 카드가 {n}개 있어요. 이어서 복습해 보세요.': {
    one: '{n} card to see again. Keep reviewing.',
    other: '{n} cards to see again. Keep reviewing.',
  },
  '이 문장은 무엇을 말하나요?': 'What is this sentence saying?',
  '{at} 다시 듣기': 'Replay {at}',
  '눌러서 앞면을 봐요': 'Tap to see the front',
  '눌러서 뜻을 봐요': 'Tap to see the meaning',
  '이 내용이 나온 시점부터 대본과 함께 재생해요':
    'Plays with the transcript from where this came up',
  'card-origin|개념': 'Concept',
  'card-origin|핵심 내용': 'Key point',
  'card-origin|형광펜': 'Highlight',

  // 질문 (app/chat/[id].tsx)
  'chat|질문': 'Ask',
  '이 자료를 찾을 수 없어요. 내 자료에서 다시 골라 주세요.':
    "Couldn't find this material. Pick it again from your materials.",
  '내 자료 보기': 'My materials',
  '진행 보기': 'See progress',
  '대본이 만들어지면 근거를 보며 질문할 수 있어요.':
    'Once the transcript is ready, you can ask questions with the sources in view.',
  '아직 대본을 만드는 중이에요': 'Still making the transcript',

  // 앱다운 이해도 (2026-09-26): 머리 카드, 넘기는 카드, 상세, 결과
  '이번 주': 'This week',
  '연속 {n}일 공부했어요': { one: 'Studied {n} day in a row', other: 'Studied {n} days in a row' },
  '연속 {n}일': { one: '{n}-day streak', other: '{n}-day streak' },
  '이번 주 {n}문제': { one: '{n} question this week', other: '{n} questions this week' },
  '전체 이해도': 'Overall Mastery',
  '오늘 복습 시작': "Start today's review",
  '첫 문제 풀기': 'Answer your first question',
  '{title}부터 시작해요': 'Starts with {title}',
  '옆으로 넘겨 보세요. 누르면 무엇부터 볼지 알려 줘요.':
    'Swipe to see more. Tap one to see what to review first.',
  '지금 복습할 자료': 'Review now',
  '시작할 자료': 'Start here',
  '헷갈린 곳': 'Confusing spots',
  '나머지 자료': 'Other materials',
  '이해도 {score}%, {verdict}': 'Mastery {score}%, {verdict}',
  '헷갈린 개념: {terms}': 'Mixed-up concepts: {terms}',
  '{total}개 중 {correct}개 맞힘': '{correct} of {total} right',
  '문제 정답률': 'Quiz accuracy',
  '{total}개 중 {checked}개 확인': '{checked} of {total} checked',
  '이해도는 정답률 {quiz}%, 핵심 내용 확인 {check}%로 계산해요':
    'Mastery counts quiz accuracy {quiz}% and key points checked {check}%',
  '마지막 답이 틀린 개념이에요. 누르면 그 부분부터 들어요.':
    'Concepts whose last answer was wrong. Tap to replay from that part.',
  '다시 볼 곳': 'Worth another look',
  '잘했어요! 틀린 {n}문제만 다시 보면 돼요': {
    one: 'Nice work! Just review the {n} you missed',
    other: 'Nice work! Just review the {n} you missed',
  },
  '괜찮아요, 틀린 곳을 다시 들으면 금방 늘어요':
    "That's okay. Replaying the parts you missed helps fast",
  '맞힌 문제': 'Correct',
};
