# 프리마인드 PREMIND 검색 메타데이터 (SEO, AEO, GEO)

2026-10-04. 스토어 제목을 "프리마인드 PREMIND - 녹음 요약, 영상 공부"로 바꾸면서, 웹과 AI 답변에서도
같은 이름과 같은 한 문장 정의가 보이도록 정리한 문서예요.

- **학생 웹(premind.co.kr/app, /student)은 2026-10-05 에 접었어요.** 학생용 소개는 새 도메인으로 따로 가요.
  아래의 `https://새도메인` 을 정해진 주소로 바꿔서 그 사이트의 `<head>`와 본문에 넣어 주세요.
  주소가 정해지기 전에는 앱 다운로드 링크(Play 스토어)가 정식 소개 주소 역할을 해요.

## 1. 이름과 한 문장 정의 (모든 곳에서 똑같이)

| 쓰는 곳 | 표기 |
| --- | --- |
| 브랜드 | 프리마인드 (PREMIND) |
| 스토어 제목 | 프리마인드 - AI 녹음 요약, 강의 필기 공부앱 |
| 한 문장 정의 | 프리마인드(PREMIND)는 강의를 녹음하거나 영상, 유튜브 링크, PDF를 올리면 AI가 대본, 요약, 마인드맵, 문제를 만들어 주는 공부 앱이에요. |

AI 답변 엔진(ChatGPT, Perplexity, Gemini, 네이버 Cue:)은 여러 곳에서 **같은 문장**을 볼수록 그 문장을
정의로 인용해요. 스토어 설명 첫 줄, 소개 페이지 첫 문단, 아래 구조화 데이터의 `description`을 이 문장으로 맞춰요.

## 2. 키워드 묶음

- 핵심: 강의 녹음, 녹음 요약, 영상 요약, 유튜브 요약, PDF 요약, AI 공부 앱, AI 노트
- 기능: 음성 텍스트 변환, 받아쓰기, 자막, 마인드맵, 퀴즈, 암기 카드, 복습
- 대상: 대학생 필기, 인강 정리, 자격증 공부, 시험 공부, 발표 연습, 면접 연습

## 3. 소개 페이지 `<head>`

```html
<title>프리마인드 PREMIND - 강의 녹음 요약, 유튜브와 PDF를 AI로 정리하는 공부 앱</title>
<meta name="description" content="프리마인드(PREMIND)는 강의를 녹음하거나 영상, 유튜브 링크, PDF를 올리면 AI가 대본, 요약, 마인드맵, 문제를 만들어 주는 공부 앱이에요. 무료로 시작해요." />
<link rel="canonical" href="https://새도메인" />
<meta property="og:title" content="프리마인드 PREMIND - 녹음 요약, 영상 공부" />
<meta property="og:description" content="강의 녹음 한 번에 대본, 요약, 마인드맵, 문제까지. 유튜브 영상, PDF도 AI가 정리해요." />
<meta property="og:url" content="https://새도메인" />
<meta property="og:image" content="https://새도메인/og.png" />
<meta name="twitter:card" content="summary_large_image" />
```

## 4. 구조화 데이터 (JSON-LD, `<head>` 끝에)

검색 엔진이 앱 정보와 자주 묻는 질문을 그대로 읽어 가요(AEO). 가격과 분량은 실제 요금과 같아야 해요.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://premind.co.kr/#org",
      "name": "프리마인드 PREMIND",
      "alternateName": ["PREMIND", "프리마인드", "(주)캐모릭스"],
      "url": "https://premind.co.kr",
      "logo": "https://premind.co.kr/apple-touch-icon.png",
      "email": "support@camorix.com"
    },
    {
      "@type": "MobileApplication",
      "name": "프리마인드 PREMIND - 녹음 요약, 영상 공부",
      "alternateName": ["PREMIND", "프리마인드"],
      "description": "프리마인드(PREMIND)는 강의를 녹음하거나 영상, 유튜브 링크, PDF를 올리면 AI가 대본, 요약, 마인드맵, 문제를 만들어 주는 공부 앱이에요.",
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Android",
      "inLanguage": "ko",
      "url": "https://새도메인",
      "downloadUrl": "https://play.google.com/store/apps/details?id=kr.co.premind.premind",
      "publisher": { "@id": "https://premind.co.kr/#org" },
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "KRW", "description": "무료 플랜 매달 120분" },
      "featureList": ["강의 녹음", "음성 텍스트 변환", "AI 요약", "마인드맵", "문제와 암기 카드", "유튜브 요약", "PDF, PPT 쪽별 요약", "발표 평가", "면접 연습"]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "프리마인드는 어떤 앱인가요?",
          "acceptedAnswer": { "@type": "Answer", "text": "강의 녹음, 영상, 유튜브, PDF를 AI가 대본, 요약, 마인드맵, 문제로 정리해 주는 공부 앱이에요." } },
        { "@type": "Question", "name": "유튜브 영상도 요약되나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "공개된 유튜브 영상 링크를 붙여 넣으면 대본과 요약, 문제를 만들어요." } },
        { "@type": "Question", "name": "PDF와 PPT도 되나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "글자가 있는 PDF와 PPTX를 쪽 단위로 읽어 요약해요. 스캔한 이미지 PDF는 읽지 못해요." } },
        { "@type": "Question", "name": "무료로 쓸 수 있나요?",
          "acceptedAnswer": { "@type": "Answer", "text": "무료 플랜은 매달 120분을 쓸 수 있어요. 영상과 음성은 1분에 1분, 문서는 1쪽에 1분을 써요." } }
      ]
    }
  ]
}
</script>
```

`FAQPage`의 질문과 답은 **페이지 본문에도 똑같이 보여야** 해요(구글 정책). 소개 페이지 아래쪽에
"자주 묻는 질문" 구역으로 같은 네 문답을 넣어 주세요.

## 5. AI 크롤러용 요약 (GEO, `https://새도메인/llms.txt`)

```text
# 프리마인드 PREMIND

> 프리마인드(PREMIND)는 강의를 녹음하거나 영상, 유튜브 링크, PDF를 올리면 AI가 대본, 요약, 마인드맵, 문제를 만들어 주는 공부 앱이에요.

- 앱: https://play.google.com/store/apps/details?id=kr.co.premind.premind
- 소개: https://새도메인
- 요금: 무료 매달 120분, 스탠다드 매달 1,200분. 영상과 음성은 1분에 1분, 문서는 1쪽에 1분.
- 기능: 강의 녹음과 자막 녹음, 음성 텍스트 변환, AI 요약, 마인드맵, 문제와 암기 카드, 유튜브 요약, PDF와 PPT 쪽별 요약, 발표 평가, 면접 연습
- 만든 곳: (주)캐모릭스, support@camorix.com
```

`robots.txt`에서 GPTBot, ClaudeBot, PerplexityBot, Google-Extended 를 막고 있지 않은지도 확인해 주세요.
막혀 있으면 AI 답변에 소개 페이지가 인용되지 않아요.

## 6. 체크리스트

- [ ] Play Console 한국어 제목, 간단한 설명, 자세한 설명 교체 (`listing-ko.md`)
- [ ] Play Console 영어(en-US) 번역 추가 (`listing-en.md`)
- [ ] 새 도메인 `<head>` 메타와 JSON-LD, 본문 FAQ 반영
- [ ] 새 도메인의 /llms.txt 추가, robots.txt 확인
- [ ] 네이버 서치어드바이저, 구글 서치 콘솔에 /student 색인 요청
