---
name: figma-review-skill
description: Capture a visible Figma screen and create a self-contained projectless Codex task with the exact visual references and design intent. Use when a user asks to spin a Figma screen or requested variations into a fresh task, especially when the task must distinguish a faithful targeted edit of a supplied screen from a new visual generation.
---

# Figma Review Skill

Create a clean, self-contained design handoff from an active Figma and voice conversation. Capture only on an explicit request. This skill is not continuous recording and does not edit Figma files.

## Capture library

Store captures in a visible, append-only library:

```text
~/Documents/Codex/Figma Review Skill Captures/
  [source task name]/
    [timestamp]__[purpose].png
    [timestamp]__[purpose].json
```

The user owns this library. The skill may create a newly requested PNG and its sidecar record, but must never rename, move, archive, delete, or suggest cleanup of existing captures.

To create a capture, first use Computer Use to obtain the current Figma window screenshot. Treat that full-window image as a **review capture only**: it may contain Figma tabs, editor chrome, sidebars, and empty canvas, none of which are design content.

Before any image-generation handoff, create a separate **generation-surface capture** containing only the intended Figma frame or explicitly selected comparison frames. Use Figma's frame focus/zoom controls or a precise crop. Exclude browser or app tabs, Figma toolbars, panels, rulers, selection handles, and surrounding gray canvas. Save both only when the user asked for capture: the review capture for traceability and the generation-surface capture as the source provided to the new task. Never hand a full Figma editor-window screenshot to an image generator unless the user explicitly asks to redesign the editor itself.

Pass the local generation-surface image to `scripts/capture_figma_screen.sh` with the current task name and a short purpose. The script appends the image plus a sidecar record. Verify that Figma is foreground and that the intended frame is visible before capture. The script retains a current-display fallback for environments where macOS screen capture is available.

## 1. Classify the request

Choose the execution mode before generating or handing off work. Do not apply preservation rules to every Figma reference.

### Targeted variation of the supplied screen

Use when the user means: “this exact screen,” “keep everything else,” “only change this card,” “swap these components,” or “show this variation on the same screen.” This also applies when the user identifies the source naturally—for example, “the one on the left,” “the right version,” a visible variant title, or a screen name.

Treat the supplied screen as the **fixed visual base**. Perform a **targeted edit** only within the named component or region. Keep all existing visible elements unchanged unless the user identifies a specific exception.

Do not generate a new app design, redraw the entire screen, replace unrelated components, or substitute a full-screen approximation for a faithful edit.

If the available tool cannot preserve the unchanged areas, state that limitation before generating. Do not present a new full-screen render as an exact variation.

### New reference or fresh generation

Use when the user asks for an entirely new screen, a fresh concept, a new reference, or permission to explore beyond the supplied layout.

The supplied screen may inform brand, mood, or selected components, but it is not a fixed base. Identify the output as a new visual proposal.

### Unclear intent

Ask one concise question: “Do you want a targeted variation of this exact screen, or a new visual direction?”

## 2. Capture and map references

1. Confirm that the user explicitly asked for this skill or a new task.
2. Capture the current foreground Figma screen for review. If the intended frame is unclear, ask the user to select or zoom to it.
3. Define the generation surface before handoff. It must be the selected frame itself, not the surrounding Figma application. If more than one frame is needed, crop only those named frames into a deliberate comparison surface.
4. State whether the focused crop is sufficient for visual fidelity. Do not imply access to hidden layers, tokens, variables, prototypes, or editable Figma structure.
5. Save the generation-surface capture with a purpose-based name.
5. Carry forward earlier assets only when the user identifies them as relevant. Assign each attachment one role:
   - **Primary source screen:** fixed visual base for a targeted variation.
   - **Target-component reference:** a crop, state, or component treatment being changed.
   - **Supporting reference:** a prior variation or style cue.
   - **New-direction reference:** inspiration for a fresh generation.
6. If there are no earlier references, treat the new capture as the only visual source. Do not invent missing references.
7. Resolve directional or named references against the visible canvas before handoff. Record which screen is the source and which component is the target. If more than one visible item fits “left,” “right,” or a title, ask for a concise disambiguation.

When handing off, include the absolute local path of the newly saved **generation-surface** PNG. A new task must inspect that focused file as the primary source, rather than relying on a verbal description. Do not include a full Figma editor capture as a design reference. If native task attachments are unavailable, state that the image is a shared local source file and have the new task use it directly with image inspection or image editing tools.

## 3. Targeted-variation preflight

Before spending generation tokens on a targeted variation, inspect the supplied screen and propose one compact confirmation. Do not make the user enumerate every element from scratch.

Use this pattern:

> I’ll treat [the left/right/named screen] as a targeted variation. I will keep the supplied screen intact and keep it shown on a phone, including [inferred locked elements]. Within [named component], I will vary only [named subregion or components]. I’ll deliver [exact number of variants] as [exact image and phone layout]. Is that right?

For a control inside the target region, ask one additional question only when needed:

> Is this control’s size, placement, or style fixed, or is it part of the exploration?

### Preservation contract

After confirmation, include this contract in the new task:

```markdown
**Supplied screen:** The attached screen is the source of truth and fixed visual base.

**Targeted edit:** Modify only [named component or region].

**Keep unchanged:** Preserve all other visible elements, including screen structure,
layout, navigation, imagery, typography, copy, colors, spacing, and surrounding
components unless the brief names a specific exception.

**Presentation frame:** Preserve the supplied phone-screen framing and show every
variation as a phone screen. A request for “two phones side by side” means one
comparison image with exactly two preserved phone-screen variations side by side;
it does not authorize a new app or device treatment.

**Card-level invariants:** Preserve [explicitly list fixed elements inside the target
component, such as image, header, title, metadata, existing actions, card geometry,
and styling].

**Do not:** Generate a new app design, redraw the whole screen, remove an existing
invariant, replace unrelated components, or create a full-screen approximation.
```

If the number, pairing, or presentation of variants matters, lock it explicitly. Interpret “a couple variations on the phone” as two variations of the same supplied phone screen. If the user says “one photo with two phones,” deliver one comparison image with exactly two phone screens side by side. Example: “Create four variants total, delivered as two images with exactly two full phones side by side in each image.”

## 4. Build the handoff

Create a new projectless task only after the reference map and preflight are complete. Provide the focused generation-surface capture and only the relevant carried-forward references. The new task must not require the user to repeat the voice conversation.

If the environment cannot make a native attachment card, pass each source file’s absolute local path in the handoff. The new task must first inspect the saved source file and must use it as the visual reference for generation. Do not claim that a native attachment was created when it was not.

Use this handoff structure:

```markdown
# Figma handoff: [purpose]

## Reference map
[Each attached asset and its role. Resolve any left/right or named source reference.]

## Goal and rationale
[What the user wants to explore and why.]

## Execution mode
[Targeted variation of the supplied screen / New reference or fresh generation.]

## Targeted edit
[Named component, named subregion, and allowed changes.]

## Preservation contract
[The confirmed fixed base, invariants, and prohibited drift.]

## Variants and presentation
[Exact alternatives, count, labeling, layout, and whether each remains in the supplied phone frame.]

## Required deliverable
[What the new task must produce.]
```

## 5. Verify before presenting

For a targeted variation, verify the output against the primary source screen before showing it:

- Did the image include only the intended frame(s), with no Figma tabs, editor chrome, gray canvas, sidebars, rulers, or selection controls?
- Did anything outside the targeted region drift?
- Did any listed invariant disappear or change?
- Did navigation, layout, typography, imagery, copy, surrounding cards, or screen hierarchy change without permission?
- Is each variant still presented in the preserved phone-screen frame?
- Does the deliverable contain the exact count and arrangement of requested variants?
- Does each changed control respect its confirmed size, placement, and style constraints?

If the result fails these checks, describe it as an approximation and do not claim it is a faithful edit.

## Nara example

For a Nara story-card iteration, a user might say: “Use the one on the right. I like this version and I want it to stay on a phone. I don’t want anything else to change—just give me a couple variations of this part. Put the two phones side by side so I can compare them.”

The preflight should be:

> I’ll treat the right-hand home screen as a targeted variation. I’ll keep that screen intact and preserve its phone framing. Inside the top story card, I’ll preserve the scenic media, completion header, title, metadata, Replay pill, card geometry, and dark styling. I’ll vary only the availability area and reminder treatment. I’ll return one comparison image with two phone variations side by side. Is that right?

The task must use the approved full-screen capture as the fixed base. It must not ask an image model to redraw the app. If a compact right-aligned Remind pill is required, say so explicitly; a full-width reminder action is not an acceptable substitute.

## Retention and boundaries

## Visible revision protocol

When this skill itself is changed, do not make the update silently. In the user-designated **Figma Review Skill** task, post a new visible message containing the revised relevant wording and a brief **What changed** note that names the affected sections. Do this after the local change is validated. If that review task is unavailable, say so in the active conversation and ask the user where they want the revision shown.

This protocol applies to every future revision of this skill. It does not apply to ordinary design handoffs or generated visual variations.

- Capture only after explicit request and screen-access permission.
- Create captures only when the user explicitly requests them.
- A review capture and a generation-surface capture are different artifacts. Never use the review capture as a generation source when it includes Figma interface chrome or canvas outside the intended frame.
- Never rename, move, archive, replace, delete, or suggest cleanup of existing captures. The user alone controls their organization and lifecycle.
- Never edit, move, or delete Figma content.
- Never upload a capture to an unapproved destination.
- Do not claim a proposed visual has been applied in Figma.
- If the environment cannot turn a live capture into an attachment usable by a new task, say so immediately and request an exported or uploaded image rather than pretending the handoff is complete.
- Do not alter the user-owned capture library beyond creating a newly requested capture and its new sidecar record.
