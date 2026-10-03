"""Fixture builders: local bare upstream repos and a my-skills checkout.

Upstream commits are built with git plumbing (hash-object, update-index
--cacheinfo, commit-tree), so file modes and case-only path differences are
exact even on a case-insensitive Mac file system. Fixtures never use real
upstream commits, and GIT_ALLOW_PROTOCOL=file makes any network URL fail.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
UPDATE = REPO / "scripts" / "update.py"
INSTALL = REPO / "scripts" / "install.py"
sys.path.insert(0, str(REPO / "scripts"))
import skillsync as ss  # noqa: E402

Files = dict  # path -> str | bytes | (mode, str | bytes)


def skill_md(name: str, description: str = "A fixture skill.", extra: str = "", body: str = "Body.\n") -> str:
    return f"---\nname: {name}\ndescription: {description}\n{extra}---\n\n# {name}\n\n{body}"


def _bytes(v) -> bytes:
    return v if isinstance(v, bytes) else v.encode("utf-8")


def _mode_data(v) -> tuple[str, bytes]:
    if isinstance(v, tuple):
        return v[0], _bytes(v[1])
    return "100644", _bytes(v)


def subtree(files: Files, prefix: str) -> Files:
    p = prefix.rstrip("/") + "/"
    return {k[len(p):]: v for k, v in files.items() if k.startswith(p)}


def snapshot(root: Path) -> dict[str, bytes]:
    """Every path under root with its bytes and mode, for 'writes nothing' checks. Symlinks are not followed."""
    out = {}
    for dirpath, dirnames, filenames in os.walk(root):
        for name in dirnames + filenames:
            p = Path(dirpath) / name
            rel = p.relative_to(root).as_posix()
            if p.is_symlink():
                out[rel] = b"link:" + os.fsencode(os.readlink(p))
            elif p.is_dir():
                out[rel] = b"dir"
            else:
                out[rel] = p.read_bytes() + (p.stat().st_mode & 0o777).to_bytes(2, "big")
    return out


def write_files(dest: Path, files: Files) -> None:
    for rel, v in files.items():
        mode, data = _mode_data(v)
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        os.chmod(target, 0o755 if mode == "100755" else 0o644)


class Env:
    def __init__(self, tmp: Path):
        self.tmp = tmp
        self.home = tmp / "home"
        self.home.mkdir()
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        env.update(
            GIT_ALLOW_PROTOCOL="file",
            GIT_CONFIG_GLOBAL=os.devnull,
            GIT_CONFIG_NOSYSTEM="1",
            GIT_TERMINAL_PROMPT="0",
            GIT_AUTHOR_NAME="fixture", GIT_AUTHOR_EMAIL="fixture@example.invalid",
            GIT_COMMITTER_NAME="fixture", GIT_COMMITTER_EMAIL="fixture@example.invalid",
            HOME=str(self.home),
        )
        self.vars = env

    def git(self, *args: str, cwd: Path | None = None, input: bytes | None = None) -> str:
        proc = subprocess.run(["git", *args], cwd=cwd, input=input, capture_output=True, env=self.vars)
        if proc.returncode != 0:
            raise AssertionError(f"git {args} failed: {proc.stderr.decode()}")
        return proc.stdout.decode().strip()

    def run(self, script: Path, *args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(script), *args], cwd=cwd, capture_output=True, text=True,
                              env=self.vars)


class Upstream:
    """A bare repo served over file:// like an official upstream."""

    def __init__(self, env: Env, name: str, branch: str = "main"):
        self.env = env
        self.path = env.tmp / "upstreams" / f"{name.replace('/', '_')}.git"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        env.git("init", "--quiet", "--bare", "-b", branch, str(self.path))
        self.gitc("config", "uploadpack.allowFilter", "true")
        self.gitc("config", "uploadpack.allowAnySHA1InWant", "true")
        self.branch = branch
        self.files: Files = {}

    @property
    def url(self) -> str:
        return self.path.as_uri()

    def gitc(self, *args: str, input: bytes | None = None, extra_env: dict | None = None) -> str:
        vars = dict(self.env.vars, **(extra_env or {}))
        proc = subprocess.run(["git", f"--git-dir={self.path}", *args], input=input, capture_output=True, env=vars)
        if proc.returncode != 0:
            raise AssertionError(f"git {args} failed: {proc.stderr.decode()}")
        return proc.stdout.decode().strip()

    def commit(self, files: Files, message: str = "change") -> str:
        """Commit a full snapshot of files on the default branch."""
        branch = self.branch
        index = self.env.tmp / f"index-{os.getpid()}-{id(self)}"
        if index.exists():
            index.unlink()
        ienv = {"GIT_INDEX_FILE": str(index)}
        for rel, v in sorted(files.items()):
            mode, data = _mode_data(v)
            oid = self.gitc("hash-object", "-w", "--stdin", input=data)
            self.gitc("update-index", "--add", "--cacheinfo", f"{mode},{oid},{rel}", extra_env=ienv)
        tree = self.gitc("write-tree", extra_env=ienv) if files else ss.EMPTY_TREE
        index.unlink(missing_ok=True)
        parent = subprocess.run(["git", f"--git-dir={self.path}", "rev-parse", "--verify", "-q", f"refs/heads/{branch}"],
                                capture_output=True, env=self.env.vars).stdout.decode().strip()
        args = ["commit-tree", tree, "-m", message] + (["-p", parent] if parent else [])
        commit = self.gitc(*args)
        self.gitc("update-ref", f"refs/heads/{branch}", commit)
        self.files = dict(files)
        return commit

    def edit(self, updates: Files | None = None, remove: tuple[str, ...] = (), message: str = "change") -> str:
        files = dict(self.files)
        for rel in remove:
            for k in [k for k in files if k == rel or k.startswith(rel.rstrip("/") + "/")]:
                del files[k]
        files.update(updates or {})
        return self.commit(files, message)

    def tip(self) -> str:
        return self.gitc("rev-parse", f"refs/heads/{self.branch}")


# The base scenario: two upstreams (one on master), one of each entry kind.

ACME = {
    "README.md": "# acme\n",
    "skills/alpha/SKILL.md": skill_md("alpha"),
    "skills/alpha/references/notes.md": "Notes.\n",
    "skills/proto/SKILL.md": skill_md("proto", "Prototype skill.", extra="disable-model-invocation: true\n"),
    "skills/proto/PICKER.md": "Picker.\n",
}
OLD = {
    "skills/gamma/SKILL.md": skill_md("gamma", extra="allowed-tools: Read\n"),
}
MINE = {"SKILL.md": skill_md("mine", "My own skill.")}


class Scenario(unittest.TestCase):
    """Builds the base scenario in a temp folder for each test."""

    def setUp(self) -> None:
        self._tmp = tempfile.mkdtemp(prefix="skill-sync-test-")
        self.tmp = Path(self._tmp)
        self.env = Env(self.tmp)
        self.acme = Upstream(self.env, "acme/skills")
        self.old = Upstream(self.env, "old/skills", branch="master")
        self.acme.commit(ACME, "acme 1")
        self.old.commit(OLD, "old 1")
        self.root = self.tmp / "my-skills"
        self.sources = {
            "repos": {
                "acme/skills": {"url": self.acme.url, "branch": "main", "pin": self.acme.tip(), "license": "MIT (fixture)"},
                "old/skills": {"url": self.old.url, "branch": "master", "pin": self.old.tip(), "license": "MIT (fixture)"},
            },
            "skills": {
                "alpha": {"repo": "acme/skills", "path": "skills/alpha", "kind": "upstream"},
                "my-proto": {"repo": "acme/skills", "path": "skills/proto", "kind": "fork", "rename": "proto",
                             "note": "Renamed so it does not clash."},
                "gamma": {"repo": "old/skills", "path": "skills/gamma", "kind": "upstream"},
                "mine": {"kind": "own"},
            },
        }
        self.write_sources()
        write_files(self.root / "skills" / "alpha", subtree(ACME, "skills/alpha"))
        proto = subtree(ACME, "skills/proto")
        proto["SKILL.md"] = ACME["skills/proto/SKILL.md"].replace("name: proto\n", "name: my-proto\n", 1)
        write_files(self.root / "skills" / "my-proto", proto)
        write_files(self.root / "skills" / "gamma", subtree(OLD, "skills/gamma"))
        write_files(self.root / "skills" / "mine", MINE)

    def tearDown(self) -> None:
        shutil.rmtree(self._tmp, ignore_errors=True)

    def write_sources(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "sources.json").write_text(json.dumps(self.sources, indent=2) + "\n", encoding="utf-8")

    def read_sources(self) -> dict:
        return json.loads((self.root / "sources.json").read_text(encoding="utf-8"))

    def update(self, *args: str) -> subprocess.CompletedProcess:
        return self.env.run(UPDATE, "--root", str(self.root), *args)
