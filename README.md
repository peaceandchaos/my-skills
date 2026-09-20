# my-skills

Personal agent skills, packaged so any repo or Cursor Cloud VM can install them with:

```bash
npx skills add peaceandchaos/my-skills --skill '*' -a cursor -y
```

Cursor Cloud VMs do not see `~/.cursor/skills` from your laptop. Skills in this repo are the source of truth.

## Install

### Into the current repo (Cursor Cloud–friendly)

Copies into `.agents/skills/`. Commit that folder so Cloud Agents pick the skills up from checkout:

```bash
npx skills add peaceandchaos/my-skills --skill '*' -a cursor -y
```

### Global on this machine (or a Cloud VM home dir)

```bash
npx skills add peaceandchaos/my-skills --skill '*' -a cursor -g -y
```

### Cursor + Claude Code + Codex

```bash
npx skills add peaceandchaos/my-skills --skill '*' -a cursor -a claude-code -a codex -g -y
```

### Private GitHub on Cloud Agents

This repo is private. Cloud VMs need `GH_TOKEN` (or `GITHUB_TOKEN`) with `repo` scope, plus GitHub on the network allowlist. Then the same `npx skills add` command works.

To skip the token, make the repo public:

```bash
gh repo edit peaceandchaos/my-skills --visibility public
```

### One skill only

```bash
npx skills add peaceandchaos/my-skills --skill expo-ios-hig -a cursor -y
```

List what the CLI sees:

```bash
npx skills add peaceandchaos/my-skills --list
```

## Refresh from this Mac

```bash
./sync-from-local.sh
```

Then commit and push. Other machines / Cloud VMs pick up changes with `npx skills update -y` (or a fresh `npx skills add`). The script overwrites skills that exist locally and leaves vendored dest-only skills in place.

Publish this pack onto this Mac as **real folders** (required for Cloud):

```bash
./install-local.sh
```

That copies into `~/.agents/skills`, `~/.cursor/skills`, `~/.claude/skills`, `~/.codex/skills`, and the Cursor user Agent Store. Do not symlink into `~/.cursor/skills` — Cloud “Sync Skills” skips symlinks.

### Cloud, any repo

1. Run `./install-local.sh` (real copies in `~/.cursor/skills`).
2. Cursor Settings → Agents → Context and Tools → **Sync Skills for Cloud Agents**. Wait until it shows N of N, not 0 of 0.
3. Start a **new** Cloud Agent. Existing Cloud chats keep the old user-store stub.

Repo checkouts still need `.cursor/skills` committed if you want skills without personal sync (Origin, teammates, phone). This pack is that source.

## Layout

```text
skills/<name>/SKILL.md         # what `npx skills add` installs
pstack/skills/<name>/SKILL.md  # pstack + poteto-mode; not installed by that CLI
```

Optional `scripts/`, `references/`, and `assets/` live next to each `SKILL.md`.

## What’s in here (87)

Copied from live `~/.agents/skills` first, then `~/.cursor/skills`, `~/.claude/skills`, `~/.codex/skills`, then unique extras from the local plugin pack. Official Expo, Emil, Callstack, and Software Mansion skills below are vendored from GitHub so a Cloud VM can install them from this repo.

**Engineering** — `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `implement`, `improve-codebase-architecture`, `migrate-to-shoehorn`, `prototype`, `react-doctor`, `resolving-merge-conflicts`, `setup-pre-commit`, `setup-ts-deep-modules`, `tdd`, `thermo-nuclear-code-quality-review`, `supabase-postgres-best-practices`, `vercel-react-best-practices`

**Planning** — `ask-matt`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `claude-handoff`, `loop-me`, `orchestrate`, `research`, `setup-matt-pocock-skills`, `teach`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`, `wizard`, `sync-cloud-skills`, `find-skills`

**Writing** — `edit-article`, `obsidian-vault`, `writing-beats`, `writing-for-agents`, `writing-fragments`, `writing-shape`

**Mobile / Expo** — `app-ux-workflow-capture`, `expo-ios-hig`, `expo-overview`, `expo-web-to-native`, `expo-dom`, `expo-animation`, `expo-data-fetching`, `expo-design-system`, `expo-examples`, `expo-module`, `expo-app-clip`, `expo-brownfield`, `expo-skill-feedback`, `expo-ui`, `expo-project-structure`, `expo-router`, `expo-native-ui`, `expo-dev-client`, `expo-upgrade`, `eas-simulator`, `eas-app-stores`, `eas-hosting`, `eas-observe`, `eas-update`, `eas-update-insights`, `eas-workflows`, `mobile-touch`, `react-native-design`, `react-native-best-practices` (Callstack: FPS, TTI, bundle, memory), `react-native-best-practices-sm` (Software Mansion: Reanimated, Gesture Handler, Skia, worklets)

Cloud slash commands for **this repo** come from `.cursor/skills` in the clone. Cloud slash commands for **any repo** come from real folders in `~/.cursor/skills` after Sync Skills for Cloud Agents. The Cloud user store used to be only `react-doctor` + `sync-cloud-skills` — that stub is why Expo commands went missing.

**Motion / UI** — `12-principles-of-animation`, `emil-prototype`, `emilkowal-animations`, `find-animation-opportunities`, `review-animations`, `generating-sounds-with-ai`, `mastering-animate-presence`, `morphing-icons`, `pseudo-elements`, `sounds-on-the-web`, `to-spring-or-not-to-spring`

**Other** — `figma-review-skill`, `git-guardrails-claude-code`, `hatch-pet`, `scaffold-exercises`

## Vendored from upstream (19 Sep 2026)

`./sync-from-local.sh` upserts local skills and **does not delete** dest-only names, so a later Mac sync will not wipe official Expo skills that are not on `~/.agents` yet. Run `./install-local.sh` after a vendor to push them onto this Mac.

| Skill | Source | SHA |
| --- | --- | --- |
| Official Expo + EAS catalog (`expo-*`, `eas-*` except `expo-ios-hig`) | [expo/skills](https://github.com/expo/skills) `plugins/expo/skills` | `39708666ce7014def1f8e34f3d8c93e8d3f588bb` |
| `find-animation-opportunities`, `review-animations` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `78761e1` |
| `react-native-best-practices` | [callstackincubator/agent-skills](https://github.com/callstackincubator/agent-skills) | `2766baa` |
| `react-native-best-practices-sm` | [software-mansion-labs/skills](https://github.com/software-mansion-labs/skills) (`react-native-best-practices`, renamed so both fit) | `c4ac0ab` |
| pstack (`pstack/skills/`, including poteto-mode) | [cursor/plugins `pstack`](https://github.com/cursor/plugins/tree/main/pstack) | `93b00b8` |

Do not `npx skills add software-mansion-labs/skills --skill react-native-best-practices` on a machine that already has Callstack’s skill. Same folder name. Install Software Mansion from this pack as `react-native-best-practices-sm`.

## Left out on purpose

| Source | Why |
| --- | --- |
| Cursor built-ins (`~/.cursor/skills-cursor`) | Already on every Cursor install |
| Marketplace plugins (Figma, Claude/Codex bundled) | Installed by those plugins |
| `lazyweb*` | Broken symlinks to `/tmp` |
| `to-prd` | Renamed to `to-spec` (Matt Pocock v1.1) |
| `to-issues` | Merged into `to-tickets` |
| `decision-mapping` | Renamed to `wayfinder` |
| `writing-great-skills` | Replaced by `writing-for-agents` |
| `review` | Renamed to `code-review` |

## Related repo

[peaceandchaos/cursor-team-skills](https://github.com/peaceandchaos/cursor-team-skills) is the older **Cursor Team Marketplace plugin** packing of a subset of these skills (`personal-skills/skills/…`). This repo is the `npx skills add` source for any environment.
