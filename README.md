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

### Cursor + Codex

```bash
npx skills add peaceandchaos/my-skills --skill '*' -a cursor -a codex -g -y
```

Leave Claude Code out of a global install. Glow pins the skill copies in `~/.claude/skills`, and a global install would overwrite them. Use `scripts/install.py` for one project instead.

### One skill only

```bash
npx skills add peaceandchaos/my-skills --skill expo-ios-hig -a cursor -y
```

List what the CLI sees:

```bash
npx skills add peaceandchaos/my-skills --list
```

## Update from upstream

`sources.json` records where each vendored skill comes from: the upstream repo, the folder, the pinned commit and the license. Skills with `"kind": "own"` are edited here. Every other folder under `skills/` must equal its pinned upstream folder, apart from the `name:` line of the two renamed forks.

To move the pins and rewrite the vendored folders, run the `sync-cloud-skills` skill, or run the scripts from this repo's root:

```bash
python3 scripts/update.py --dry-run   # report the pin moves and warnings; writes nothing
python3 scripts/update.py             # move the pins, rewrite the folders, print a commit message
python3 scripts/update.py --check     # compare every vendored folder with its pinned upstream folder
```

Commit only after `--check` prints `check ok`. Run the tests with `python3 -m unittest`.

## Install into one project

`scripts/install.py` copies named skills into a project's `.claude/skills/` as real files. It records the my-skills commit and each folder's git tree ID in `.claude/my-skills.lock.json`.

```bash
python3 scripts/install.py --project <project> --commit main <names>
python3 scripts/install.py --project <project> --check
```

The install refuses the home folder, a folder that is not the top of a git repo, and a Glow clone.

## Layout

```text
skills/<name>/SKILL.md   # what `npx skills add` and scripts/install.py install
sources.json             # upstream repo, folder, pin and license for each vendored skill
scripts/                 # update.py, install.py and the code they share
tests/                   # fixture tests: python3 -m unittest
```

Optional `scripts/`, `references/`, and `assets/` live next to each `SKILL.md`.

## What’s in here (77)

`sources.json` names the upstream repo and license of each vendored skill below.

**Engineering** — `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `implement`, `improve-codebase-architecture`, `migrate-to-shoehorn`, `prototype`, `react-doctor`, `setup-pre-commit`, `setup-ts-deep-modules`, `tdd`, `thermo-nuclear-code-quality-review`, `supabase-postgres-best-practices`, `vercel-react-best-practices`

**Planning** — `ask-matt`, `grill-me`, `grill-with-docs`, `grilling`, `handoff`, `claude-handoff`, `loop-me`, `orchestrate`, `research`, `setup-matt-pocock-skills`, `teach`, `to-questionnaire`, `to-spec`, `to-tickets`, `triage`, `wait-what`, `wayfinder`, `wizard`, `sync-cloud-skills`, `find-skills`

**Writing** — `writing-beats`, `writing-for-agents`, `writing-fragments`, `writing-shape`

**Mobile / Expo** — `app-ux-workflow-capture`, `expo-ios-hig`, `expo-overview`, `expo-web-to-native`, `expo-dom`, `expo-animation`, `expo-data-fetching`, `expo-design-system`, `expo-examples`, `expo-module`, `expo-app-clip`, `expo-brownfield`, `expo-skill-feedback`, `expo-ui`, `expo-project-structure`, `expo-router`, `expo-native-ui`, `expo-dev-client`, `expo-upgrade`, `eas-simulator`, `eas-app-stores`, `eas-hosting`, `eas-observe`, `eas-update`, `eas-update-insights`, `eas-workflows`, `mobile-touch`, `react-native-design`, `react-native-best-practices` (Callstack: FPS, TTI, bundle, memory), `react-native-best-practices-sm` (Software Mansion: Reanimated, Gesture Handler, Skia, worklets)

**Motion / UI** — `emil-prototype`, `find-animation-opportunities`, `review-animations`, `userinterface-wiki`

**Other** — `figma-review-skill`, `git-guardrails-claude-code`, `hatch-pet`, `scaffold-exercises`

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
