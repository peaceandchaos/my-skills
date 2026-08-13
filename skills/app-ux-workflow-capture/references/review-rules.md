# Review Rules

Use these rules when reviewing or debugging an app UX workflow capture.

## Naming

- Keep numeric prefixes chronological after the final export.
- If inserting a missed screen, renumber later files rather than using `014a` or side folders.
- Prefer the most visible title, question, or functional UI state.
- Clean obvious OCR fragments:
  - `about-l-am` -> `how-did-you-hear-about-i-am`
  - `you-best-c` -> `gender-identity`
  - `affirmations-c` -> `affirmation-familiarity`
- Use functional names when text is unclear: `paywall`, `bottom-sheet`, `settings-menu`, `permission-prompt`, `profile-form`, `notification-tray`.
- When the same concept appears more than once, suffix after the semantic name while preserving order: `014-paywall-2.png`.

## What To Keep

- New screens.
- Settled modal sheets, trays, popovers, paywalls, menus, drawers, permission prompts, error states, success states, and loading states.
- Selected states when selection persists or multiple selections accumulate.
- Scrolled views when materially new content is visible.
- Animation/interstitial screens that persist long enough to be part of the user experience.

## What To Drop

- Tap-only highlights.
- Button glow/press states that immediately transition.
- Half-open or half-closed trays when the settled tray is captured.
- Mid-navigation blur, streak, or partial slide frames.
- Keyboard typing microstates unless the keyboard itself is an important durable state for the screen.

## Review States

Use these exact labels:

- `needs review`: first pass found a suspicious time range.
- `resolved`: second pass handled the suspicious range.
- `needs review second time`: second pass still could not confidently resolve the range.

For each review state, include the timestamp range, reason, output action, and what the user should compare against the video.

## Debug Passes

Use `--debug` only after the user asks to inspect a specific suspicious range or missed state. Normal runs should stay clean: `screens/`, `SCREEN_REVIEW.md`, and `contact-sheet.jpg`.

Debug output is evidence, not a deliverable. Use it to explain why a range stayed `needs review second time`, then remove or ignore it unless the user asks to keep it.
