#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="$ROOT/skills"
mkdir -p "$DEST"

python3 - "$DEST" << 'PY'
from pathlib import Path
import shutil
import sys

dest = Path(sys.argv[1])
home = Path.home()
repo_root = dest.parent
pstack_skills = repo_root / "pstack" / "skills"
pstack_names = (
    {p.name for p in pstack_skills.iterdir() if p.is_dir()}
    if pstack_skills.is_dir()
    else set()
)
pack_names = (
    {p.name for p in dest.iterdir() if p.is_dir()} if dest.exists() else set()
)
# pstack lives at pstack/skills/, not skills/. Never copy those names
# into skills/ (tdd/teach already in this pack stay syncable from local).
pstack_exclusive = pstack_names - pack_names

# First match wins. Live ~/.agents is newer than the stale plugin-local
# snapshot (Matt Pocock renamed to-prd/to-issues/decision-mapping).
# plugin-local is last so unique extras (obsidian-vault, edit-article) still land.
roots = [
    home / ".agents" / "skills",
    home / ".cursor" / "skills",
    home / ".claude" / "skills",
    home / ".codex" / "skills",
    home / ".cursor" / "plugins" / "local" / "personal-skills" / "skills",
]
# Old names Matt deleted/renamed. Do not copy them back from plugin-local.
superseded = {
    "to-prd",           # renamed to to-spec
    "to-issues",        # merged into to-tickets
    "decision-mapping", # renamed to wayfinder
    "writing-great-skills",  # replaced by writing-for-agents
    "review",           # renamed to code-review; also a Cursor built-in name
}
skills_cursor = home / ".cursor" / "skills-cursor"
builtin = (
    {p.parent.name for p in skills_cursor.rglob("SKILL.md")}
    if skills_cursor.is_dir()
    else set()
)

chosen: dict[str, Path] = {}
for root in roots:
    if not root.exists():
        continue
    for skill_md in root.glob("*/SKILL.md"):
        if ".system" in skill_md.parts:
            continue
        name = skill_md.parent.name
        if name in builtin or name in superseded or name in pstack_exclusive:
            continue
        # Don't let a pstack plugin tree overwrite pack skills (tdd, teach).
        if "pstack" in skill_md.parts:
            continue
        if name not in chosen:
            chosen[name] = skill_md.parent

# Upsert: overwrite names found locally, delete only superseded
# names, leave dest-only vendored skills (Expo, Emil, Callstack, SM)
# in place. A wipe-then-copy would drop those.
if dest.exists():
    for name in superseded:
        child = dest / name
        if child.is_dir():
            shutil.rmtree(child)
            print(f"- {name} (superseded)")

copied = 0
skipped = 0
for name, src in sorted(chosen.items()):
    skill_md = src / "SKILL.md"
    try:
        if skill_md.is_symlink() and not skill_md.exists():
            print(f"skip {name}: broken symlink")
            skipped += 1
            continue
        if not skill_md.is_file():
            print(f"skip {name}: no SKILL.md")
            skipped += 1
            continue
    except OSError as e:
        print(f"skip {name}: {e}")
        skipped += 1
        continue

    out = dest / name
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(
        src,
        out,
        symlinks=False,
        ignore_dangling_symlinks=True,
        ignore=shutil.ignore_patterns(
            "__pycache__",
            ".DS_Store",
            "node_modules",
            ".git",
        ),
    )
    if (out / "SKILL.md").is_file():
        copied += 1
        print(f"+ {name}")
    else:
        shutil.rmtree(out, ignore_errors=True)
        skipped += 1
        print(f"skip {name}: copy produced no SKILL.md")

print(f"done: {copied} skills ({skipped} skipped)")
PY

# Point the bundled sync-cloud-skills helper at this repo after each refresh.
python3 - "$ROOT" << 'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1])
replacements = [
    ("peaceandchaos/cursor-team-skills", "peaceandchaos/my-skills"),
    ("personal-skills/skills", "skills"),
    ("In `cursor-team-skills`:", "In `my-skills`:"),
]
changed = 0
for path in (
    root / "skills" / "sync-cloud-skills" / "scripts" / "sync.py",
    root / "skills" / "sync-cloud-skills" / "BOOTSTRAP.md",
    root / "skills" / "sync-cloud-skills" / "SKILL.md",
):
    if not path.is_file():
        continue
    text = path.read_text(encoding="utf-8")
    new = text
    for old, new_s in replacements:
        new = new.replace(old, new_s)
    if new != text:
        path.write_text(new, encoding="utf-8")
        changed += 1
        print(f"retargeted {path.relative_to(root)}")
print(f"retargeted {changed} files")
PY
