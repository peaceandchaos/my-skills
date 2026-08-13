#!/usr/bin/env python3
"""Mirror agent skills into <repo>/.cursor/skills/ from local home dirs or GitHub."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_REMOTE = "peaceandchaos/my-skills"
REMOTE_SKILLS_SUBPATH = "skills"
LOCAL_ROOTS = (
    Path(".agents") / "skills",
    Path(".cursor") / "skills",
    Path(".claude") / "skills",
    Path(".codex") / "skills",
)


def repo_root() -> Path:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return Path(out)
    except subprocess.CalledProcessError:
        sys.exit("Not inside a git repository.")


def discover_builtins() -> set[str]:
    skills_cursor = Path.home() / ".cursor" / "skills-cursor"
    if not skills_cursor.is_dir():
        return set()
    return {p.parent.name for p in skills_cursor.rglob("SKILL.md")}


def collect_local(builtins: set[str]) -> dict[str, Path]:
    home = Path.home()
    chosen: dict[str, Path] = {}
    for rel in LOCAL_ROOTS:
        root = home / rel
        if not root.exists():
            continue
        for skill_md in root.rglob("SKILL.md"):
            if ".system" in skill_md.parts:
                continue
            skill_dir = skill_md.parent
            name = skill_dir.name
            if name in builtins:
                continue
            if name not in chosen:
                chosen[name] = skill_dir
    return chosen


def fetch_remote_skills(remote: str, ref: str) -> tuple[Path, Path]:
    """Download skills tarball; return (tmp_root_to_cleanup, skills_dir)."""
    tmp = Path(tempfile.mkdtemp(prefix="sync-cloud-skills-"))
    try:
        result = subprocess.run(
            ["gh", "api", f"repos/{remote}/tarball/{ref}"],
            check=False,
            capture_output=True,
        )
        if result.returncode != 0:
            err = (result.stderr or result.stdout or b"").decode("utf-8", errors="replace")
            if "401" in err or "Bad credentials" in err:
                raise RuntimeError(
                    f"Remote fetch failed (auth): {err.strip() or 'HTTP 401'}. "
                    f"Run `gh auth login` or set GH_TOKEN with access to {remote}."
                )
            if "403" in err or "404" in err:
                raise RuntimeError(
                    f"Remote fetch failed (access): {err.strip() or 'HTTP 403/404'}. "
                    f"Ensure GH_TOKEN/gh can read private repo {remote}."
                )
            raise RuntimeError(f"Remote fetch failed: {err.strip() or result.returncode}")

        subprocess.run(
            ["tar", "-xz", "-C", str(tmp)],
            input=result.stdout,
            check=True,
        )
        roots = [p for p in tmp.iterdir() if p.is_dir()]
        if not roots:
            raise RuntimeError("Remote tarball had no top-level directory.")
        skills = roots[0] / REMOTE_SKILLS_SUBPATH
        if not skills.is_dir():
            raise RuntimeError(f"Remote tarball missing {REMOTE_SKILLS_SUBPATH}/")
        return tmp, skills
    except FileNotFoundError:
        shutil.rmtree(tmp, ignore_errors=True)
        sys.exit("`gh` not found. Install GitHub CLI or sync from a Mac with local skills.")
    except Exception as e:
        shutil.rmtree(tmp, ignore_errors=True)
        sys.exit(str(e))


def collect_remote(remote: str, ref: str, builtins: set[str]) -> tuple[dict[str, Path], Path]:
    tmp, skills_root = fetch_remote_skills(remote, ref)
    chosen: dict[str, Path] = {}
    for skill_md in skills_root.rglob("SKILL.md"):
        skill_dir = skill_md.parent
        name = skill_dir.name
        if name in builtins:
            continue
        if name not in chosen:
            chosen[name] = skill_dir
    return chosen, tmp


def install_skills(
    dest: Path,
    chosen: dict[str, Path],
    *,
    replace: bool,
) -> tuple[list[str], list[tuple[str, str]]]:
    dest.mkdir(parents=True, exist_ok=True)

    copied: list[str] = []
    skipped: list[tuple[str, str]] = []

    for name, src in sorted(chosen.items()):
        skill_md = src / "SKILL.md"
        try:
            if skill_md.is_symlink() and not skill_md.exists():
                skipped.append((name, "broken symlink"))
                continue
        except OSError as e:
            skipped.append((name, str(e)))
            continue

        out = dest / name
        if out.resolve() == src.resolve():
            copied.append(name)
            continue

        staging = dest / f".{name}.staging"
        if staging.exists():
            shutil.rmtree(staging)
        try:
            shutil.copytree(src, staging, symlinks=False, ignore_dangling_symlinks=True)
            for p in staging.rglob("__pycache__"):
                shutil.rmtree(p, ignore_errors=True)
            if not (staging / "SKILL.md").exists():
                shutil.rmtree(staging, ignore_errors=True)
                skipped.append((name, "missing SKILL.md after copy"))
                continue
            if out.exists():
                shutil.rmtree(out)
            staging.rename(out)
            copied.append(name)
        except Exception as e:
            shutil.rmtree(staging, ignore_errors=True)
            skipped.append((name, f"copy failed: {e}"))

    if replace:
        keep = set(chosen) | set(copied)
        for child in list(dest.iterdir()):
            if not child.is_dir() or child.name.startswith("."):
                continue
            if child.name not in keep:
                shutil.rmtree(child)

    return copied, skipped


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Mirror agent skills into the current repo's .cursor/skills/."
    )
    p.add_argument(
        "--source",
        choices=("auto", "local", "remote"),
        default="auto",
        help="Skill source (default: auto = local if any, else remote).",
    )
    p.add_argument(
        "--replace",
        action="store_true",
        help="Delete dest skills not in source (keeps sync-cloud-skills until rewritten).",
    )
    p.add_argument(
        "--remote",
        default=os.environ.get("SYNC_CLOUD_SKILLS_REMOTE", DEFAULT_REMOTE),
        help=f"GitHub owner/repo for remote skills (default: {DEFAULT_REMOTE}).",
    )
    p.add_argument(
        "--ref",
        default=os.environ.get("SYNC_CLOUD_SKILLS_REF", "main"),
        help="Git ref for remote tarball (default: main).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    repo = repo_root()
    dest = repo / ".cursor" / "skills"
    builtins = discover_builtins()
    cleanup: Path | None = None
    source_label = args.source

    try:
        if args.source == "local":
            chosen = collect_local(builtins)
            if not chosen:
                sys.exit("No local skills found under ~/.agents|cursor|claude|codex/skills.")
            source_label = "local"
        elif args.source == "remote":
            chosen, cleanup = collect_remote(args.remote, args.ref, builtins)
            if not chosen:
                sys.exit(f"No skills found in {args.remote}:{args.ref}/{REMOTE_SKILLS_SUBPATH}")
            source_label = "remote"
        else:
            chosen = collect_local(builtins)
            if chosen and not os.environ.get("SYNC_CLOUD_SKILLS_FORCE_REMOTE"):
                source_label = "local"
            else:
                chosen, cleanup = collect_remote(args.remote, args.ref, builtins)
                if not chosen:
                    sys.exit(
                        "No local skills and remote fetch returned none. "
                        "See BOOTSTRAP.md or set SYNC_CLOUD_SKILLS_REMOTE."
                    )
                source_label = "remote"

        # Prefer the skill folder that contains this script so a stale home/remote
        # copy cannot overwrite in-progress edits to sync-cloud-skills itself.
        self_skill = Path(__file__).resolve().parent.parent
        if (self_skill / "SKILL.md").is_file() and self_skill.name == "sync-cloud-skills":
            chosen["sync-cloud-skills"] = self_skill

        mode = "replace" if args.replace else "upsert"
        copied, skipped = install_skills(dest, chosen, replace=args.replace)

        print(f"repo={repo}")
        print(f"source={source_label}")
        print(f"mode={mode}")
        if source_label == "remote":
            print(f"remote={args.remote}@{args.ref}")
        print(f"copied={len(copied)} skipped={len(skipped)}")
        for n in copied:
            print(f"  + {n}")
        for n, reason in skipped:
            print(f"  - {n}: {reason}")
    finally:
        if cleanup is not None:
            shutil.rmtree(cleanup, ignore_errors=True)


if __name__ == "__main__":
    main()
