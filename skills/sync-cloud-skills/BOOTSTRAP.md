# Bootstrap sync-cloud-skills (chicken-and-egg)

Use when the checkout has **no** `.cursor/skills/sync-cloud-skills/` yet (e.g. new GitHub repo from phone/web).

**Requires:** `gh` can read the skills remote (`SYNC_CLOUD_SKILLS_REMOTE`, default `peaceandchaos/my-skills`). On Cloud Agents, set a `GH_TOKEN` PAT with `repo` scope if `gh api` returns 401/403/404.

**Prefer:** install with `npx skills add peaceandchaos/my-skills --skill '*' -a cursor -y` in the app repo, then commit `.agents/skills`. On a Mac you can still run `/sync-cloud-skills` instead.

## One-shot install

From the **application repo root**:

```bash
set -euo pipefail
REPO="${SYNC_CLOUD_SKILLS_REMOTE:-peaceandchaos/my-skills}"
REF="${SYNC_CLOUD_SKILLS_REF:-main}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
gh api "repos/${REPO}/tarball/${REF}" > "$TMP/skills.tgz"
tar -xz -C "$TMP" -f "$TMP/skills.tgz"
ROOT="$(find "$TMP" -maxdepth 1 -type d ! -path "$TMP" | head -1)"
SRC="$ROOT/skills"
test -d "$SRC"
mkdir -p .cursor/skills
rsync -a "$SRC/" .cursor/skills/
```

Then apply **Gitignore** and **Handoff** from [`SKILL.md`](SKILL.md) (steps 4 and 7). Commit + push `.cursor/skills` (and gitignore if changed).

## Verify

```bash
test -f .cursor/skills/sync-cloud-skills/SKILL.md
find .cursor/skills -name SKILL.md | wc -l
git check-ignore -v .cursor/skills/sync-cloud-skills/SKILL.md || true
```

*Done when:* `SKILL.md` exists and `find` count is ≥ 1.

## Mac publisher (before you leave)

1. In `my-skills`: `./sync-from-local.sh` → commit → push.
2. In each app repo: `npx skills add peaceandchaos/my-skills --skill '*' -a cursor -y` (or `/sync-cloud-skills`), then commit and push.
3. Away from Mac: **new** Cloud Agent on that app repo (skills already in checkout).
