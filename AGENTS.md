# my-skills

Skills live in `skills/<name>/SKILL.md`. `sources.json` says where each one comes from.

- Edit a skill by hand only when its `sources.json` entry has `"kind": "own"`. Every other folder must equal its pinned upstream folder, so change it with `python3 scripts/update.py` instead.
- Before a commit, run `python3 scripts/update.py --check` and `python3 -m unittest`. Both must pass.
- Copy skills into another project with `python3 scripts/install.py --project <project> --commit main <names>`. Leave `~/.claude/skills` and Glow clones alone, because Glow pins those copies.

The `sync-cloud-skills` skill has the full update and install steps.
