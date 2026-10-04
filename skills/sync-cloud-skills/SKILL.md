---
name: sync-cloud-skills
description: Update my-skills from its upstream repos, then install named skills into one project as pinned real copies.
disable-model-invocation: true
---

# Sync Cloud Skills

my-skills vendors skills from official upstream repos. `sources.json` records each skill's repo, path, pinned commit and license. Two scripts in a my-skills clone do the work:

- `scripts/update.py` moves each repo's pin to the tip of its recorded branch and rewrites the vendored folders to match.
- `scripts/install.py` copies named skills into one project's `.claude/skills/` and records the my-skills commit and each tree ID in `.claude/my-skills.lock.json`.

Install only into a git repo that the owner names. Never install into the home folder or a Glow clone before the Glow switch. Never copy my-skills into `~/.claude/skills` by hand, because Glow pins those copies. `install.py` refuses the home folder, a Glow clone and any folder that is not a git top folder. It writes nothing and exits 2.

## Update my-skills

Run every command from the root of a my-skills clone on an up-to-date `main` with an empty `git status --porcelain`.

1. Preview. Run `python3 scripts/update.py --dry-run`.
   *Done when:* every repo has a status line and `git status --porcelain` is still empty. Report each `warning:` line to the owner, S3 and S5 first, because they can add code that runs. S1 is a skill name added, removed or renamed. S2 is a file mode other than 100644. S3 is a file that is not Markdown. S4 is a frontmatter key outside name, description, license, metadata, version and argument-hint. S5 is an inline-shell line.
2. Update. Run `python3 scripts/update.py`.
   *Done when:* it exits 0 and prints either a commit message or `no pin moves`.
   *Failed when:* it exits 1. Each `error:` line names a repo whose pin stayed. The other repos' changes are on disk. If a path is gone upstream, the owner edits that entry in `sources.json` (a new `path`, or the entry and its folder removed), and you rerun this step.
3. Check. Run `python3 scripts/update.py --check`.
   *Done when:* it prints `check ok`. Commit only after `check ok`. Each `FAIL` line names a folder that differs from its pinned upstream tree.
4. Hand over. Show the owner `git diff --stat`, the warnings and the printed commit message.
   *Done when:* the owner has committed with that message and pushed `main`, or has declined.

## Install into a project

Run from the my-skills clone. `<project>` is the top folder of the git repo that the owner named. `<names>` are the skills it needs, as folder names under `skills/`.

1. Install. Run `python3 scripts/install.py --project <project> --commit main <names>`. The install fetches pushed my-skills anonymously, and the manifest records the full commit.
   *Done when:* it prints `installed N skill(s) from ... at <commit>`.
   *Failed when:* it prints `refused:` or `error:`. Either way it wrote nothing. A refusal means the target is the home folder, a Glow clone or not a git top folder, so ask the owner for another project.
2. Check. Run `python3 scripts/install.py --project <project> --check`.
   *Done when:* it prints `check ok: N skills match my-skills <commit>`.
3. Commit in the project. Stage `.claude/skills/<name>/` for each name and `.claude/my-skills.lock.json`, then commit under the project's own rules. If `git check-ignore -v .claude/my-skills.lock.json` prints a rule, change an ignored `.claude/` to `.claude/*` and add `!.claude/skills/` and `!.claude/my-skills.lock.json`. A trailing slash on the parent blocks the negation.
   *Done when:* the commit exists, and it is pushed if the project's rules allow. Tell the owner that a new cloud session reads the skills from that pushed commit, and a running session keeps its old checkout.

To update a project later, rerun step 1 with the same names. The install replaces the named folders and never deletes one. To drop a skill, delete its folder and rerun step 1 with the names that remain. A rerun that leaves out a skill whose folder still exists is refused and writes nothing.
