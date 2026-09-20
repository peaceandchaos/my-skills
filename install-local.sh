#!/usr/bin/env bash
# Copy this pack as real directories (not symlinks) into local skill roots.
# Cursor Cloud "Sync Skills" only uploads real folders under ~/.cursor/skills.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/skills"
test -d "$SRC"

python3 - "$SRC" <<'PY'
from pathlib import Path
import shutil
import sys

src = Path(sys.argv[1])
home = Path.home()
store = (
    home
    / "Library"
    / "Application Support"
    / "Cursor"
    / "AgentStores"
    / "cursor_agent_stores"
    / "u29965351"
    / "files"
    / "skills"
)
dests = [
    home / ".agents" / "skills",
    home / ".cursor" / "skills",
    home / ".claude" / "skills",
    home / ".codex" / "skills",
    store,
]
ignore = shutil.ignore_patterns("__pycache__", ".DS_Store", "node_modules", ".git")
skills = sorted(
    d for d in src.iterdir() if d.is_dir() and (d / "SKILL.md").is_file()
)
if len(skills) < 15:
    sys.exit(f"refusing to install incomplete pack: {len(skills)}")

for dest in dests:
    dest.mkdir(parents=True, exist_ok=True)
    wanted = {d.name for d in skills}
    for child in list(dest.iterdir()) if dest.exists() else []:
        if child.name.startswith("."):
            continue
        if child.name not in wanted:
            if child.is_symlink() or child.is_file():
                child.unlink()
            elif child.is_dir():
                shutil.rmtree(child)
            print(f"- {dest}: {child.name}")
    copied = 0
    for skill in skills:
        out = dest / skill.name
        if out.is_symlink() or out.is_file():
            out.unlink()
        elif out.is_dir():
            shutil.rmtree(out)
        shutil.copytree(skill, out, symlinks=False, ignore=ignore)
        if out.is_symlink():
            sys.exit(f"copy still a symlink: {out}")
        copied += 1
    print(f"ok {dest}: {copied}")
PY
