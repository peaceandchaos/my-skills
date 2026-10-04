"""Shared code for update.py and install.py. Python 3 standard library plus git.

Upstream repositories and their files are untrusted input. Everything that
crosses that boundary is parsed here once: sources.json, tree listings, diff
records and SKILL.md frontmatter. Callers get typed values or a SyncError.
"""
from __future__ import annotations

import contextlib
import difflib
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Iterator

ZERO_OID = "0" * 40
EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
HEX40 = re.compile(r"^[0-9a-f]{40}$")
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
BRANCH_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*$")
KEY_RE = re.compile(r"^([A-Za-z0-9_][A-Za-z0-9_.-]*):(?:[ \t]|$)")
FENCE_BANG = re.compile(r"^\s*(?:`{3,}|~{3,})\s*!")
KINDS = ("upstream", "fork", "own")
ALLOWED_FRONTMATTER = frozenset(
    {"name", "description", "license", "metadata", "version", "argument-hint"}
)


class SyncError(Exception):
    """A failure the caller reports and stops on."""


class FrontmatterError(SyncError):
    """SKILL.md frontmatter that the strict parser rejects."""


# --------------------------------------------------------------------------
# sources.json


@dataclass(frozen=True)
class Repo:
    id: str
    url: str
    branch: str
    pin: str
    license: str


@dataclass(frozen=True)
class Entry:
    name: str
    kind: str
    repo: str | None
    path: str | None
    rename: str | None
    note: str | None


@dataclass
class Sources:
    repos: dict[str, Repo]
    entries: dict[str, Entry]
    raw: dict

    def entries_for(self, repo_id: str) -> list[Entry]:
        return [e for e in self.entries.values() if e.repo == repo_id]

    def set_pin(self, repo_id: str, pin: str) -> None:
        self.raw["repos"][repo_id]["pin"] = pin

    def dumps(self) -> str:
        return json.dumps(self.raw, indent=2, ensure_ascii=False) + "\n"


def _no_duplicate_keys(pairs: list[tuple[str, object]]) -> dict:
    seen: dict = {}
    for key, value in pairs:
        if key in seen:
            raise SyncError(f"sources.json: duplicate key {key!r}")
        seen[key] = value
    return seen


def _relpath_ok(path: object) -> bool:
    if not isinstance(path, str) or not path or path.startswith("/") or path.endswith("/"):
        return False
    if "\\" in path or "\0" in path:
        return False
    for part in path.split("/"):
        if part in ("", ".", "..") or "*" in part or part.lower() == ".git":
            return False
    return True


def parse_sources(text: str) -> Sources:
    """Parse and validate sources.json text. Raises SyncError."""
    try:
        raw = json.loads(text, object_pairs_hook=_no_duplicate_keys)
    except json.JSONDecodeError as exc:
        raise SyncError(f"sources.json: {exc}") from exc
    if (not isinstance(raw, dict) or set(raw) != {"repos", "skills"}
            or not isinstance(raw["repos"], dict) or not isinstance(raw["skills"], dict)):
        raise SyncError("sources.json: top level must be exactly 'repos' and 'skills' objects")
    problems: list[str] = []
    repos: dict[str, Repo] = {}
    for rid, r in raw["repos"].items():
        if not isinstance(r, dict) or set(r) != {"url", "branch", "pin", "license"}:
            problems.append(f"repo {rid}: needs exactly url, branch, pin, license")
            continue
        url, branch, pin, lic = r["url"], r["branch"], r["pin"], r["license"]
        if not isinstance(url, str) or not (url.startswith("https://") or url.startswith("file://")):
            problems.append(f"repo {rid}: url must be https:// or file://")
        if not isinstance(branch, str) or not BRANCH_RE.match(branch) or ".." in branch:
            problems.append(f"repo {rid}: bad branch {branch!r}")
        if not isinstance(pin, str) or not HEX40.match(pin):
            problems.append(f"repo {rid}: pin must be a full 40-hex commit")
        if not isinstance(lic, str) or not lic.strip():
            problems.append(f"repo {rid}: license is empty")
        repos[rid] = Repo(rid, str(url), str(branch), str(pin), str(lic))

    entries: dict[str, Entry] = {}
    used_repos: set[str] = set()
    allowed_fields = {
        "upstream": ({"repo", "path", "kind"}, {"note"}),
        "fork": ({"repo", "path", "kind", "rename"}, {"note"}),
        "own": ({"kind"}, {"note"}),
    }
    for name, s in raw["skills"].items():
        if not isinstance(s, dict) or s.get("kind") not in KINDS:
            problems.append(f"skill {name}: kind must be one of {', '.join(KINDS)}")
            continue
        kind = s["kind"]
        required, optional = allowed_fields[kind]
        fields = set(s)
        if not required <= fields or fields - required - optional:
            problems.append(
                f"skill {name}: kind {kind} needs {sorted(required)}"
                f" and allows {sorted(optional)}; has {sorted(fields)}"
            )
            continue
        if not NAME_RE.match(name):
            problems.append(f"skill {name}: bad name")
        path = s.get("path")
        if kind != "own":
            if not isinstance(s["repo"], str) or s["repo"] not in repos:
                problems.append(f"skill {name}: unknown repo {s['repo']!r}")
            else:
                used_repos.add(s["repo"])
            if not _relpath_ok(path):
                problems.append(f"skill {name}: bad path {path!r}")
        rename = s.get("rename")
        if kind == "fork" and (not isinstance(rename, str) or not NAME_RE.match(rename) or rename == name):
            problems.append(f"skill {name}: rename must be the upstream name, different from the key")
        note = s.get("note")
        if note is not None and not isinstance(note, str):
            problems.append(f"skill {name}: note must be a string")
        entries[name] = Entry(name, kind, s.get("repo"), path, rename, note)

    for rid in repos:
        if rid not in used_repos:
            problems.append(f"repo {rid}: no skill uses it")

    if problems:
        raise SyncError("sources.json is invalid:\n  " + "\n  ".join(problems))
    return Sources(repos, entries, raw)


def load_sources(path: Path) -> Sources:
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as exc:
        raise SyncError(f"cannot read {path}: {exc}") from exc
    return parse_sources(text)


# --------------------------------------------------------------------------
# git


def git_env() -> dict[str, str]:
    env = {
        k: v
        for k, v in os.environ.items()
        if not (k.startswith("GIT_") and k != "GIT_ALLOW_PROTOCOL" and not k.startswith("GIT_TRACE"))
    }
    env.update(
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_CONFIG_NOSYSTEM="1",
        GIT_TERMINAL_PROMPT="0",
        GIT_NO_LAZY_FETCH="1",
    )
    return env


GIT_SAFE = [
    "-c", "credential.helper=",
    "-c", f"core.hooksPath={os.devnull}",
    "-c", "protocol.allow=never",
    "-c", "protocol.https.allow=always",
    "-c", "protocol.file.allow=always",
]


def run_git(git_dir: Path, *args: str, input: bytes | None = None, check: bool = True) -> subprocess.CompletedProcess:
    """Run git against a scratch repository with no user or system config."""
    proc = subprocess.run(
        ["git", *GIT_SAFE, f"--git-dir={git_dir}", *args],
        input=input,
        capture_output=True,
        env=git_env(),
    )
    if check and proc.returncode != 0:
        msg = proc.stderr.decode("utf-8", "replace").strip()
        raise SyncError(f"git {' '.join(args[:3])} failed: {msg}")
    return proc


@dataclass(frozen=True)
class TreeEntry:
    mode: str
    type: str
    oid: str
    path: str


@dataclass(frozen=True)
class DiffEntry:
    old_mode: str
    new_mode: str
    old_oid: str
    new_oid: str
    status: str
    path: str


def parse_ls_tree(data: bytes) -> list[TreeEntry]:
    out: list[TreeEntry] = []
    for record in data.split(b"\0"):
        if not record:
            continue
        try:
            meta, path = record.split(b"\t", 1)
            mode, typ, oid = meta.decode("ascii").split(" ")
            out.append(TreeEntry(mode, typ, oid, path.decode("utf-8")))
        except (ValueError, UnicodeDecodeError) as exc:
            raise SyncError(f"cannot parse ls-tree record {record[:80]!r}") from exc
    return out


def parse_diff_raw(data: bytes) -> list[DiffEntry]:
    """Parse `git diff-tree -r -z --raw --no-renames` output."""
    fields = data.split(b"\0")
    if fields and fields[-1] == b"":
        fields.pop()
    if len(fields) % 2:
        raise SyncError("cannot parse diff output: odd field count")
    out: list[DiffEntry] = []
    for meta, path in zip(fields[0::2], fields[1::2]):
        try:
            m = meta.decode("ascii")
            if not m.startswith(":"):
                raise ValueError(m)
            old_mode, new_mode, old_oid, new_oid, status = m[1:].split(" ")
            if status not in ("A", "M", "D", "T"):
                raise ValueError(status)
            out.append(DiffEntry(old_mode, new_mode, old_oid, new_oid, status, path.decode("utf-8")))
        except (ValueError, UnicodeDecodeError) as exc:
            raise SyncError(f"cannot parse diff record {meta[:80]!r}") from exc
    return out


class GitSource:
    """A bare scratch repository holding a partial (blob:none) copy of one remote."""

    def __init__(self, cache_root: Path, key: str, url: str):
        self.url = url
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", key)
        self.dir = cache_root / f"{safe}.git"
        if not (self.dir / "HEAD").exists():
            self.dir.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["git", "init", "--quiet", "--bare", str(self.dir)],
                check=True, capture_output=True, env=git_env(),
            )
            self.git("config", "core.repositoryformatversion", "1")
            self.git("config", "extensions.partialClone", "upstream")
            self.git("config", "remote.upstream.promisor", "true")
            self.git("config", "remote.upstream.partialclonefilter", "blob:none")
        self.git("config", "remote.upstream.url", url)

    def git(self, *args: str, input: bytes | None = None, check: bool = True) -> subprocess.CompletedProcess:
        return run_git(self.dir, *args, input=input, check=check)

    def fetch_branch(self, branch: str) -> str:
        ref = f"refs/remotes/upstream/{branch}"
        self.git("fetch", "--quiet", "--no-tags", "--filter=blob:none", "upstream", f"+refs/heads/{branch}:{ref}")
        return self.rev_parse(ref)

    def ensure_commit(self, commit: str) -> None:
        if self.git("cat-file", "-e", f"{commit}^{{commit}}", check=False).returncode != 0:
            self.git("fetch", "--quiet", "--no-tags", "--filter=blob:none", "upstream", commit)
            if self.git("cat-file", "-e", f"{commit}^{{commit}}", check=False).returncode != 0:
                raise SyncError(f"{self.url} has no commit {commit}")

    def fetch_ref(self, ref: str) -> str:
        """Fetch one ref or commit and return its full commit id."""
        if HEX40.match(ref):
            self.ensure_commit(ref)
            return ref
        self.git("fetch", "--quiet", "--no-tags", "--filter=blob:none", "upstream", ref)
        return self.rev_parse("FETCH_HEAD^{commit}")

    def rev_parse(self, rev: str) -> str:
        out = self.git("rev-parse", "--verify", "--quiet", rev).stdout.decode().strip()
        if not HEX40.match(out):
            raise SyncError(f"cannot resolve {rev}")
        return out

    def object_at(self, commit: str, path: str) -> tuple[str, str] | None:
        """(oid, type) at commit:path, or None when the path does not exist.

        Reads the parent tree's listing, so it works for blobs that a partial
        cache has not fetched (cat-file reports those as missing).
        """
        path = path.strip("/")
        if not path:
            return self.rev_parse(f"{commit}^{{tree}}"), "tree"
        parent, _, base = path.rpartition("/")
        parent_tree = self.rev_parse(f"{commit}^{{tree}}") if not parent else self.tree_at(commit, parent)
        if parent_tree is None:
            return None
        for e in self.ls_tree(parent_tree, recursive=False):
            if e.path == base:
                return e.oid, e.type
        return None

    def tree_at(self, commit: str, path: str) -> str | None:
        found = self.object_at(commit, path)
        return found[0] if found and found[1] == "tree" else None

    def ls_tree(self, tree: str, recursive: bool = True) -> list[TreeEntry]:
        args = ["ls-tree", "-z", "--full-tree"] + (["-r"] if recursive else []) + [tree]
        return parse_ls_tree(self.git(*args).stdout)

    def diff_trees(self, old: str, new: str) -> list[DiffEntry]:
        out = self.git("diff-tree", "-r", "-z", "--raw", "--no-renames", "--no-abbrev", old, new).stdout
        return parse_diff_raw(out)

    def is_ancestor(self, old: str, new: str) -> bool:
        return self.git("merge-base", "--is-ancestor", old, new, check=False).returncode == 0

    def ensure_blobs(self, oids: Iterable[str]) -> None:
        wanted = sorted({o for o in oids if o != ZERO_OID})
        if not wanted:
            return
        check = self.git("cat-file", "--batch-check=%(objectname) %(objecttype)", input="".join(f"{o}\n" for o in wanted).encode()).stdout
        missing = [line.split()[0] for line in check.decode().splitlines() if line.endswith(" missing")]
        if missing:
            # Same negotiation as git's own lazy fetch. With the default one, GitHub treats blobs
            # reachable from commits already in the cache as present and leaves them out of the pack.
            self.git("-c", "fetch.negotiationAlgorithm=noop", "fetch", "--quiet", "--no-tags", "--no-write-fetch-head",
                     "--recurse-submodules=no", "--filter=blob:none", "--stdin", "upstream",
                     input="".join(f"{o}\n" for o in missing).encode())

    def read_blobs(self, oids: Iterable[str]) -> dict[str, bytes]:
        wanted = sorted({o for o in oids if o != ZERO_OID})
        self.ensure_blobs(wanted)
        out = self.git("cat-file", "--batch", input="".join(f"{o}\n" for o in wanted).encode()).stdout
        blobs: dict[str, bytes] = {}
        pos = 0
        for oid in wanted:
            nl = out.index(b"\n", pos)
            header = out[pos:nl].decode("ascii").split(" ")
            if len(header) != 3 or header[0] != oid or header[1] != "blob":
                raise SyncError(f"cannot read blob {oid}: {header}")
            size = int(header[2])
            blobs[oid] = out[nl + 1: nl + 1 + size]
            pos = nl + 1 + size + 1
        return blobs


@contextlib.contextmanager
def cache_dir(path: str | None) -> Iterator[Path]:
    """The given cache folder, or a temporary one removed afterwards."""
    if path:
        p = Path(path).resolve()
        p.mkdir(parents=True, exist_ok=True)
        yield p
        return
    tmp = tempfile.mkdtemp(prefix="skill-sync-")
    try:
        yield Path(tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# --------------------------------------------------------------------------
# git object ids computed in Python, for files on disk


def hash_blob(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def hash_tree(entries: Iterable[tuple[str, bytes, str]]) -> str:
    """entries: (mode without leading zero, name bytes, oid hex)."""
    def order(e: tuple[str, bytes, str]) -> bytes:
        return e[1] + (b"/" if e[0] == "40000" else b"")
    body = b"".join(m.encode() + b" " + n + b"\0" + bytes.fromhex(o) for m, n, o in sorted(entries, key=order))
    return hashlib.sha1(b"tree %d\0" % len(body) + body).hexdigest()


def tree_of_dir(path: Path) -> str | None:
    """The git tree id of a folder as it is on disk, or None if it holds no files.

    Counts every file, executable bit and symlink, so it sees exactly what an
    agent reading the folder sees.
    """
    entries: list[tuple[str, bytes, str]] = []
    with os.scandir(path) as it:
        for e in it:
            name = os.fsencode(e.name)
            if e.is_symlink():
                entries.append(("120000", name, hash_blob(os.fsencode(os.readlink(e.path)))))
            elif e.is_dir(follow_symlinks=False):
                sub = tree_of_dir(Path(e.path))
                if sub:
                    entries.append(("40000", name, sub))
            elif e.is_file(follow_symlinks=False):
                mode = "100755" if e.stat(follow_symlinks=False).st_mode & stat.S_IXUSR else "100644"
                entries.append((mode, name, hash_blob(Path(e.path).read_bytes())))
            else:
                raise SyncError(f"{e.path}: not a regular file, folder or symlink")
    return hash_tree(entries) if entries else None


# --------------------------------------------------------------------------
# exporting a tree to real files


def check_tree_paths(listing: list[TreeEntry]) -> None:
    folded: dict[str, str] = {}
    for e in listing:
        if e.mode not in ("100644", "100755"):
            raise SyncError(f"{e.path}: mode {e.mode} is not a regular file; skills are installed as real files only")
        if not _relpath_ok(e.path):
            raise SyncError(f"unsafe path {e.path!r}")
        f = e.path.casefold()
        if f in folded:
            raise SyncError(f"paths {folded[f]!r} and {e.path!r} differ only in case")
        folded[f] = e.path


def export_tree(src: GitSource, tree: str, dest: Path, transform: Callable[[str, bytes], bytes] | None = None) -> None:
    """Replace dest with the files of tree, as real files with their modes."""
    listing = src.ls_tree(tree)
    check_tree_paths(listing)
    blobs = src.read_blobs(e.oid for e in listing)
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.parent / f".{dest.name}.tmp-{os.getpid()}"
    remove_path(tmp)
    tmp.mkdir()
    for e in listing:
        data = blobs[e.oid]
        if transform:
            data = transform(e.path, data)
        target = tmp / e.path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        os.chmod(target, 0o755 if e.mode == "100755" else 0o644)
    remove_path(dest)
    os.rename(tmp, dest)


def remove_path(p: Path) -> None:
    if p.is_symlink() or p.is_file():
        p.unlink()
    elif p.is_dir():
        shutil.rmtree(p)


# --------------------------------------------------------------------------
# frontmatter and the rename transform


def _split_frontmatter(text: str) -> tuple[list[str], int]:
    lines = text.split("\n")
    if not lines or lines[0].rstrip("\r") != "---":
        raise FrontmatterError("no frontmatter: first line is not ---")
    for i in range(1, len(lines)):
        if lines[i].rstrip("\r") == "---":
            return lines, i
    raise FrontmatterError("frontmatter has no closing ---")


def parse_frontmatter(text: str) -> dict[str, str]:
    """Strict parse: top-level `key:` lines plus indented continuation lines."""
    lines, end = _split_frontmatter(text)
    keys: dict[str, str] = {}
    current: str | None = None
    for raw in lines[1:end]:
        line = raw.rstrip("\r")
        if not line.strip():
            if current:
                keys[current] += "\n"
            continue
        m = KEY_RE.match(line)
        if m:
            key = m.group(1)
            if key in keys:
                raise FrontmatterError(f"duplicate frontmatter key {key!r}")
            keys[key] = line[m.end():].strip()
            current = key
        elif line[0] in " \t" and current:
            keys[current] += "\n" + line
        else:
            raise FrontmatterError(f"cannot parse frontmatter line {line[:60]!r}")
    return keys


def frontmatter_name(fm: dict[str, str]) -> str | None:
    value = fm.get("name")
    if value is None:
        return None
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value


def rename_skill_md(data: bytes, old: str, new: str) -> bytes:
    """Change only the frontmatter `name:` line from old to new."""
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise FrontmatterError("SKILL.md is not UTF-8") from exc
    fm = parse_frontmatter(text)
    if frontmatter_name(fm) != old:
        raise FrontmatterError(f"upstream name is {frontmatter_name(fm)!r}, expected {old!r}")
    lines, end = _split_frontmatter(text)
    hits = [i for i in range(1, end) if KEY_RE.match(lines[i]) and lines[i].startswith("name:")]
    if len(hits) != 1:
        raise FrontmatterError("expected exactly one name: line")
    i = hits[0]
    eol = "\r" if lines[i].endswith("\r") else ""
    lines[i] = f"name: {new}{eol}"
    return "\n".join(lines).encode("utf-8")


def renamed_tree(src: GitSource, tree: str, old: str, new: str) -> tuple[str, Callable[[str, bytes], bytes]]:
    """Tree id after the rename transform, and the transform for export_tree."""
    top = src.ls_tree(tree, recursive=False)
    skill = [e for e in top if e.path == "SKILL.md" and e.type == "blob"]
    if not skill:
        raise SyncError("no top-level SKILL.md to rename")
    data = src.read_blobs([skill[0].oid])[skill[0].oid]
    new_data = rename_skill_md(data, old, new)
    entries = [
        (e.mode.lstrip("0"), e.path.encode("utf-8"), hash_blob(new_data) if e.path == "SKILL.md" else e.oid)
        for e in top
    ]

    def transform(path: str, blob: bytes) -> bytes:
        return rename_skill_md(blob, old, new) if path == "SKILL.md" else blob

    return hash_tree(entries), transform


# --------------------------------------------------------------------------
# warning signals S1-S5: changes that can add capabilities


@dataclass(frozen=True)
class Signal:
    code: str
    skill: str
    detail: str

    def __str__(self) -> str:
        return f"{self.code} {self.skill}: {self.detail}"


def added_lines(old: str, new: str) -> list[str]:
    a, b = old.splitlines(), new.splitlines()
    out: list[str] = []
    for tag, _i1, _i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag in ("replace", "insert"):
            out.extend(b[j1:j2])
    return out


def _decode(data: bytes | None, what: str) -> str:
    if data is None:
        return ""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise FrontmatterError(f"{what} is not UTF-8") from exc


def tree_signals(src: GitSource, skill: str, old: str, new: str) -> list[Signal]:
    """Warnings for one skill folder going from tree old to tree new."""
    sigs: list[Signal] = []
    diff = src.diff_trees(old, new)

    def add(code: str, detail: str) -> None:
        sigs.append(Signal(code, skill, detail))

    md = [d for d in diff if d.path.lower().endswith(".md")]
    blobs = src.read_blobs([d.old_oid for d in md] + [d.new_oid for d in md])
    for d in diff:
        if d.status == "A" and d.new_mode != "100644":
            add("S2", f"{d.path} added with mode {d.new_mode}")
        elif d.status in ("M", "T") and (d.old_mode != d.new_mode or d.new_mode != "100644"):
            add("S2", f"{d.path} mode {d.old_mode} -> {d.new_mode}")
        if not d.path.lower().endswith(".md"):
            add("S3", f"{d.status} {d.path} is not a .md file")
            continue
        try:
            old_text = _decode(blobs.get(d.old_oid), d.path)
            new_text = _decode(blobs.get(d.new_oid), d.path)
        except FrontmatterError as exc:
            add("S5", f"{exc}; cannot inspect added lines")
            continue
        for line in added_lines(old_text, new_text):
            if "!`" in line or FENCE_BANG.match(line):
                add("S5", f"{d.path} adds inline shell: {line.strip()[:80]}")
        if d.path.rsplit("/", 1)[-1].lower() != "skill.md":
            continue
        try:
            old_fm = parse_frontmatter(old_text) if d.status != "A" else {}
            new_fm = parse_frontmatter(new_text) if d.status != "D" else {}
        except FrontmatterError as exc:
            add("S4", f"{d.path}: {exc}")
            continue
        old_extra = {k: v for k, v in old_fm.items() if k not in ALLOWED_FRONTMATTER}
        new_extra = {k: v for k, v in new_fm.items() if k not in ALLOWED_FRONTMATTER}
        if old_extra != new_extra:
            changed = sorted(k for k in set(old_extra) | set(new_extra) if old_extra.get(k) != new_extra.get(k))
            add("S4", f"{d.path} frontmatter keys changed: {', '.join(changed)}")
        if d.path == "SKILL.md":
            if d.status == "D":
                add("S1", "SKILL.md removed")
            elif frontmatter_name(old_fm) != frontmatter_name(new_fm):
                add("S1", f"name {frontmatter_name(old_fm)!r} -> {frontmatter_name(new_fm)!r}")
    folded: dict[str, str] = {}
    for e in src.ls_tree(new):
        if e.path.rsplit("/", 1)[-1].lower() == "skill.md":
            key = e.path.casefold()
            if key in folded:
                add("S4", f"{folded[key]} and {e.path} differ only in case")
            folded[key] = e.path
    return sigs

