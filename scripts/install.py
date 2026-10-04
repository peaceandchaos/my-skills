#!/usr/bin/env python3
"""Install skills from my-skills into one project as real copies.

  install.py --project DIR --commit REF NAME...   write DIR/.claude/skills/NAME/ from my-skills at REF
  install.py --project DIR --check                compare those folders with DIR/.claude/my-skills.lock.json

The install refuses, writes nothing and exits 2 when DIR is not the top
folder of a git repository, when DIR is the home folder or its .claude/skills
is the home folder's, or when DIR is a Glow clone (it has
tools/skills/catalog.lock.json) and --locked-project is not given.
--check works offline. Exit codes: 0 ok, 1 a check failure, 2 bad input or
a refusal.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import skillsync as ss  # noqa: E402

DEFAULT_SOURCE = "https://github.com/peaceandchaos/my-skills"
SKILLS = Path(".claude") / "skills"
MANIFEST = Path(".claude") / "my-skills.lock.json"
GLOW_LOCK = Path("tools") / "skills" / "catalog.lock.json"
PERSONAL = (Path(".cursor") / "skills", Path(".claude") / "skills")


def refusal(project: Path, locked_project: bool) -> str | None:
    """Why an install into project is refused, or None. project is already resolved."""
    top = subprocess.run(["git", "-C", str(project), "rev-parse", "--show-toplevel"],
                         capture_output=True, text=True, env=ss.git_env())
    if top.returncode != 0 or Path(top.stdout.strip()).resolve() != project:
        return f"{project} is not the top folder of a git repository"
    home = Path.home().resolve()
    if project == home or (project / SKILLS).resolve() == (home / SKILLS).resolve():
        return f"{project} is the home folder, or its .claude/skills is the home folder's"
    if (project / GLOW_LOCK).exists() and not locked_project:
        return (f"{project} is a Glow clone ({GLOW_LOCK} exists). Glow pins its skills; "
                "only the reviewed Glow switch passes --locked-project")
    return None


def left_out(project: Path, names: list[str]) -> str | None:
    """Why a rerun that leaves out an installed skill is refused, or None.

    The new manifest lists only the given names, so a skill left out would stay
    on disk with nothing checking it."""
    if not (project / MANIFEST).exists():
        return None
    _, installed = read_manifest(project)
    kept = sorted(n for n in installed if n not in names and (project / SKILLS / n).is_dir())
    if not kept:
        return None
    return f"{', '.join(kept)} still installed; name each again, or delete its folder to drop it"


def personal_clashes(trees: dict[str, str]) -> list[str]:
    """Personal copies that share a name with a pinned skill but not its content.

    Cursor loads a project copy and a personal copy of one name side by side."""
    home = Path.home()
    return [f"{home / root / name} differs from the pinned {name}"
            for name, tree in sorted(trees.items()) for root in PERSONAL
            if (home / root / name).is_dir() and ss.tree_of_dir((home / root / name).resolve()) != tree]


def install(project: Path, source: str, ref: str, names: list[str], cache: str | None) -> int:
    with ss.cache_dir(cache) as cache_root:
        src = ss.GitSource(cache_root, "my-skills", source)
        commit = src.fetch_ref(ref)
        trees: dict[str, str] = {}
        for name in names:
            tree = src.tree_at(commit, f"skills/{name}")
            if tree is None:
                raise ss.SyncError(f"my-skills {commit[:12]} has no skills/{name}")
            trees[name] = tree
        clashes = personal_clashes(trees)
        if clashes:
            raise ss.SyncError("; ".join(clashes) + ". Make the personal copy match, or move it out of the folder")
        for name, tree in trees.items():
            dest = project / SKILLS / name
            ss.export_tree(src, tree, dest)
            if ss.tree_of_dir(dest) != tree:
                raise ss.SyncError(f"wrote {dest} but its tree is not {tree}")
    manifest = {"source": source, "commit": commit, "skills": dict(sorted(trees.items()))}
    (project / MANIFEST).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"installed {len(trees)} skill(s) from {source} at {commit[:12]} into {project / SKILLS}")
    return 0


def read_manifest(project: Path) -> tuple[str, dict[str, str]]:
    path = project / MANIFEST
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ss.SyncError(f"cannot read {path}: {exc}") from exc
    commit = raw.get("commit") if isinstance(raw, dict) else None
    skills = raw.get("skills") if isinstance(raw, dict) else None
    if not (isinstance(commit, str) and ss.HEX40.match(commit) and isinstance(skills, dict) and all(
            isinstance(n, str) and ss.NAME_RE.match(n) and isinstance(t, str) and ss.HEX40.match(t)
            for n, t in skills.items())):
        raise ss.SyncError(f"{path}: needs a full commit id and a skills object of name to tree id")
    return commit, skills


def check(project: Path) -> int:
    commit, skills = read_manifest(project)
    fails: list[str] = []
    for name, tree in sorted(skills.items()):
        folder = project / SKILLS / name
        if folder.is_symlink() or not folder.is_dir():
            fails.append(f"missing {SKILLS / name}: the manifest lists it")
            continue
        actual = ss.tree_of_dir(folder)
        if actual != tree:
            fails.append(f"drift {SKILLS / name}: tree {str(actual)[:12]} != manifest {tree[:12]}")
    fails.extend(f"clash {c}" for c in personal_clashes(skills))
    for f in fails:
        print(f"FAIL {f}")
    if fails:
        print(f"check FAILED: {len(fails)} failures; {len(skills)} skills from my-skills {commit[:12]}")
        return 1
    print(f"check ok: {len(skills)} skills match my-skills {commit[:12]}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--project", required=True, help="the project's git top folder")
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--commit", metavar="REF", help="my-skills commit, branch or tag to install from")
    mode.add_argument("--check", action="store_true", help="compare installed folders with the manifest, offline")
    p.add_argument("names", nargs="*", metavar="NAME", help="skills to install")
    p.add_argument("--source", default=DEFAULT_SOURCE, help=f"my-skills git URL (default: {DEFAULT_SOURCE})")
    p.add_argument("--locked-project", action="store_true",
                   help="allow a Glow clone; only the reviewed Glow switch passes this")
    p.add_argument("--cache", help="reuse this folder for fetches (default: a temporary folder)")
    args = p.parse_args(argv)
    if args.check and args.names:
        p.error("--check takes no skill names")
    if args.commit is not None and not args.names:
        p.error("name at least one skill to install")
    for name in args.names:
        if not ss.NAME_RE.match(name):
            p.error(f"bad skill name {name!r}")
    if len(set(args.names)) != len(args.names):
        p.error("a skill name is repeated")
    if args.commit is not None and not (ss.HEX40.match(args.commit) or ss.BRANCH_RE.match(args.commit)):
        p.error(f"bad --commit {args.commit!r}: give a full commit id or a branch or tag name")
    if not args.source.startswith(("https://", "file://")):
        p.error("--source must be an https:// or file:// URL")
    project = Path(args.project).resolve()
    try:
        if args.check:
            return check(project)
        reason = refusal(project, args.locked_project) or left_out(project, args.names)
        if reason:
            print(f"refused: {reason}", file=sys.stderr)
            return 2
        return install(project, args.source, args.commit, args.names, args.cache)
    except ss.SyncError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
