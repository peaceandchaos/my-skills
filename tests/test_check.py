"""update.py --check: every vendored folder equals its pinned upstream tree (C5, C7, C8)."""
from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from tests.helpers import ACME, Env, Scenario, skill_md, ss, write_files


class CheckTest(Scenario):
    def check(self) -> subprocess.CompletedProcess:
        return self.update("--check")

    def assert_fails(self, result: subprocess.CompletedProcess, *needles: str) -> None:
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        for needle in needles:
            self.assertIn(needle, result.stdout)

    def test_pristine_copy_passes(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("check ok: 0 failures; 3 vendored, 1 own, 2 repos", result.stdout)

    def test_hand_edited_vendored_file_fails(self):
        (self.root / "skills/alpha/references/notes.md").write_text("Notes, edited by hand.\n")
        self.assert_fails(self.check(), "FAIL drift skills/alpha", "differ: references/notes.md")

    def test_extra_file_in_vendored_folder_fails(self):
        (self.root / "skills/gamma/extra.md").write_text("Extra.\n")
        self.assert_fails(self.check(), "FAIL drift skills/gamma", "only here: extra.md")

    def test_dropped_upstream_file_fails(self):
        (self.root / "skills/alpha/references/notes.md").unlink()
        self.assert_fails(self.check(), "FAIL drift skills/alpha", "only upstream: references/notes.md")

    def test_executable_bit_fails(self):
        os.chmod(self.root / "skills/alpha/SKILL.md", 0o755)
        self.assert_fails(self.check(), "FAIL drift skills/alpha", "differ: SKILL.md")

    def test_fork_may_change_only_the_name_line(self):
        md = self.root / "skills/my-proto/SKILL.md"
        md.write_text(skill_md("my-proto", "A rewritten description.", extra="disable-model-invocation: true\n"))
        self.assert_fails(self.check(), "FAIL drift skills/my-proto", "after rename", "differ: SKILL.md")

    def test_fork_without_the_rename_fails(self):
        write_files(self.root / "skills/my-proto", {"SKILL.md": ACME["skills/proto/SKILL.md"]})
        self.assert_fails(self.check(), "skills/my-proto/SKILL.md: name is 'proto'; it must match the folder",
                          "FAIL drift skills/my-proto")

    def test_orphan_and_missing_folders_fail(self):
        write_files(self.root / "skills/stray", {"SKILL.md": skill_md("stray")})
        ss.remove_path(self.root / "skills/gamma")
        self.assert_fails(self.check(), "FAIL orphan skills/stray: no entry in sources.json",
                          "FAIL missing skills/gamma: sources.json lists it")

    def test_symlinked_skill_folder_fails(self):
        target = self.tmp / "elsewhere"
        os.rename(self.root / "skills/alpha", target)
        os.symlink(target, self.root / "skills/alpha")
        self.assert_fails(self.check(), "FAIL skills/alpha is not a real folder")

    def test_skill_md_outside_skills_fails(self):
        write_files(self.root / "pstack/skills/tdd", {"SKILL.md": skill_md("tdd")})
        self.assert_fails(self.check(), "FAIL pstack/skills/tdd/SKILL.md: a SKILL.md outside skills/")

    def test_pin_missing_upstream_fails(self):
        self.sources["repos"]["old/skills"]["pin"] = "1" * 40
        self.write_sources()
        self.assert_fails(self.check(), "FAIL old/skills:")


class SourcesFileTest(Scenario):
    """A bad or missing sources.json stops the run with exit code 2 before anything runs."""

    def assert_invalid(self, needle: str) -> None:
        result = self.update("--check")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn(needle, result.stderr)

    def test_names_differing_only_in_case(self):
        self.sources["skills"]["Alpha"] = {"repo": "acme/skills", "path": "skills/alpha", "kind": "upstream"}
        self.write_sources()
        self.assert_invalid("skill Alpha: bad name")

    def test_missing_sources_file(self):
        (self.root / "sources.json").unlink()
        result = self.update("--check")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("error: cannot read", result.stderr)
        self.assertNotIn("Traceback", result.stderr)

    def test_duplicate_json_key(self):
        text = (self.root / "sources.json").read_text()
        text = text.replace('"mine": {', '"mine": {"kind": "own"},\n    "mine": {', 1)
        (self.root / "sources.json").write_text(text)
        self.assert_invalid("duplicate key 'mine'")

    def test_upstream_entry_cannot_carry_a_rename(self):
        self.sources["skills"]["alpha"]["rename"] = "beta"
        self.write_sources()
        self.assert_invalid("skill alpha: kind upstream needs")


class TreeHashTest(unittest.TestCase):
    """tree_of_dir must agree with git's own tree id for the same files."""

    def test_matches_git_write_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = Env(Path(tmp))
            work = Path(tmp) / "work"
            write_files(work, {
                "SKILL.md": "x\n",
                "b/c/deep.md": "deep\n",
                "b-file": "dash sorts before slash\n",
                "run.sh": ("100755", "#!/bin/sh\n"),
                "naïve.md": "unicode name\n",
                "empty.txt": "",
            })
            (work / "empty-dir").mkdir()
            os.symlink("SKILL.md", work / "link")
            gd = f"--git-dir={Path(tmp) / 'repo.git'}"
            env.git("init", "--quiet", "--bare", str(Path(tmp) / "repo.git"))
            env.git(gd, f"--work-tree={work}", "add", "-A")
            want = env.git(gd, "write-tree")
            self.assertEqual(ss.tree_of_dir(work), want)


if __name__ == "__main__":
    unittest.main()
