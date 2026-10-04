"""install.py: real copies, an offline --check, and the refusals that keep it out of home and Glow."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from tests.helpers import INSTALL, Env, Upstream, skill_md, snapshot, write_files

MY_SKILLS = {
    "README.md": "# my-skills\n",
    "skills/alpha/SKILL.md": skill_md("alpha"),
    "skills/alpha/references/notes.md": "Notes.\n",
    "skills/alpha/scripts/run.sh": ("100755", "#!/bin/sh\n"),
    "skills/beta/SKILL.md": skill_md("beta"),
}


class InstallTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.mkdtemp(prefix="skill-sync-test-")
        self.tmp = Path(self._tmp)
        self.env = Env(self.tmp)
        self.source = Upstream(self.env, "me/my-skills")
        self.commit = self.source.commit(MY_SKILLS, "my-skills 1")
        self.project = self.git_repo("project")

    def tearDown(self) -> None:
        shutil.rmtree(self._tmp, ignore_errors=True)

    def git_repo(self, name: str) -> Path:
        path = self.tmp / name
        path.mkdir(parents=True, exist_ok=True)
        self.env.git("init", "--quiet", str(path))
        return path

    def install(self, project: Path, *args: str) -> subprocess.CompletedProcess:
        return self.env.run(INSTALL, "--project", str(project), "--source", self.source.url, "--commit", self.commit,
                            *args)

    def check(self) -> subprocess.CompletedProcess:
        return self.env.run(INSTALL, "--project", str(self.project), "--check")

    def test_installs_real_copies_and_check_passes(self):
        result = self.install(self.project, "alpha")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        alpha = self.project / ".claude/skills/alpha"
        self.assertFalse(alpha.is_symlink())
        self.assertEqual((alpha / "references/notes.md").read_text(), "Notes.\n")
        self.assertTrue(os.access(alpha / "scripts/run.sh", os.X_OK))
        self.assertFalse((self.project / ".claude/skills/beta").exists())
        manifest = json.loads((self.project / ".claude/my-skills.lock.json").read_text())
        self.assertEqual(manifest["commit"], self.commit)
        self.assertEqual(manifest["skills"], {"alpha": self.source.gitc("rev-parse", f"{self.commit}:skills/alpha")})
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("check ok: 1 skills match my-skills", result.stdout)

    def test_tampered_copy_fails_check(self):
        self.assertEqual(self.install(self.project, "alpha").returncode, 0)
        notes = self.project / ".claude/skills/alpha/references/notes.md"
        notes.write_bytes(notes.read_bytes().replace(b"N", b"n", 1))
        result = self.check()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("FAIL drift .claude/skills/alpha", result.stdout)

    def test_rerun_that_leaves_out_an_installed_skill_is_refused(self):
        self.assertEqual(self.install(self.project, "alpha").returncode, 0)
        self.assertEqual(self.install(self.project, "alpha").returncode, 0)
        before = snapshot(self.project)
        result = self.install(self.project, "beta")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("refused: alpha still installed", result.stderr)
        self.assertEqual(snapshot(self.project), before)
        shutil.rmtree(self.project / ".claude/skills/alpha")
        self.assertEqual(self.install(self.project, "beta").returncode, 0)
        self.assertEqual(self.check().returncode, 0)

    def test_unknown_skill_writes_nothing(self):
        before = snapshot(self.project)
        result = self.install(self.project, "alpha", "gamma")
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertIn("has no skills/gamma", result.stderr)
        self.assertEqual(snapshot(self.project), before)

    def test_refuses_non_git_home_and_glow_folders(self):
        home = self.env.home
        write_files(home / ".claude/skills/kept", {"SKILL.md": skill_md("kept")})
        self.env.git("init", "--quiet", str(home))
        plain = self.tmp / "plain"
        plain.mkdir()
        linked = self.git_repo("linked")
        (linked / ".claude").mkdir()
        os.symlink(home / ".claude/skills", linked / ".claude/skills")
        glow = self.git_repo("glow")
        write_files(glow, {"tools/skills/catalog.lock.json": "{}\n"})
        home_before = snapshot(home)
        for target, reason in (
            (plain, "is not the top folder of a git repository"),
            (home, "is the home folder"),
            (linked, "is the home folder"),
            (glow, "is a Glow clone"),
        ):
            with self.subTest(target=target.name):
                before = snapshot(target)
                result = self.install(target, "alpha")
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertIn(f"refused: {target.resolve()} {reason}", result.stderr)
                self.assertEqual(snapshot(target), before)
        self.assertEqual(snapshot(home), home_before)
        result = self.install(glow, "--locked-project", "alpha")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
