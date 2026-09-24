# 로컬 중요 구간 후보 생성기

`generateLocalHighlightCandidates`는 완성된 대본을 기기 안에서 규칙 기반으로
검사한다. 네트워크나 AI 모델을 호출하지 않으며 다음 단서만 사용한다.

- 강사의 `중요`, `시험`, `기억`, `핵심`, `다시 말하면`, `정리하면` 같은 표현
- 기존 대본의 `isImportant` 표시
- 마인드팩에 이미 들어 있는 개념과 근거 시점
- 정의를 설명하는 문장과 여러 대본 구간에서 반복되는 의미 있는 용어

```ts
import { generateLocalHighlightsForMaterial } from '@/features/highlights';

const candidates = generateLocalHighlightsForMaterial(material, {
  maxCandidates: 8,
  minimumConfidence: 0.5,
});
```

각 결과에는 타임스탬프, 근거 원문 문장, 판단 이유, 감지한 단서와 `0...1`
신뢰도 점수가 포함된다. 신뢰도는 후보를 정렬하기 위한 휴리스틱 점수이지,
정확도를 보장하는 확률이나 운영 AI 모델의 결과가 아니다. 화면이나 저장소에서
사용할 때에도 `source: 'local-heuristic'` 출처를 유지해야 한다.
