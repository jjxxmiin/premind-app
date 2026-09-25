# PREMIND design system

The app follows the visual language of leading Korean consumer AI apps
(reference: 뤼튼 / wrtn, 2024): a white canvas, near-black type, hairline
borders, one accent colour used only where attention is earned, and flat
surfaces. Depth comes from tone and borders, never from big shadows or
illustrated hero panels.

Everything below is enforced by `src/theme/tokens.ts` and the primitives in
`src/components/ui`. Screens compose those; they do not invent styles.

## Canvas and colour

| Role | Token | Value |
| --- | --- | --- |
| Screen background | `colors.background` | `#FFFFFF` |
| Quiet fill (feature tiles, input bars) | `colors.backgroundSoft` | `#F7F7F8` |
| Stronger fill (segmented track, secondary button) | `colors.backgroundMuted` | `#EFF0F3` |
| Hairline | `colors.border` | `#ECEDF0` |
| Input / chip border | `colors.borderStrong` | `#DCDEE3` |
| Text | `colors.text` | `#17171B` |
| Secondary text | `colors.textMuted` | `#6B6E76` |
| Placeholder / tertiary | `colors.textFaint` | `#8A8D96` |
| Filled CTA | `colors.action` | ink |
| Accent | `colors.brand` | `#E25A1C` |
| Accent tint | `colors.brandSoft` | `#FDEFE6` |

Rules:

- The screen is white. Do not tint whole screens; tint a tile.
- The accent appears in: the active tab, a live/recording state, a
  `StatusBadge tone="brand"`, and the `Button variant="brand"` on the one
  screen whose job is the product's core action (start recording). Everywhere
  else, filled buttons are ink (`variant="primary"`).
- Never use `palette.accentNNN` directly for borders or backgrounds in a
  screen. Use `colors.brandSoft` for the tint and `colors.brand` for the mark.
- Shadows: none on cards. `shadows.floating` only for a sheet, dialog, or a
  sticky bottom bar. `shadows.subtle` only for the selected segment.

## Type

Pretendard. Sizes are fixed in `typography`:

| Variant | Use |
| --- | --- |
| `display` 28 | Onboarding / marketing only |
| `heroTitle` 24 | The one big line of a focused flow (login, record) |
| `pageTitle` 22 | Greeting or page title in the body |
| `heading` 17 | Section titles, header titles, dialog titles |
| `itemTitle` 15 bold | Row and card titles |
| `body` 15 | Paragraphs, settings rows |
| `meta` 13 | Secondary lines under a title |
| `badge` 12 bold | Status badges, tiny captions |

Do not use `fontFamilies.black`. Do not set `fontSize` inline; pick a variant.

## Layout and spacing (the rules every screen follows)

Safe areas — the single most common source of "bottom is cut off" on
Android (edge-to-edge draws under the navigation bar):

- A **stack screen** (anything that is not a tab root) renders `<Screen>` with
  the default edges (all four). Its scroll view therefore ends above the
  system navigation bar. A bottom-pinned bar uses `paddingTop: spacing.md`
  and `paddingBottom: spacing.gutter` (20) — a button 12pt from the edge
  reads as crammed against it. Never add `insets.bottom` yourself.
- A **tab root** passes `safeAreaEdges={['top','left','right']}`; the tab bar
  owns the bottom inset.
- The chat is its own screen (`/chat/[id]`): message list fills the
  screen, the composer is pinned outside the scroll view, and Android uses
  `softwareKeyboardLayoutMode: resize` so it stays above the keyboard. Never
  embed a composer inside a page ScrollView.
- Chat answers come from the server (`/api/recordings/{id}/ask`), written
  from the transcript rather than quoted from it, with the lines they used
  as 근거 chips. Demo and offline fall back to on-device retrieval.

Horizontal:

- One gutter: `spacing.gutter` (20) on every screen edge, in every list row,
  in every bottom bar. Full-bleed elements (the folder strip, a band between
  settings groups) compensate with `marginHorizontal: -spacing.gutter`.
- Inside a card: `spacing.gutter` (20) padding for content cards, `spacing.md`
  (12) for compact rows. Never 14, 18, 22.
- Two controls side by side (a dialog's 취소/만들기, a bottom bar's pill and
  button) sit `spacing.md` (12) apart, not 8: at 8 they read as one blob.
  8 is for an icon next to its label, never between two tappables.
- Two full-width buttons stack rather than share a row when one is clearly
  the main action. A row of two equal buttons says they are equal.
- An action whose only feedback is an icon changing state (saving, copying)
  shows a `Toast`. A greyed-out control that is disabled most of the time
  (the filter sheet's 초기화) is not rendered at all until it can act.

Vertical rhythm (top → bottom):

- Header (56) → first block: `spacing.sm` (8).
- Between blocks/sections: `spacing.xl` (24).
- Section title → its content: `spacing.md` (12).
- Row height: 68 default, 54 compact; row internal gap 12; badge line 4 under meta.
- Bottom bar: hairline on top, `spacing.md` (12) vertical padding, 52pt button.
- Last scroll content → end: `spacing.xxl` (32) so the final row clears a bar.

Alignment: text blocks and icon wells share the 20pt gutter line; a row's
trailing control sits in a fixed 44pt column so text never runs under it.

## Copy (2026-09-06 mobile rewrite)

The product is now a personal study app: one learner, their own lectures,
studying alone on a phone. Every string follows this:

- Voice: 해요체, short, direct. One idea per sentence. No "~합니다".
- Object names: **마인드팩** (the study pack), **폴더** (the group a 자료 lives
  in), **자료** (a recording/file/link/PDF/slide deck), **대본** (transcript),
  **요약**, **마인드맵**, **문제** (never 퀴즈 in body copy; "문제 풀기"),
  **질문** (the chat), **평가**.
- 폴더, not 과목 (2026-09-07): the app takes PDFs and slide decks too, so the
  group is named after what it does — it holds things — not after a school
  subject. The code still says `Project`/`projectId`; only the copy changed.
- Retired words — never show them: 과목, 학습팩, 프로젝트, 공부방, 공유방,
  강의자, 교수자, 학생, 청중, 선생님, 워크스페이스, 라이브러리, 세션,
  미리보기(for the demo), 서버(in user-facing text — say "처리 중" / "만드는 중").
- Retired framing: "수업을 녹음하고 학생에게…" → "강의를 녹음하면 마인드팩이
  만들어져요". The app never addresses a teacher.
- Titles: nouns, ≤ 8 chars, no period (녹음, 내 자료, 평가, MY, 검색).
- Buttons: verb phrases ≤ 6 chars (녹음 시작, 파일 선택, 문제 풀기, 저장).
- Empty states: what is missing + one action ("아직 자료가 없어요" / "녹음 시작").
- Errors: what happened + what to do, ≤ 2 sentences, no error codes.
- Status badges: 2–4 chars (진행 중, 이어가기, 확인 필요, 평가 중).
- **No middot (·) anywhere.** Lists of words use a comma (대본, 요약, 노트);
  metadata separators use a slash with spaces (인공지능 개론 / 46:51 / 4일 전).
- Model-written prose is cleaned on arrival (`src/lib/ai-text.ts`, applied in
  the API client): a middot the model slipped in becomes a comma. The
  prompts ask for 해요체 and forbid the middot as well, so this is a net,
  not the rule.
- Numbers: "3개", "52:14", "4일 전"; never "3 개".

## Information architecture (2026-09-05)

The app mirrors the PREMIND web product and the conventions of leading
Korean AI note-takers: the list is the home.

| Tab | Screen | Purpose |
| --- | --- | --- |
| 홈 | 내 자료실 | A strip of 전체, 저장함 (only once something is bookmarked) and the 폴더 pages, with a pinned plain "+" icon; swiping the list pages between folders. Search, 올리기 (파일, 유튜브 링크) and 알림 are header icons. Filters live in a sheet. |
| 이해도 | 이해도 | Per-material 이해도 (quiz accuracy + checked key points, computed on device), 이번 주 card, rows open `/mastery/[id]`. |
| 추가 | — | Not a tab: opens the 자료 추가 sheet on 홈 with 녹음하기, 파일 올리기 (PDF, 슬라이드, 영상, 음성) and 유튜브 링크. One place for every way to start a 마인드팩. |
| 평가 | 발표 평가 | 내 발표 연습: PREMIND Lens on the learner's own recording (`/report/[id]`), 새 평가 시작 sheet, 추이 card. Evaluation only ever starts from here; the server refuses a recording with too little real speech (422), and every run is kept, so the report shows 평가 이력. |
| 면접 | 면접 연습 | (2026-09-26, interview.premind.co.kr 을 앱으로) 이어서 하기, 연습 시작(자기소개서, 질문 세트, 직접 만들기), 이번 달 AI 피드백 횟수, 최근 연습, 초대 코드와 기관 현황. 준비(`/interview/prepare`) → 면접실(`/interview/room/[id]`, 어두운 stage) → 결과 준비 → 결과(`/interview/report/[id]`). 점수, 합격 가능성, 성격은 말하지 않는다. 녹음과 영상은 기기에만, 글은 계정 백업(`/api/interview/backups`). |
| MY | 설정 | Notifications, upload policy, recording quality, 구독 (informational on native, checkout on the web only), 사용 가이드, 문의, terms, privacy, account. |

The product is for studying alone (2026-09-06): there is a single learner mode, and
sharing (공부방) is reached from a material's menu rather than a tab.

A study pack (`/material/[id]`) has four full-width tabs (요약, 대본, 마인드맵,
카드) and one player. 요약 leads and is what the screen opens on without an
explicit `?tab=`, because it is what a reader wants the moment a pack
finishes. The bottom bar holds an "이 자료에 물어보기" pill
(opens `/chat/[id]`) and "문제 풀기". 요약 carries the checkable "꼭 기억할
내용" list (learner state in `studyNotes`). The transcript follows
playback; every timestamp seeks. YouTube materials play through the YouTube
player and otherwise behave identically.

## Components and when to use them

- `Card` — `default` (white + hairline) contains lists; `soft` (grey fill)
  is a feature tile or a quiet panel; `outlined` is a selectable option;
  `stage` is dark.
- `ListRow` — a row inside a `Card padding={false}`. Title + meta + chevron.
  Use `compact` for menus.
- `SettingsGroup` / `SettingsRow` — the settings screen. Groups are separated
  by the canvas, not by cards. Destructive rows use `tone="negative"`.
- `Chip` — pill filter, ink when selected. `StatusBadge` — small tinted label.
- `SegmentedControl` — grey track, white selected segment.
- `AuthField` — every text input. Caption above, 48pt shell, ink border on
  focus, red on error.
- `Button` — `primary` (ink) is the default CTA; `brand` for the core action;
  `secondary` (grey fill) for the quiet alternative; `outline` for bordered;
  `ghost` for inline links.
- `Dialog` — centred confirm with two buttons (grey cancel / ink confirm).
- `BottomSheetModal` — option pickers; white sheet with a handle.
- `Skeleton` / `SkeletonLines` — loading placeholders. Prefer them over
  spinners for content areas.
- `EmptyState` — line icon in a grey circle, one title, one sentence, one
  button.
- `MediaArtwork` — the thumbnail for a recording (flat grey tile).
- `PromoCarousel` — flat tinted tip cards.

