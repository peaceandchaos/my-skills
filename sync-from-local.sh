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

# First match wins. plugin-local is the packaged pack (scripts/references);
# then live agent homes. Cursor built-ins are never copied.
roots = [
    home / ".cursor" / "plugins" / "local" / "personal-skills" / "skills",
    home / ".agents" / "skills",
    home / ".cursor" / "skills",
    home / ".claude" / "skills",
    home / ".codex" / "skills",
]
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
        if name in builtin:
            continue
        if name not in chosen:
            chosen[name] = skill_md.parent

if dest.exists():
    for child in list(dest.iterdir()):
        if child.is_dir():
            shutil.rmtree(child)

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
