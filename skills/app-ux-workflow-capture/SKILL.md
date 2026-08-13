---
name: app-ux-workflow-capture
description: Capture app walkthrough videos into chronological, Figma-ready screens. Use when the user provides mobile app recordings, onboarding/paywall/settings walkthroughs, or asks to extract durable UI states from video without UX critique.
---

# App UX Workflow Capture

Capture app walkthrough videos into a clean visual reference pack: native-resolution ordered screenshots, a contact sheet, and Markdown review notes. Do not critique, redesign, or recommend UX changes.

## Workflow

1. Identify the video files from the user request. If multiple videos are provided, process each into its own folder.
2. Preserve the current environment. Run locally when the session is local; run on the droplet only when the session is already on the droplet. Never silently switch environments.
3. Check the input is readable from the current environment. If macOS returns `Operation not permitted`, ask the user to move the video into the current project/workspace or grant access; do not work from an older copy unless the user approves it.
4. Run the bundled extractor from this skill folder; do not rewrite the extraction logic:

```bash
python /path/to/app-ux-workflow-capture/scripts/extract_app_ux_workflow.py <video...> --context "<user-provided context>"
```

Use `--output <dir>` only when the user asks for a specific destination. By default, write under the current working folder, preferring `./outputs/app-ux-workflow-capture/`.

5. Verify the output before reporting completion:
   - Every exported screen is a native-resolution PNG.
   - Filenames are zero-padded and chronological from first appearance in the video.
   - `SCREEN_REVIEW.md` links resolve to existing screen files.
   - `contact-sheet.jpg` exists.
   - Multiple-video runs include `SUMMARY.md`.

Completion criterion: the command exits successfully, the verification checklist passes for every video folder, and the final response gives the output path plus screen/review-state counts.

## Output Contract

For one video:

```text
outputs/app-ux-workflow-capture/
  video-name/
    screens/
      001-first-screen.png
      002-bottom-sheet.png
    SCREEN_REVIEW.md
    contact-sheet.jpg
```

For multiple videos:

```text
outputs/app-ux-workflow-capture/
  SUMMARY.md
  onboarding/
  paywall/
```

Do not create CSVs, storyboards, or debug folders by default. Use `--debug` only when the user explicitly asks to investigate a missed or suspicious range.

## Capture Rules

Apply these rules before reporting the capture complete:

- Capture every durable visual state: screens, modal sheets, trays, paywalls, permission prompts, menus, expanded panels, selected states, and alternate tap outcomes.
- Keep selected states when the selection persists or multiple selections accumulate. Drop single tap highlights that immediately transition away.
- Keep chronological order as a hard invariant. If a second pass inserts a missed screen, renumber all later files before final output.
- Preserve native video resolution for exported screens. Resize only the contact sheet.
- Use OCR for first-pass names, then visually clean obvious bad names while keeping numeric prefixes stable.
- Include functionality-focused capture notes only. Do not critique, redesign, or recommend UX changes.

## Review States

Flag suspicious ranges in `SCREEN_REVIEW.md` with one of these states:

- `needs review`: first pass saw a suspicious range.
- `resolved`: a second pass found a better settled screen or confirmed the chosen output.
- `needs review second time`: second pass still could not confidently resolve the range.

Suspicious ranges include possible missed trays/modals, long unstable animation, large visual changes without a settled representative frame, or OCR/visual disagreement.

## Transition Rules

Drop partial motion frames such as half-open trays, half-slid navigation, blur/streak frames, and tap glow frames. Keep the final settled state. Keep loading or animation screens only when they are meaningful UX states or persist long enough to matter.

For detailed naming and review guidance, read `references/review-rules.md` before manual filename cleanup, focused debug passes, or any judgment call about keeping/dropping a state.
