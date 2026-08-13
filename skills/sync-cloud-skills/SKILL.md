---
name: sync-cloud-skills
description: Mirror agent skills into the current repo checkout so Cloud Agents can load them.
disable-model-invocation: true
---

# Sync Cloud Skills

**Mirror** skills into this repo's `.cursor/skills/` **checkout**, then commit/push for **handoff** to phone/web/other PCs. Cloud Agents only see skills committed in the clone — not `~/.cursor/skills`.

If this skill is missing from the checkout, follow [`BOOTSTRAP.md`](BOOTSTRAP.md) first.

## Steps

1. **Repo root** — `git rev-parse --show-toplevel`. If that fails and the user wants a new project here: `git init`, then re-check.  
   *Done when:* you have the repo path.

2. **Confirm push / handoff** — Ask whether to commit and push after the mirror. If there is no `origin` and they want handoff: ask to `gh repo create` or add a remote.  
   *Done when:* push is accepted or declined; if handoff was requested with no remote, a create-or-add strategy is chosen.

3. **Mirror** — From the repo root, run:

   ```bash
   python3 "$(git rev-parse --show-toplevel)/.cursor/skills/sync-cloud-skills/scripts/sync.py"
   ```

   Defaults: `--source auto`, **upsert**. Pass `--replace` only if the user asks for a full wipe. See `scripts/sync.py --help` for `--source` / `--remote`.  
   *Done when:* stdout has `source=`, `mode=`, `copied=`; every `+ name` line has `<repo>/.cursor/skills/<name>/SKILL.md`.

4. **Gitignore** — Ensure `.cursor/skills/` is tracked. If `.gitignore` ignores `.cursor/`, use:

   ```gitignore
   .cursor/*
   !.cursor/skills/
   !.cursor/skills/**
   ```

   (Use `.cursor/*`, not `.cursor/` — a trailing slash on the parent blocks negation.)  
   *Done when:* `git check-ignore -v .cursor/skills/sync-cloud-skills/SKILL.md` reports nothing, and `git add -n .cursor/skills/sync-cloud-skills/SKILL.md` would stage the file.

5. **Show the diff** — Run `git status --short -- .cursor/skills` and `git diff --stat -- .cursor/skills`; report the skill change count to the user.  
   *Done when:* those commands have been run and the change count is stated in the reply.

6. **Commit / remote / push** (only if step 2 accepted) — Stage `.cursor/skills` and any gitignore fix. Commit. If no upstream: create or set remote per step 2, then push.  
   *Done when:* `git push` succeeds, or the user cancelled.

7. **Handoff** — Tell the user to start a **new** Cloud Agent on this repo/branch so it clones the commit with skills. Existing cloud runs keep the old checkout.  
   *Done when:* that instruction appears in the reply.

## Multi-repo

One checkout per run. Open another workspace and run again.

## Do not

- Hardcode **target application** repo names, orgs, or absolute machine paths
- Rely on `~/.cursor/plugins/local` for Cloud Agents
