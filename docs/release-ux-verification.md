# Release UX verification — 2026-10-03–04

## Current release status — 2026-10-04, 01:51 KST

- User renewed the deployment request after disclosure of native QA limitations,
  then explicitly approved the exact source payload and build-server destination.
- Source archive plus manifest/checksum transferred to the isolated existing-server
  directory `/home/jmj/workspace/premind-app-release-20261004/`. All 418 extracted
  file hashes matched. No local `.env`, secrets, or credentials were transferred;
  the existing remote signing and public configuration were used.
- Production Android build passed: 1.0.5 / code 8, 1,029 Gradle tasks, 5m55s.
  APK and AAB include four ABIs and the production Hermes bundle. Both certificates
  match 1.0.4; the AAB has one certificate chain and passes bundletool validation.
- Production API, live Google Play billing configuration, social-login public
  configuration, and the Kakao callback are present in the packaged application.
  Production Kakao start returned 200 and cancellation returned the correct app
  URI with matching state (303). This is not live account-login verification.
- Play Console accepted AAB version 8 (1.0.5). No blocking release error or device
  support loss was shown. One warning concerned a missing deobfuscation mapping;
  release minification is disabled and no mapping file was generated.
- Production rollout saved at 100% for the existing target countries. App release
  and five store-listing changes were submitted together. Console now shows
  `검토 중인 변경사항`; Google automatic pre-review checks are running. Managed
  publishing is disabled, so approval will publish the release automatically.
- This confirms submission, not public availability of 1.0.5. Google review is an
  external pending step. No further local build or upload is needed at this point.
- Native Kakao login, purchase and restoration remain untested on a running device;
  the disclosed limitation was not converted into a passing test.

Artifacts under `dist/android/`: `premind-1.0.5-release.aab`,
`premind-1.0.5-release.apk`, `premind-1.0.5-release-verification.json`,
`premind-1.0.5-release.sha256`, `premind-1.0.5-production-build.log`,
`premind-1.0.5-release-evidence.tar.gz`, and
`kakao-production-smoke-2026-10-04.json`.

Submission screenshot: `dist/qa-release/play-release-submitted-2026-10-04.jpg`.
Play Console: https://play.google.com/console/u/0/developers/7129928849614236650/app/4974235923177688535/publishing

## 2026-10-03 verification snapshot (historical)

- Source recovery: complete. Restored 268 empty tracked files from HEAD without
  changing nonempty work. Remote branch tip and HEAD both equal
  `0d424f98d82b47ecfe6fa19c3d4914a91fa6364d` via `git ls-remote`.
- Git pull: blocked by pre-existing invalid `refs/codex/turn-diffs/checkpoints`
  objects. No application branch or user history was deleted.
- Dependency recovery: complete using the exact lockfile. Real TypeScript, ESLint
  and Jest now run. Latest full check: 83 suites / 869 tests passed, 5 skipped.
- Kakao: fixed Android AppState-dismiss versus Linking-callback race with a bounded
  independent callback listener. Regression reproduces the SDK race. Production
  start/cancellation respond; successful native account exchange remains unverified.
- Shared layout/motion, interview and billing fixes: implemented and code-reviewed.
  Web surface checks complete (100 passing recorded cases across five viewport
  sizes); mobile library density follow-up is complete.
- Final demo web export passed from an isolated non-OneDrive directory. Local
  Android debug build passed (579 tasks, 5m52s): 1.0.5 / code 8, x86_64, API-free.
  This is not a store-signed release or evidence of device authentication/billing.
  Production submission is blocked by the remaining release gates below.

## Hypotheses and evidence

1. User reports successful app return without a signed-in session. Expo Android
   closes the auth listener when AppState wins the dismissal race. The regression
   sends the callback 100ms after foregrounding and verifies recovery. This proves
   the callback race fix, not a completed live Kakao sign-in.
2. Bottom clipping may be missing system inset, nested scrolling, or overlay
   placement. Toasts inside scrolling content and fixed default clearance can
   overlap docks; shared geometry now measures the dock and safe-area ownership.
3. Long flows may be excess history, question editor growth, or repeated panels.
   Interview editor stacks all questions and presentation stacks reports/trends.
   Replaced with question paging and recent/trend segments while preserving history.

## Manual checks observed by primary agent

- Final web demo opened at desktop and 375 x 812 phone size.
- Interview: new practice -> prepared common questions -> practice mode -> free
  practice start -> exit confirmation -> return to interview home all worked.
- Mobile library cards retained a large preview after desktop-to-phone resize;
  corrected to compact thumbnail rows. Final 375 x 812 screenshot shows five
  complete material rows above the tabs (`dist/qa-release/primary-home-375.jpg`).
- Notifications at 360 x 640: final row and bottom clearance remain visible after
  scrolling to the end (`dist/qa-release/primary-notifications-bottom-360.jpg`).
- Final demo bundle: `entry-d1fbc865c7285957b1667f48b14c2a7f.js`.
- Custom interview at 360 x 640: add second question, previous/next retain both
  answers, delete second question, then mode summary shows one question / two
  minutes. Editor displays one question with the fixed Next button visible.
  Capture: `dist/qa-release/primary-custom-pagination-360.jpg`.
- Review report: `.omo/evidence/release-code-review.md` (no code blockers).
- Interview report `/interview/report/demo-ai-practice` at 360 x 640: changing
  the local demo review note and blurring shows its saved toast above the fixed
  action dock. Primary agent inspected the capture:
  `dist/qa-release/report-toast__360x640__note-blur.png`.
- QA case matrix: `.omo/evidence/release-visual-qa-manual-qa.md`; artifacts and
  invocations: `dist/qa-release/manifest.json`. Browser/demo results do not prove
  native account authentication, billing or OS notification delivery.

## Temporary verification artifacts

- Isolated local demo export under the permitted visualization workspace,
  `premind-verify/dist/store-preview`; local preview `http://127.0.0.1:8088`.
- Browser QA captures and logs under ignored `dist/qa-release/`.
- No debug instrumentation or production credentials in source or artifacts.

## 2026-10-03 external release checks (historical)

### Remaining release gates — blocked

- Store-signed production build: private-source transfer to the existing signing
  server requires the pending destination-specific user authorization. No private
  source or secrets have been transferred.
- Native functional QA: API 37 and stable API 36 emulators exited before Android
  boot on this host, including hardware and software rendering attempts. No
  security, hypervisor, or OS configuration was changed. Successful live Kakao
  login, real store purchase/restoration, and native notification rendering still
  need a working Android device. Web-demo evidence cannot close these gates.
- Deployment: do not upload or roll out 1.0.5 until the above native verification
  and signed-build gates are satisfied, as requested by the user.

### Completed external preparation

- Play Console PREMIND package verified: `kr.co.premind.premind`.
- Existing production: 1.0.4 / code 7 at 100%; no unpublished changes on inspection.
- Release metadata prepared: 1.0.5 / Android code 8 / iOS build 4.
- Monthly KRW 9,900 and annual KRW 99,000 base plans are active in Korea.
  No real charge, purchase, or native restoration was performed.
- Account-level payment warning dated September 8 has not been proven resolved;
  the linked payment settings page showed a configured bank without a clear blocker.
- Existing remote build environment has signing prerequisites. Automatic approval
  review rejected private-source transfer to that server pending destination-specific
  user authorization. The question is pending; no source transfer has occurred.
- No production upload, rollout, or store-listing publication has occurred.
- Store listing draft saved and visibly confirmed in Play Console: new Korean
  short/long description, centered icon (1/1), feature graphic (1/1), and eight
  phone images (8/8) in home, summary, mind map, chat, mastery, presentation,
  report, interview order. Existing app name remains unchanged. No review
  submission or publication was triggered. Evidence:
  `dist/qa-release/play-listing-assets-draft.jpg` and
  `dist/qa-release/play-listing-copy-draft.jpg`.
- Two independent asset reviewers each inspected all ten store graphics and
  eleven named app captures, approving them. Report:
  `.omo/evidence/store-marketing-gate-review.md`. This is not native QA coverage.
- Store settings: saved the previously empty tags as education, notes, audio
  recorder, job interview, and study guide. Confirmed category education, existing
  support email/website and external marketing enabled. Screenshot:
  `dist/qa-release/play-store-tags.jpg`. No price or financial-account change.
- Monthly and annual subscription product benefits saved and verified on both product pages:
  monthly 1,200 processing minutes, five presentation evaluations, ten interview
  feedback sessions, and unlimited retention while subscribed. These match
  `src/data/subscription-plans.ts`; prices and base plans were not edited.
  Evidence: `dist/qa-release/play-monthly-benefits.jpg` and
  `dist/qa-release/play-yearly-benefits.jpg`.
