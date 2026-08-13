# my-skills

Canonical personal skills live in `skills/<name>/SKILL.md`.

Cursor does not auto-load that folder. To use them in this checkout:

```bash
npx skills add . --skill '*' -a cursor -y
```

That installs into `.agents/skills/`, which Cursor and Cloud Agents do load.

On another repo or Cloud VM:

```bash
npx skills add peaceandchaos/my-skills --skill '*' -a cursor -y
```

Private clone: set `GH_TOKEN` with `repo` scope.

Refresh the pack from the Mac that owns the live skill dirs:

```bash
./sync-from-local.sh
```
