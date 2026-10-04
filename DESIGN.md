# PREMIND release UX contract

The canonical design system is [docs/design-system.md](docs/design-system.md).
All existing tokens in `src/theme/tokens.ts` and Pretendard fonts remain authoritative.

## 1. Product and audience

A learner turns their own material into a study pack and practices speaking.
Lead with concrete outcomes: summaries, questions grounded in the material, and
actionable speaking feedback. Do not promise grades, hiring success, or invented savings.

## 2. Visual system

White canvas, ink actions, one orange accent. Use the canonical typography,
spacing, borders and radii. Product screens compose `src/components/ui`.
Keep the shipped brand mark; center launcher artwork in its Android safe zone.

## 3. Layout

Each screen has one scrolling owner and a visible next action. Long libraries
remain virtualized. Dashboards show concise summaries and deliberate paths to
history. Optional detail belongs behind a tab, sheet, or explicit action.
Safe areas, keyboard avoidance and bounded sheets belong to shared primitives.
Verify narrow phones, short landscape windows, tablets and desktop.

## 4. Motion and accessibility

Use shared motion tokens for navigation and state changes. Respect reduced
motion. Preserve touch targets, readable Korean wrapping, focus visibility and
screen-reader labels. A sheet's last control must remain reachable.

Navigation pushes move from the right; root/auth changes and sibling tabs fade.
Tabs and root fades use `motion.duration.fast`; stack duration uses
`motion.duration.standard` where native navigation supports a custom duration.
Capture enters from the bottom as a modal. Sheets and confirmations fade as a
single layer; reduced motion disables their transition and all route animations.
Native presentation and gesture timings remain owned by the platform.

`Screen.overlay` sits outside its scroll region, within the screen safe area.
`BottomAction` consumes a bottom inset only if its enclosing `Screen` did not,
and reports its measured height so `Toast` clears the actual controls, including
large text. Sheets constrain their body to the keyboard-safe layout region;
confirmation dialogs scroll when their copy and actions exceed that region.

## 5. Reusable components and states

Existing Button, IconButton, Card, ListRow, EmptyState, AuthField,
SegmentedControl, BottomSheetModal, Dialog, Screen and Toast are the foundation.
Verify idle, pressed, disabled, loading, error and success where applicable.
Interview questions use one-question paging with visible progress and navigation.
Interview preparation separates common/company questions and the editor.
Organization and history actions remain discoverable through compact menus.
Presentation dashboards separate recent reports and progress with segments.

## 6. Conversion and payment

Explain the benefit before requesting commitment. Show actual store prices,
billing period and renewal terms before purchase. Keep restore, cancellation and
subscription management reachable. Never portray cancellation or pending payment
as a failed purchase; never promise an unverified entitlement.

## 7. Release evidence and debt

Screenshots must represent the current product and identify demo/web captures.
Unit tests and web QA cannot substitute for real native OAuth and Play Billing
checks. Record those limitations and deployment prerequisites in the release notes.
