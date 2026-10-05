/**
 * 영어 데모 자료 — 2026-10-05 (CEO "영어 버전 좀 잘 만들어봐, 외국인 유입이 많은데").
 *
 * mock-data.ts 의 한국어 문장을 키로, 영어 화면에서 데모를 시작할 때 같은 자리에 들어갈 영어 문장.
 * 자료 구조는 mock-data.ts 하나만 두고(id, 시각, 정답 번호가 두 언어에서 늘 같다), 문자열만 바꾼다.
 * mock-data.ts 에 한국어 문장을 더하면 여기에도 더한다 — mock-data-en.test.ts 가 빠진 문장을 잡는다.
 */
export const MOCK_DATA_EN: Readonly<Record<string, string>> = {
  "지도학습이란 무엇인가. 지도학습은 입력과 정답이 짝지어진 데이터를 반복해서 보면서 둘 사이의 관계를 배우는 방식이다. 사람이 미리 정답을 달아 둔 데이터가 필요하다는 점이 다른 방식과 갈라지는 지점이다. 사진과 그 사진이 고양이인지 개인지가 함께 주어지면, 모델은 어떤 특징이 어느 쪽 답과 이어지는지를 스스로 찾아 나간다. 학습이 끝나면 정답이 없는 새 사진에도 답을 내놓을 수 있게 된다.":
    "What is supervised learning? Supervised learning means learning the relationship between inputs and answers by looking at paired examples again and again. What sets it apart is that it needs data a person has already labeled with the right answer. Give a model photos along with whether each one shows a cat or a dog, and it works out which features point to which answer. Once training is done, it can answer for new photos that come with no label.",
  "지도학습이 무엇인지, 왜 정답이 달린 데이터가 필요한지를 고양이와 개 사진 예시로 설명해요.":
    "Explains what supervised learning is and why it needs labeled data, using cat and dog photos.",
  "분류와 회귀. 지도학습은 맞혀야 하는 답의 생김새에 따라 둘로 나뉜다. 분류는 답이 범주일 때 쓰고, 회귀는 답이 숫자일 때 쓴다. 메일이 스팸인지 아닌지를 가리는 것은 분류이고, 내일 기온이 몇 도일지를 맞히는 것은 회귀다. 같은 데이터라도 무엇을 묻느냐에 따라 둘 중 어느 쪽인지가 달라진다. 집값이 얼마인지 묻는 것은 회귀지만, 비싼지 싼지를 묻는 것은 분류다.":
    "Classification and regression. Supervised learning splits in two depending on what kind of answer you need. Classification is for answers that are categories; regression is for answers that are numbers. Deciding whether an email is spam is classification; predicting tomorrow's temperature is regression. The same data can be either, depending on the question. Asking what a house costs is regression, but asking whether it is expensive or cheap is classification.",
  "분류는 범주를, 회귀는 숫자를 맞힌다는 차이를 스팸 메일과 기온 예측으로 나눠 설명해요.":
    "Separates classification (categories) from regression (numbers) with spam filtering and temperature forecasts.",
  "훈련 데이터와 검증 데이터. 가진 데이터를 전부 학습에 쓰면 모델이 잘하는지 알 방법이 없다. 시험 문제를 미리 알려 주고 시험을 보는 것과 같기 때문이다. 그래서 데이터를 훈련용과 검증용으로 나누고, 검증용은 학습이 끝날 때까지 손대지 않는다. 보통 훈련에 70~80퍼센트를 쓰고 나머지를 남겨 둔다. 검증 데이터에서의 성능이 실제로 기대할 수 있는 성능이다.":
    "Training data and validation data. If you train on all your data, you have no way to tell whether the model is any good. It is like seeing the exam questions before the exam. So you split the data into a training set and a validation set, and you leave the validation set untouched until training ends. Usually 70 to 80 percent goes to training and the rest is held back. Performance on the validation set is the performance you can actually expect.",
  "데이터를 훈련용과 검증용으로 나누는 이유와 보통 쓰는 7대 3 비율을 다뤄요.":
    "Why data is split into training and validation sets, and the usual 70/30 split.",
  "과적합을 알아채는 법. 과적합은 모델이 훈련 데이터를 외워 버린 상태다. 훈련 데이터에서는 거의 다 맞히는데 검증 데이터에서는 눈에 띄게 못 맞히면 과적합을 의심해야 한다. 학습을 진행하면서 두 성능을 함께 그려 보면, 훈련 성능은 계속 오르는데 검증 성능이 어느 지점부터 떨어지기 시작하는 것이 보인다. 그 지점이 학습을 멈춰야 하는 곳이다.":
    "How to spot overfitting. Overfitting is when a model has memorized its training data. If it gets almost everything right on the training data but noticeably worse on the validation data, suspect overfitting. Plot both scores as training goes on and you will see training performance keep rising while validation performance starts to drop at some point. That point is where training should stop.",
  "훈련 성능은 오르는데 검증 성능이 떨어지는 지점이 과적합이라고 설명해요.":
    "Overfitting starts where training performance keeps rising but validation performance falls.",
  "정확도만 보면 안 되는 이유. 답이 한쪽으로 크게 치우친 데이터에서는 정확도가 성능을 속인다. 천 명 중 열 명만 병에 걸린 데이터라면, 전부 건강하다고 답하는 모델도 정확도가 99퍼센트다. 정작 찾아내야 할 열 명은 한 명도 못 찾았는데도 그렇다. 그래서 이런 데이터에서는 실제 환자 중 몇 명을 찾아냈는지, 환자라고 답한 사람 중 몇 명이 진짜였는지를 함께 봐야 한다.":
    "Why accuracy alone can mislead. When answers are heavily skewed to one side, accuracy lies about performance. If only 10 people in 1,000 are sick, a model that says everyone is healthy is still 99 percent accurate, even though it found none of the 10 people it needed to find. With data like this, also check how many real patients the model found, and how many of the people it flagged were really sick.",
  "천 명 중 열 명만 환자인 예로, 정확도만 보면 안 되는 이유를 보여줘요.":
    "Shows why accuracy alone misleads, using a dataset where only 10 in 1,000 people are sick.",
  "화자 1":
    "Speaker 1",
  "오늘은 인공지능과 머신러닝의 차이부터 시작하겠습니다. 인공지능은 더 큰 범주이고, 머신러닝은 데이터로 규칙을 학습하는 한 방법입니다.":
    "Today let's start with the difference between artificial intelligence and machine learning. AI is the broader category, and machine learning is one way of learning rules from data.",
  "이 부분은 시험에도 자주 나오는 중요한 내용입니다. 지도학습에서는 입력과 정답이 함께 있는 데이터를 사용하고, 모델은 예측과 정답의 차이를 줄이는 방향으로 학습합니다.":
    "This part comes up on the exam a lot, so it's important. Supervised learning uses data where inputs come with correct answers, and the model learns by shrinking the gap between its predictions and those answers.",
  "분류는 범주를, 회귀는 연속된 수치를 예측합니다. 스팸 메일 판별은 분류이고 주택 가격 예측은 회귀입니다.":
    "Classification predicts categories, and regression predicts continuous values. Spam detection is classification, and house price prediction is regression.",
  "여기는 꼭 기억해야 합니다. 학습 데이터에만 지나치게 맞춘 상태를 과적합이라고 하며, 검증 데이터를 따로 두는 이유가 여기에 있습니다.":
    "Make sure you remember this. When a model fits its training data too closely, we call that overfitting, and that's exactly why we keep separate validation data.",
  "정확도 하나만으로 모델을 판단하면 안 됩니다. 문제의 비용에 따라 정밀도와 재현율을 함께 봐야 합니다.":
    "Never judge a model on accuracy alone. Depending on the cost of each mistake, look at precision and recall together.",
  "구조":
    "Structure",
  "인공지능과 머신러닝의 관계를 큰 범주에서 세부 개념 순서로 설명했어요.":
    "You moved from the big picture of AI and machine learning down to the specific concepts.",
  "명료성":
    "Clarity",
  "분류와 회귀를 스팸 판별과 주택 가격 사례로 구분했어요.":
    "You told classification and regression apart with spam filtering and house prices.",
  "근거 활용":
    "Use of evidence",
  "평가 지표의 필요성은 설명했지만 선택 기준을 더 구체화할 수 있어요.":
    "You explained why metrics matter, but the criteria for choosing one could be more concrete.",
  "전달력":
    "Delivery",
  "중요한 개념을 명시적으로 강조해 흐름을 따라가기 쉬웠어요.":
    "You called out the key ideas explicitly, so the flow was easy to follow.",
  "지도학습의 정의 뒤에 학습 과정을 바로 연결해 개념의 쓰임을 분명히 했어요.":
    "You tied the definition of supervised learning straight to how it trains, which made the concept's use clear.",
  "분류와 회귀를 일상적인 예시로 대비해 차이를 이해하기 쉬웠어요.":
    "Contrasting classification and regression with everyday examples made the difference easy to grasp.",
  "평가 지표가 달라지는 조건을 질문으로 먼저 환기하면 선택 기준이 더 선명해져요.":
    "Open with a question about when the right metric changes, and your selection criteria will land more clearly.",
  "놓치면 더 큰 비용이 드는 오류가 무엇인지 먼저 정하고, 정밀도와 재현율을 비교해요.":
    "First decide which mistake is more costly to miss, then compare precision and recall.",
  "정확도에서 정밀도, 재현율로 넘어가기 전에 판단 기준이 한 문장으로 먼저 나오면 좋아요.":
    "Before moving from accuracy to precision and recall, state your deciding criterion in one sentence.",
  "오류 비용을 먼저 정한 뒤 두 지표를 비교해요.":
    "Set the cost of each error first, then compare the two metrics.",
  "나쁜 그래프 예시를 먼저 보여 주고 고치는 순서로 이어 가 흐름이 분명했어요.":
    "You showed a bad chart first and then fixed it step by step, so the flow was clear.",
  "축, 눈금, 색을 하나씩 짚어 무엇을 바꾸는지 알기 쉬웠어요.":
    "You walked through axes, ticks and colors one at a time, so each change was easy to see.",
  "왜 막대그래프가 나은지 이유는 말했지만 비교 수치는 적었어요.":
    "You said why a bar chart works better, but gave few numbers to compare.",
  "화면을 가리키며 말해 듣는 사람이 따라가기 편했어요.":
    "Pointing at the screen as you spoke made it easy for listeners to follow.",
  "같은 데이터를 두 그래프로 나란히 보여 줘 차이가 바로 보였어요.":
    "Showing the same data as two charts side by side made the difference obvious.",
  "색을 줄이는 이유를 말할 때 색약 사용자 예를 하나 들면 더 설득력 있어요.":
    "When you explain cutting down on colors, one example of a color-blind reader would be more convincing.",
  "색을 줄이기 전과 후를 한 번씩 보여 주고 읽는 시간을 비교해요.":
    "Show the chart before and after reducing colors, and compare how long each takes to read.",
  "막대그래프를 고르는 기준을 첫머리에 한 문장으로 먼저 말하면 좋아요.":
    "Open with one sentence on when to pick a bar chart.",
  "\"비교는 막대, 흐름은 선\"처럼 기준을 먼저 말하고 예시로 넘어가요.":
    "State the rule first, like \"bars for comparisons, lines for trends,\" then move to examples.",
  "5주차, 지도학습의 원리":
    "Week 5: How supervised learning works",
  "인공지능개론_5주차.m4a":
    "Intro_to_AI_week5.m4a",
  "마인드팩 준비 완료":
    "Mind Pack ready",
  "지도학습의 기본 구조를 분류와 회귀 사례로 살펴보고, 학습 데이터 분리와 과적합 방지, 평가 지표 선택까지 이어지는 강의예요.":
    "A lecture that walks through the basics of supervised learning with classification and regression examples, then covers splitting data, preventing overfitting and choosing evaluation metrics.",
  "지도학습은 입력과 정답의 관계를 데이터에서 학습한다.":
    "Supervised learning learns the relationship between inputs and correct answers from data.",
  "분류는 범주를, 회귀는 연속값을 예측한다.":
    "Classification predicts categories; regression predicts continuous values.",
  "훈련 데이터와 검증 데이터를 분리해 일반화 성능을 확인한다.":
    "Split training and validation data to check how well the model generalizes.",
  "불균형 데이터에서는 정확도 외 지표도 함께 확인한다.":
    "With imbalanced data, check metrics beyond accuracy.",
  "지도학습":
    "Supervised learning",
  "입력 데이터와 정답 레이블의 대응 관계를 학습하는 방식":
    "Learning the mapping between input data and their correct labels",
  "과적합":
    "Overfitting",
  "훈련 데이터에는 잘 맞지만 새로운 데이터에는 성능이 낮은 상태":
    "Fitting the training data well but performing poorly on new data",
  "재현율":
    "Recall",
  "실제 양성 가운데 모델이 양성으로 찾아낸 비율":
    "The share of actual positives that the model correctly finds",
  "인공지능과 머신러닝의 관계":
    "How AI and machine learning relate",
  "인공지능은 사람의 지능을 흉내 내는 기술 전체를 가리키는 큰 범주예요. 머신러닝은 그 안에서 데이터로 규칙을 스스로 찾아내는 방법이에요. 그래서 모든 머신러닝은 인공지능이지만, 모든 인공지능이 머신러닝인 것은 아니에요. 이 관계를 먼저 잡아 두면 뒤에 나오는 개념들이 어디에 속하는지 헷갈리지 않아요.":
    "Artificial intelligence is the broad category covering any technology that imitates human intelligence. Machine learning sits inside it as the approach that finds rules from data on its own. So all machine learning is AI, but not all AI is machine learning. Get this relationship straight first, and you won't lose track of where the later concepts belong.",
  "지도학습이 배우는 방식":
    "How supervised learning learns",
  "지도학습은 입력과 정답이 짝으로 있는 데이터를 사용해요. 모델은 예측을 내놓고, 정답과 얼마나 차이 나는지 확인해요. 그 차이를 줄이는 방향으로 내부 값을 조금씩 고쳐 나가요. 이 과정을 반복하면 처음 보는 입력에도 답을 낼 수 있게 돼요. 시험에 자주 나오는 구간이니 학습 순서를 그대로 기억해 두세요.":
    "Supervised learning uses data where each input is paired with its correct answer. The model makes a prediction and checks how far it is from the answer. It then nudges its internal values to shrink that gap. Repeat this enough and it can answer inputs it has never seen. This part shows up on exams a lot, so remember the steps in order.",
  "분류와 회귀의 차이":
    "Classification vs. regression",
  "분류는 정해진 범주 가운데 하나를 고르는 문제예요. 스팸 메일인지 아닌지 판별하는 일이 여기에 해당해요. 회귀는 연속된 수치를 예측하는 문제예요. 주택 가격처럼 값이 이어지는 대상을 다룰 때 씁니다. 무엇을 예측하려는지에 따라 모델과 평가 방법이 함께 달라져요.":
    "Classification picks one option from a fixed set of categories, like deciding whether an email is spam. Regression predicts a continuous number, used for things like house prices where values run along a scale. What you are trying to predict decides both the model and how you evaluate it.",
  "과적합과 검증 데이터":
    "Overfitting and validation data",
  "학습 데이터에만 지나치게 맞춰진 상태를 과적합이라고 해요. 이때는 훈련 성적만 좋고 새로운 데이터에서는 성능이 떨어져요. 그래서 데이터를 훈련용과 검증용으로 나누어 일반화 성능을 확인해요. 정확도 하나만 보지 않고 정밀도와 재현율을 함께 보는 이유도 같아요. 어떤 오류가 더 큰 비용을 만드는지 정한 뒤 지표를 골라야 해요.":
    "Overfitting is when a model fits its training data too closely. It scores well in training but does worse on new data. That's why you split data into training and validation sets to check how well it generalizes. It's also why you look at precision and recall, not just accuracy. Decide which kind of error costs more, then choose your metric.",
  "지도학습 데이터에 반드시 함께 있어야 하는 것은 무엇인가요?":
    "What must supervised learning data always include?",
  "정답 레이블":
    "Correct labels",
  "무작위 잡음":
    "Random noise",
  "군집 개수":
    "Number of clusters",
  "보상 함수":
    "A reward function",
  "지도학습은 입력과 정답 레이블의 관계를 학습해요.":
    "Supervised learning learns the relationship between inputs and their correct labels.",
  "분류와 회귀":
    "Classification and regression",
  "다음 중 회귀 문제에 해당하는 것은 무엇인가요?":
    "Which of these is a regression problem?",
  "스팸 여부 판별":
    "Detecting spam",
  "강아지 품종 판별":
    "Identifying dog breeds",
  "주택 가격 예측":
    "Predicting house prices",
  "문서 주제 분류":
    "Sorting documents by topic",
  "가격처럼 연속된 수치를 예측하는 문제는 회귀예요.":
    "Predicting a continuous value like a price is regression.",
  "훈련 데이터의 정확도가 높으면 새로운 데이터에서도 항상 잘 작동한다.":
    "If a model is highly accurate on training data, it will always work well on new data.",
  "맞아요":
    "True",
  "아니에요":
    "False",
  "과적합된 모델은 훈련 성능은 높아도 새로운 데이터에서는 성능이 낮을 수 있어요.":
    "An overfit model can score high in training and still perform poorly on new data.",
  "평가 지표":
    "Evaluation metrics",
  "실제 양성을 놓치지 않는 것이 특히 중요할 때 우선 확인할 지표는?":
    "Which metric should you check first when missing a real positive is especially costly?",
  "학습 시간":
    "Training time",
  "파라미터 수":
    "Number of parameters",
  "파일 크기":
    "File size",
  "재현율은 실제 양성 중 모델이 찾아낸 비율이에요.":
    "Recall is the share of actual positives the model finds.",
  "검증 데이터":
    "Validation data",
  "검증 데이터는 모델의 일반화 성능을 점검하는 데 사용한다.":
    "Validation data is used to check how well a model generalizes.",
  "학습에 직접 쓰지 않은 데이터로 성능을 점검해야 과적합을 발견할 수 있어요.":
    "Only data the model never trained on can reveal overfitting.",
  "시험에 나오는 지도학습 정의":
    "Exam-ready definition of supervised learning",
  "시험에 나온다는 말과 중요하다는 강조를 감지했어요.":
    "Flagged because the lecturer said it's on the exam and stressed it as important.",
  "이 부분은 시험에도 자주 나오는 중요한 내용입니다.":
    "This part comes up on the exam a lot, so it's important.",
  "과적합 설명":
    "Overfitting explained",
  "꼭 기억하라는 강조를 감지했어요.":
    "Flagged because the lecturer said to make sure you remember it.",
  "여기는 꼭 기억해야 합니다.":
    "Make sure you remember this.",
  "평가 지표 비교":
    "Comparing evaluation metrics",
  "핵심 개념인 재현율의 근거 시점과 겹쳐요.":
    "Lines up with where the key concept, recall, is explained.",
  "정확도 하나만으로 모델을 판단하면 안 됩니다.":
    "Never judge a model on accuracy alone.",
  "6주차, 신경망 맛보기":
    "Week 6: A first look at neural networks",
  "인공지능개론_6주차.m4a":
    "Intro_to_AI_week6.m4a",
  "문제를 만들고 있어요":
    "Making questions",
  "활성화 함수 비교":
    "Comparing activation functions",
  "시각화 실습, 좋은 그래프의 조건":
    "Data viz lab: What makes a good chart",
  "데이터시각화_실습.mp4":
    "Data_visualization_lab.mp4",
  "여기서 핵심은 그래프를 고르기 전에 비교, 분포, 관계 중 무엇을 보여주려는지 먼저 정하는 것입니다.":
    "The key here is to decide what you want to show, a comparison, a distribution or a relationship, before you choose a chart.",
  "막대그래프의 축을 중간에서 자르면 작은 차이가 과장될 수 있으므로 독자가 오해하지 않도록 표시해야 합니다.":
    "Cutting a bar chart's axis partway up can exaggerate small differences, so mark it clearly so readers aren't misled.",
  "데이터의 목적에 맞는 차트를 고르고 축, 색상, 주석으로 왜곡 없이 메시지를 전달하는 실습이에요.":
    "A hands-on lab on choosing the chart that fits your data's purpose and using axes, color and labels to get the message across without distortion.",
  "메시지를 먼저 정한 뒤 차트를 고른다.":
    "Decide the message first, then pick the chart.",
  "축과 색상은 차이를 과장하지 않아야 한다.":
    "Axes and colors should never exaggerate differences.",
  "제목은 관찰 결과를 구체적으로 말한다.":
    "A title should state the finding specifically.",
  "차트 선택":
    "Choosing a chart",
  "비교, 분포, 관계 등 전달 목적에 맞춰 시각화 방식을 선택하는 과정":
    "Picking a visualization based on what you need to show: comparison, distribution or relationship",
  "여러 집단의 값 크기를 비교할 때 가장 먼저 고려할 차트는?":
    "Which chart should you consider first to compare values across several groups?",
  "막대그래프":
    "Bar chart",
  "산점도":
    "Scatter plot",
  "히트맵":
    "Heat map",
  "워드클라우드":
    "Word cloud",
  "범주별 값의 크기를 비교할 때는 막대그래프가 가장 직접적이에요.":
    "A bar chart is the most direct way to compare values by category.",
  "차트를 고르는 기준":
    "How to choose a chart",
  "핵심이라는 표현을 감지했어요.":
    "Flagged because the lecturer called it the key point.",
  "여기서 핵심은 그래프를 고르기 전에 전달 목적을 정하는 것입니다.":
    "The key here is to decide what you want to get across before you choose a chart.",
  "학습 동기와 자기효능감 세미나":
    "Seminar: Motivation and self-efficacy in learning",
  "교육심리학_세미나.m4a":
    "Educational_psychology_seminar.m4a",
  "기기에 저장됨":
    "Saved on device",
  "지도학습 강의자료 (PDF)":
    "Supervised learning slides (PDF)",
  "인공지능개론_지도학습.pdf":
    "Intro_to_AI_supervised_learning.pdf",
  "지도학습이 무엇인지부터 분류와 회귀의 차이, 데이터를 훈련용과 검증용으로 나누는 이유, 과적합을 알아채는 방법까지 다섯 쪽에 걸쳐 정리한 강의자료예요. 마지막 쪽은 정확도만 보면 안 되는 경우를 다뤄요.":
    "Five pages of lecture slides covering what supervised learning is, how classification and regression differ, why data is split into training and validation sets, and how to spot overfitting. The last page covers when accuracy alone isn't enough.",
  "지도학습은 입력과 정답이 짝지어진 데이터에서 둘 사이의 관계를 배운다.":
    "Supervised learning learns the relationship between paired inputs and answers.",
  "분류는 범주를 맞히고, 회귀는 숫자를 맞힌다.":
    "Classification predicts categories; regression predicts numbers.",
  "훈련 데이터와 검증 데이터를 나눠야 처음 보는 데이터에서의 성능을 알 수 있다.":
    "Splitting training and validation data shows how the model does on data it hasn't seen.",
  "훈련 성능만 오르고 검증 성능이 떨어지면 과적합이다.":
    "If training performance rises while validation performance falls, the model is overfitting.",
  "한쪽 답이 대부분인 데이터에서는 정확도가 성능을 속인다.":
    "When one answer dominates the data, accuracy misrepresents performance.",
  "입력과 정답이 짝지어진 데이터로 둘 사이의 관계를 배우는 방식":
    "Learning the relationship between inputs and answers from paired data",
  "데이터 분리":
    "Data splitting",
  "가진 데이터를 훈련용과 검증용으로 나눠 일반화 성능을 재는 절차":
    "Dividing your data into training and validation sets to measure how well a model generalizes",
  "훈련 데이터는 잘 맞히지만 새 데이터에서는 성능이 떨어지는 상태":
    "Getting the training data right but doing worse on new data",
  "지도학습이란 무엇인가":
    "What is supervised learning?",
  "지도학습은 입력과 정답이 짝지어진 데이터를 반복해서 보면서 둘 사이의 관계를 배우는 방식이에요. 사람이 미리 정답을 달아 둔 데이터가 필요하다는 점이 다른 방식과 갈라지는 지점이에요. 사진과 그 사진이 고양이인지 개인지가 함께 주어지면, 모델은 어떤 특징이 어느 쪽 답과 이어지는지를 스스로 찾아 나가요. 학습이 끝나면 정답이 없는 새 사진에도 답을 내놓을 수 있게 돼요.":
    "Supervised learning means learning the relationship between inputs and answers by looking at paired examples again and again. What sets it apart is that it needs data a person has already labeled with the right answer. Give a model photos along with whether each shows a cat or a dog, and it works out which features point to which answer. Once training is done, it can answer for new photos with no label.",
  "지도학습은 맞혀야 하는 답의 생김새에 따라 둘로 나뉘어요. 분류는 답이 범주일 때 쓰고, 회귀는 답이 숫자일 때 써요. 메일이 스팸인지 아닌지를 가리는 것은 분류이고, 내일 기온이 몇 도일지를 맞히는 것은 회귀예요. 같은 데이터라도 무엇을 묻느냐에 따라 둘 중 어느 쪽인지가 달라져요. 집값을 얼마인지 묻는 것은 회귀지만, 비싼지 싼지를 묻는 것은 분류예요.":
    "Supervised learning splits in two depending on what kind of answer you need. Classification is for answers that are categories; regression is for answers that are numbers. Deciding whether an email is spam is classification; predicting tomorrow's temperature is regression. The same data can be either, depending on the question. Asking what a house costs is regression, but asking whether it's expensive or cheap is classification.",
  "훈련 데이터와 검증 데이터":
    "Training data and validation data",
  "가진 데이터를 전부 학습에 쓰면 모델이 잘하는지 알 방법이 없어요. 시험 문제를 미리 알려 주고 시험을 보는 것과 같기 때문이에요. 그래서 데이터를 훈련용과 검증용으로 나누고, 검증용은 학습이 끝날 때까지 손대지 않아요. 보통 훈련에 70~80퍼센트를 쓰고 나머지를 남겨 둬요. 검증 데이터에서의 성능이 우리가 실제로 기대할 수 있는 성능이에요.":
    "If you train on all your data, you have no way to tell whether the model is any good. It's like seeing the exam questions before the exam. So you split the data into training and validation sets and leave the validation set untouched until training ends. Usually 70 to 80 percent goes to training and the rest is held back. Performance on the validation set is the performance you can actually expect.",
  "과적합을 알아채는 법":
    "How to spot overfitting",
  "과적합은 모델이 훈련 데이터를 외워 버린 상태예요. 훈련 데이터에서는 거의 다 맞히는데 검증 데이터에서는 눈에 띄게 못 맞히면 과적합을 의심해야 해요. 학습을 진행하면서 두 성능을 함께 그려 보면, 훈련 성능은 계속 오르는데 검증 성능이 어느 지점부터 떨어지기 시작하는 것이 보여요. 그 지점이 학습을 멈춰야 하는 곳이에요.":
    "Overfitting is when a model has memorized its training data. If it gets almost everything right on the training data but noticeably worse on the validation data, suspect overfitting. Plot both scores as training goes on and you'll see training performance keep rising while validation performance starts to drop at some point. That point is where training should stop.",
  "정확도만 보면 안 되는 이유":
    "Why accuracy alone can mislead",
  "답이 한쪽으로 크게 치우친 데이터에서는 정확도가 성능을 속여요. 천 명 중 열 명만 병에 걸린 데이터라면, 전부 건강하다고 답하는 모델도 정확도가 99퍼센트예요. 정작 찾아내야 할 열 명은 한 명도 못 찾았는데도요. 그래서 이런 데이터에서는 실제 환자 중 몇 명을 찾아냈는지, 환자라고 답한 사람 중 몇 명이 진짜였는지를 함께 봐야 해요.":
    "When answers lean heavily to one side, accuracy lies about performance. If only 10 people in 1,000 are sick, a model that says everyone is healthy is still 99 percent accurate, even though it found none of the 10 people it needed to find. With data like this, also check how many real patients it found, and how many of the people it flagged were really sick.",
  "지도학습에 반드시 필요한 것은 무엇인가요?":
    "What does supervised learning absolutely need?",
  "입력과 정답이 짝지어진 데이터":
    "Data with inputs paired to correct answers",
  "정답이 없는 대량의 데이터":
    "Large amounts of unlabeled data",
  "사람의 실시간 개입":
    "A person stepping in in real time",
  "데이터를 나누지 않은 전체 집합":
    "The full dataset, never split",
  "지도학습은 사람이 미리 정답을 달아 둔 데이터가 있어야 입력과 정답의 관계를 배울 수 있어요.":
    "Supervised learning can only learn the link between inputs and answers if someone has labeled the data first.",
  "내일 기온이 몇 도일지 맞히는 문제는 어디에 해당하나요?":
    "Predicting tomorrow's temperature is what kind of problem?",
  "회귀":
    "Regression",
  "분류":
    "Classification",
  "군집화":
    "Clustering",
  "차원 축소":
    "Dimensionality reduction",
  "맞혀야 하는 답이 숫자이므로 회귀예요. 범주를 맞히면 분류예요.":
    "The answer is a number, so it's regression. Predicting a category would be classification.",
  "검증 데이터를 학습에 쓰지 않고 남겨 두는 이유는 무엇인가요?":
    "Why hold validation data back from training?",
  "처음 보는 데이터에서의 성능을 재기 위해":
    "To measure performance on data the model hasn't seen",
  "학습 속도를 높이기 위해":
    "To speed up training",
  "데이터 용량을 줄이기 위해":
    "To reduce data size",
  "정답을 지우기 위해":
    "To erase the answers",
  "학습에 쓴 데이터로 성능을 재면 시험 문제를 미리 알려 준 셈이라, 실제 성능을 알 수 없어요.":
    "Measuring performance on training data is like handing out the exam questions in advance; you can't learn the real performance.",
  "과적합이 일어나고 있다는 가장 분명한 신호는 무엇인가요?":
    "What's the clearest sign that a model is overfitting?",
  "훈련 성능은 오르는데 검증 성능이 떨어진다":
    "Training performance rises while validation performance falls",
  "훈련 성능과 검증 성능이 함께 오른다":
    "Training and validation performance rise together",
  "두 성능이 모두 낮게 유지된다":
    "Both stay low",
  "학습이 시작되지 않는다":
    "Training never starts",
  "모델이 훈련 데이터를 외워 버리면 훈련 성능만 계속 오르고 검증 성능은 떨어지기 시작해요.":
    "Once a model memorizes its training data, training performance keeps climbing while validation performance starts to fall.",
  "천 명 중 열 명만 환자인 데이터에서 정확도가 위험한 이유는 무엇인가요?":
    "If only 10 in 1,000 people are sick, why is accuracy risky?",
  "전부 건강하다고 답해도 99퍼센트가 나오기 때문":
    "Saying everyone is healthy still scores 99 percent",
  "정확도 계산이 느리기 때문":
    "Accuracy is slow to compute",
  "환자 수가 매일 바뀌기 때문":
    "The number of patients changes daily",
  "정확도는 회귀에서만 쓰이기 때문":
    "Accuracy only applies to regression",
  "답이 한쪽으로 치우치면 아무것도 못 찾는 모델도 정확도가 높게 나와요. 찾아낸 비율을 함께 봐야 해요.":
    "When answers lean heavily one way, even a model that finds nothing scores high accuracy. Check how many it actually found.",
  "인공지능 개론":
    "Intro to AI",
  "2026학년도 2학기, 컴퓨터공학과":
    "Fall 2026, Computer Science",
  "매주 강의를 녹음하고 마인드팩으로 복습해요.":
    "Record each week's lecture and review it with a Mind Pack.",
  "김프리마인드":
    "Alex Kim",
  "데이터 분석 실습":
    "Data analysis lab",
  "사내 데이터 리터러시 과정":
    "Company data literacy course",
  "실습 영상을 올려 개념과 문제로 복습해요.":
    "Upload lab videos and review them as concepts and questions.",
  "교육심리학 세미나":
    "Educational psychology seminar",
  "교육학과 전공 세미나":
    "Education major seminar",
  "세미나 녹음을 짧게 정리해서 복습해요.":
    "Short notes from each seminar recording, ready to review.",
  "인공지능 개론 5주차 마인드팩":
    "Intro to AI week 5 Mind Pack",
  "좋은 그래프의 조건":
    "What makes a good chart",
};
