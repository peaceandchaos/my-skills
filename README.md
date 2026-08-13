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

Then commit and push. Other machines / Cloud VMs pick up changes with `npx skills update -y` (or a fresh `npx skills add`).

## Layout

```text
skills/<name>/SKILL.md   # what `npx skills add` installs
```

Optional `scripts/`, `references/`, and `assets/` live next to each `SKILL.md`.

## What’s in here (59)

Copied from live `~/.agents/skills` first, then `~/.cursor/skills`, `~/.claude/skills`, `~/.codex/skills`, then unique extras from the local plugin pack.

**Engineering** — `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `implement`, `improve-codebase-architecture`, `migrate-to-shoehorn`, `prototype`, `react-doctor`, `resolving-merge-conflicts`, `setup-pre-commit`, `setup-ts-deep-modules`, `tdd`, `thermo-nuclear-code-quality-review`, `supabase-postgres-best-practices`

**Planning** — `ask-matt`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `claude-handoff`, `loop-me`, `orchestrate`, `research`, `setup-matt-pocock-skills`, `teach`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`, `wizard`, `sync-cloud-skills`, `find-skills`

**Writing** — `edit-article`, `obsidian-vault`, `writing-beats`, `writing-for-agents`, `writing-fragments`, `writing-shape`

**Mobile / Expo** — `app-ux-workflow-capture`, `expo-ios-hig`, `expo-ui`, `mobile-touch`, `react-native-design`

**Motion / UI** — `12-principles-of-animation`, `emil-prototype`, `emilkowal-animations`, `generating-sounds-with-ai`, `mastering-animate-presence`, `morphing-icons`, `pseudo-elements`, `sounds-on-the-web`, `to-spring-or-not-to-spring`

**Other** — `figma-review-skill`, `git-guardrails-claude-code`, `hatch-pet`, `scaffold-exercises`

## Left out on purpose

| Source | Why |
| --- | --- |
| Cursor built-ins (`~/.cursor/skills-cursor`) | Already on every Cursor install |
| Marketplace plugins (Figma, pstack, Claude/Codex bundled) | Installed by those plugins |
| `lazyweb*` | Broken symlinks to `/tmp` |
| `to-prd` | Renamed to `to-spec` (Matt Pocock v1.1) |
| `to-issues` | Merged into `to-tickets` |
| `decision-mapping` | Renamed to `wayfinder` |
| `writing-great-skills` | Replaced by `writing-for-agents` |
| `review` | Renamed to `code-review` |

## Related repo

[peaceandchaos/cursor-team-skills](https://github.com/peaceandchaos/cursor-team-skills) is the older **Cursor Team Marketplace plugin** packing of a subset of these skills (`personal-skills/skills/…`). This repo is the `npx skills add` source for any environment.
