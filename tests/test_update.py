"""update.py: pins move with their folders, reruns converge, warnings print, and a gone path keeps the pin."""
from __future__ import annotations

import unittest

from tests.helpers import Scenario, skill_md, snapshot

PROTO_V2 = skill_md("proto", "Prototype skill, revised.", extra="disable-model-invocation: true\n")


class UpdateTest(Scenario):
    def test_pin_moves_and_folders_follow(self):
        old_pin = self.acme.tip()
        new = self.acme.edit({
            "skills/alpha/references/notes.md": "Notes, revised upstream.\n",
            "skills/proto/SKILL.md": PROTO_V2,
        })
        before = snapshot(self.root)
        dry = self.update("--dry-run")
        self.assertEqual(dry.returncode, 0, dry.stdout + dry.stderr)
        self.assertIn(f"acme/skills: {old_pin[:12]} -> {new[:12]}, 2 skill change(s)", dry.stdout)
        self.assertEqual(snapshot(self.root), before)

        result = self.update()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("skill-sync: update 2 skills from 1 upstream", result.stdout)
        repos = self.read_sources()["repos"]
        self.assertEqual(repos["acme/skills"]["pin"], new)
        self.assertEqual(repos["old/skills"]["pin"], self.sources["repos"]["old/skills"]["pin"])
        self.assertEqual((self.root / "skills/alpha/references/notes.md").read_text(), "Notes, revised upstream.\n")
        self.assertEqual((self.root / "skills/my-proto/SKILL.md").read_text(),
                         PROTO_V2.replace("name: proto\n", "name: my-proto\n", 1))
        check = self.update("--check")
        self.assertEqual(check.returncode, 0, check.stdout + check.stderr)

    def test_rerun_changes_nothing(self):
        self.acme.edit({"skills/alpha/references/notes.md": "Notes v2.\n"})
        self.assertEqual(self.update().returncode, 0)
        before = snapshot(self.root)
        again = self.update()
        self.assertEqual(again.returncode, 0, again.stdout + again.stderr)
        self.assertIn("no pin moves", again.stdout)
        self.assertEqual(snapshot(self.root), before)

    def test_warnings_print_and_the_update_goes_ahead(self):
        new = self.acme.edit({
            "skills/alpha/scripts/setup.py": "print('setup')\n",
            "skills/alpha/SKILL.md": skill_md("alpha", body="Run !`npm install` first.\n"),
        })
        result = self.update()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("warning: S3 alpha: A scripts/setup.py is not a .md file", result.stdout)
        self.assertIn("warning: S5 alpha: SKILL.md adds inline shell: Run !`npm install` first.", result.stdout)
        self.assertIn("Warnings:", result.stdout)
        self.assertEqual(self.read_sources()["repos"]["acme/skills"]["pin"], new)
        self.assertTrue((self.root / "skills/alpha/scripts/setup.py").is_file())

    def test_gone_path_keeps_the_pin_and_writes_nothing(self):
        old_pin = self.old.tip()
        new = self.old.edit({"skills/delta/SKILL.md": skill_md("delta")}, remove=("skills/gamma",))
        before = snapshot(self.root)
        result = self.update()
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"old/skills: failed; the pin stays at {old_pin[:12]}", result.stdout)
        self.assertIn(f"error: gamma: skills/gamma is gone at {new[:12]}; the pin stays", result.stdout)
        self.assertEqual(snapshot(self.root), before)


if __name__ == "__main__":
    unittest.main()
