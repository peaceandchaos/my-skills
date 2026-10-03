#!/usr/bin/env python3
"""Keep my-skills on its official upstreams.

  update.py              move each repo pin to the tip of its recorded branch,
                         rewrite the vendored folders, print warnings and a commit message
  update.py --check      compare every vendored folder with its pinned upstream tree
  update.py --dry-run    report what an update would do; writes nothing

Python 3 standard library plus git. Upstream content is fetched anonymously.
Exit codes: 0 ok, 1 a check or update failure, 2 bad input.
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))
import skillsync as ss  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------------------
# --check


def local_failures(root: Path, sources: ss.Sources) -> list[str]:
    fails: list[str] = []
    skills = root / "skills"
    names = set(sources.entries)
    present = {p.name for p in skills.iterdir()} if skills.is_dir() else set()
    for n in sorted(present - names):
        fails.append(f"orphan skills/{n}: no entry in sources.json")
    for n in sorted(names - present):
        fails.append(f"missing skills/{n}: sources.json lists it")
    for n in sorted(names & present):
        d = skills / n
        md = d / "SKILL.md"
        if d.is_symlink() or not d.is_dir():
            fails.append(f"skills/{n} is not a real folder")
        elif md.is_symlink() or not md.is_file():
            fails.append(f"skills/{n}/SKILL.md is missing")
        else:
            try:
                name = ss.frontmatter_name(ss.parse_frontmatter(md.read_text(encoding="utf-8")))
            except (ss.FrontmatterError, UnicodeDecodeError) as exc:
                fails.append(f"skills/{n}/SKILL.md: {exc}")
                continue
            if name != n:
                fails.append(f"skills/{n}/SKILL.md: name is {name!r}; it must match the folder")
    for dirpath, dirnames, filenames in os.walk(root):
        rel = Path(dirpath).relative_to(root)
        if rel == Path("."):
            dirnames[:] = [d for d in dirnames if d not in (".git", "skills")]
        for f in filenames:
            if f.lower() == "skill.md":
                fails.append(f"{(rel / f).as_posix()}: a SKILL.md outside skills/ is not managed by sources.json")
    return fails


def dir_listing(path: Path) -> dict[str, tuple[str, str]]:
    out: dict[str, tuple[str, str]] = {}
    for dirpath, _dirs, files in os.walk(path):
        for f in files:
            p = Path(dirpath) / f
            rel = p.relative_to(path).as_posix()
            if p.is_symlink():
                out[rel] = ("120000", ss.hash_blob(os.fsencode(os.readlink(p))))
            else:
                mode = "100755" if p.stat().st_mode & 0o100 else "100644"
                out[rel] = (mode, ss.hash_blob(p.read_bytes()))
    return out


def drift_detail(src: ss.GitSource, tree: str, local: Path, transform) -> str:
    """Which files differ between an upstream tree (after any rename) and a local folder."""
    listing = src.ls_tree(tree)
    want = {e.path: (e.mode, e.oid) for e in listing}
    if transform and "SKILL.md" in want:
        oid = want["SKILL.md"][1]
        want["SKILL.md"] = (want["SKILL.md"][0], ss.hash_blob(transform("SKILL.md", src.read_blobs([oid])[oid])))
    have = dir_listing(local)
    parts = []
    for label, items in (
        ("only upstream", sorted(set(want) - set(have))),
        ("only here", sorted(set(have) - set(want))),
        ("differ", sorted(k for k in set(want) & set(have) if want[k] != have[k])),
    ):
        if items:
            shown = ", ".join(items[:8]) + (f" (+{len(items) - 8})" if len(items) > 8 else "")
            parts.append(f"{label}: {shown}")
    return "; ".join(parts)


def upstream_failures(root: Path, sources: ss.Sources, cache_root: Path) -> list[str]:
    fails: list[str] = []
    for rid in sorted(sources.repos):
        repo = sources.repos[rid]
        at = f"{rid}@{repo.pin[:12]}"
        src = ss.GitSource(cache_root, rid, repo.url)
        try:
            src.ensure_commit(repo.pin)
        except ss.SyncError as exc:
            fails.append(f"{rid}: {exc}")
            continue
        for e in sources.entries_for(rid):
            up_tree = src.tree_at(repo.pin, e.path)
            if up_tree is None:
                fails.append(f"{e.name}: {at} has no {e.path}")
                continue
            expected, transform = up_tree, None
            if e.kind == "fork":
                try:
                    expected, transform = ss.renamed_tree(src, up_tree, e.rename, e.name)
                except ss.SyncError as exc:
                    fails.append(f"{e.name}: rename {e.rename} -> {e.name}: {exc}")
                    continue
            local = root / "skills" / e.name
            if not local.is_dir() or local.is_symlink():
                continue  # reported by local_failures
            actual = ss.tree_of_dir(local)
            if actual != expected:
                fails.append(f"drift skills/{e.name}: tree {str(actual)[:12]} != {at}:{e.path} {expected[:12]}"
                             + (" after rename" if transform else "")
                             + f" ({drift_detail(src, up_tree, local, transform)})")
    return fails


def run_check(root: Path, sources: ss.Sources, cache_root: Path) -> int:
    fails = local_failures(root, sources) + upstream_failures(root, sources, cache_root)
    for f in fails:
        print(f"FAIL {f}")
    n_own = sum(1 for e in sources.entries.values() if e.kind == "own")
    status = "FAILED" if fails else "ok"
    print(f"check {status}: {len(fails)} failures; {len(sources.entries) - n_own} vendored, {n_own} own, "
          f"{len(sources.repos)} repos")
    return 1 if fails else 0


# --------------------------------------------------------------------------
# update


@dataclass
class SkillChange:
    entry: ss.Entry
    new_tree: str
    expected: str  # the tree on disk after export, which differs from new_tree for a fork
    transform: Callable[[str, bytes], bytes] | None


@dataclass
class RepoPlan:
    repo: ss.Repo
    new: str  # the branch tip; equals repo.pin until the fetch succeeds
    errors: list[str] = field(default_factory=list)
    changes: list[SkillChange] = field(default_factory=list)
    signals: list[ss.Signal] = field(default_factory=list)

    @property
    def moves(self) -> bool:
        return not self.errors and self.new != self.repo.pin


def plan_repo(src: ss.GitSource, sources: ss.Sources, repo: ss.Repo) -> RepoPlan:
    plan = RepoPlan(repo, repo.pin)
    try:
        plan.new = src.fetch_branch(repo.branch)
        src.ensure_commit(repo.pin)
    except ss.SyncError as exc:
        plan.errors.append(str(exc))
        return plan
    if plan.new == repo.pin:
        return plan
    if not src.is_ancestor(repo.pin, plan.new):
        plan.errors.append(f"pin {repo.pin[:12]} is not an ancestor of {plan.new[:12]}: "
                           "upstream history was rewritten; the pin stays")
        return plan
    for e in sources.entries_for(repo.id):
        try:
            plan_entry(src, repo, e, plan)
        except ss.SyncError as exc:
            plan.errors.append(f"{e.name}: {exc}")
    return plan


def plan_entry(src: ss.GitSource, repo: ss.Repo, e: ss.Entry, plan: RepoPlan) -> None:
    old_t = src.tree_at(repo.pin, e.path)
    if old_t is None:
        raise ss.SyncError(f"{e.path} is missing at the pin {repo.pin[:12]}; run --check")
    new_t = src.tree_at(plan.new, e.path)
    if new_t is None:
        raise ss.SyncError(f"{e.path} is gone at {plan.new[:12]}; the pin stays")
    if old_t == new_t:
        return
    expected, transform = new_t, None
    if e.kind == "fork":
        expected, transform = ss.renamed_tree(src, new_t, e.rename, e.name)
    plan.signals += ss.tree_signals(src, e.name, old_t, new_t)
    plan.changes.append(SkillChange(e, new_t, expected, transform))


def apply_plan(root: Path, sources: ss.Sources, src: ss.GitSource, plan: RepoPlan) -> None:
    for ch in plan.changes:
        dest = root / "skills" / ch.entry.name
        ss.export_tree(src, ch.new_tree, dest, ch.transform)
        actual = ss.tree_of_dir(dest)
        if actual != ch.expected:
            raise ss.SyncError(f"wrote skills/{ch.entry.name} but its tree is {actual}, expected {ch.expected}")
    sources.set_pin(plan.repo.id, plan.new)


def status_line(p: RepoPlan) -> str:
    if p.errors:
        return f"{p.repo.id}: failed; the pin stays at {p.repo.pin[:12]}"
    if not p.moves:
        return f"{p.repo.id}: current at {p.repo.pin[:12]}"
    return f"{p.repo.id}: {p.repo.pin[:12]} -> {p.new[:12]}, {len(p.changes)} skill change(s)"


def commit_message(moved: list[RepoPlan]) -> str:
    n_skills = sum(len(p.changes) for p in moved)
    n_repos = len(moved)
    s = lambda n: "" if n == 1 else "s"  # noqa: E731
    if n_skills:
        title = f"skill-sync: update {n_skills} skill{s(n_skills)} from {n_repos} upstream{s(n_repos)}"
    else:
        title = f"skill-sync: move {n_repos} pin{s(n_repos)}, no skill changes"
    body = []
    for p in moved:
        names = ", ".join(ch.entry.name for ch in p.changes) or "no skill changes"
        body.append(f"{p.repo.id} {p.repo.pin[:12]} -> {p.new[:12]}: {names}")
    warnings = [f"  {sig}" for p in moved for sig in p.signals]
    if warnings:
        body += ["", "Warnings:"] + warnings
    return title + "\n\n" + "\n".join(body) + "\n"


def run_update(root: Path, sources: ss.Sources, cache_root: Path, dry_run: bool) -> int:
    plans: list[tuple[RepoPlan, ss.GitSource]] = []
    for rid in sorted(sources.repos):
        repo = sources.repos[rid]
        src = ss.GitSource(cache_root, rid, repo.url)
        plans.append((plan_repo(src, sources, repo), src))
    for p, _src in plans:
        print(status_line(p))
        for x in p.errors:
            print(f"    error: {x}")
        for sig in p.signals:
            print(f"    warning: {sig}")
    moved = [(p, src) for p, src in plans if p.moves]
    if not dry_run:
        for p, src in moved:
            apply_plan(root, sources, src, p)
        if moved:
            (root / "sources.json").write_text(sources.dumps(), encoding="utf-8")
    if moved:
        label = "commit message (dry run; nothing written)" if dry_run else "commit message"
        print(f"\n--- {label} ---\n" + commit_message([p for p, _src in moved]))
    else:
        print("\nno pin moves")
    return 1 if any(p.errors for p, _src in plans) else 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--root", default=str(ROOT), help="my-skills checkout (default: this script's repo)")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="compare vendored folders with their pinned trees")
    mode.add_argument("--dry-run", action="store_true", help="report the update without writing anything")
    p.add_argument("--cache", help="reuse this folder for upstream fetches (default: a temporary folder)")
    args = p.parse_args(argv)
    root = Path(args.root).resolve()
    try:
        sources = ss.load_sources(root / "sources.json")
        with ss.cache_dir(args.cache) as cache_root:
            if args.check:
                return run_check(root, sources, cache_root)
            return run_update(root, sources, cache_root, args.dry_run)
    except ss.SyncError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
