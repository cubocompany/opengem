# Manual Smoke Test Checklist

Run these checks before marking the v1 MVP as ready for handoff or publication.
Each step lists the expected result. Check the box when confirmed.

## Prerequisites

- [ ] `bun install` completed without errors
- [ ] `bun test` passes all tests (currently 51)
- [ ] `bun run check` (tsc --noEmit) exits clean
- [ ] Obsidian desktop app is installed and running
- [ ] `obsidian` CLI is installed and on PATH (`obsidian --version` returns a version string)
- [ ] At least one Obsidian vault exists and is open in the app

---

## 1. Environment doctor

**Command:** ask OpenCode to call `obsidian_env_doctor`

Expected `data`:
```json
{
  "cliInstalled": true,
  "appRunning": true,
  "defaultVault": null,
  "skills": {
    "mode": "external",
    "path": "...",
    "inSync": true
  }
}
```

- [ ] `ok` is `true`
- [ ] `cliInstalled` is `true`
- [ ] `appRunning` is `true`
- [ ] `skills.inSync` is `true` (or `false` with a meaningful path)

---

## 2. Skills check

**Command:** ask OpenCode to call `obsidian_skills_check`

- [ ] `ok` is `true`
- [ ] `found` contains all five skills: `obsidian-markdown`, `obsidian-bases`, `json-canvas`, `obsidian-cli`, `defuddle`
- [ ] `missing` is empty

---

## 3. Search

**Command:** ask OpenCode to call `obsidian_search` with `query="test"`

- [ ] `ok` is `true`
- [ ] `data.query` is `"test"`
- [ ] `data.results` is a string (may be empty if no matching notes)
- [ ] `schemaVersion` is `"1.0"`

---

## 4. Read (by file name)

**Command:** ask OpenCode to call `obsidian_read` with an existing note's title

- [ ] `ok` is `true`
- [ ] `data.content` contains the note's Markdown
- [ ] `data.target.file` matches the title you passed

---

## 5. Read (by path)

**Command:** ask OpenCode to call `obsidian_read` with `path="<folder>/<note>.md"`

- [ ] `ok` is `true`
- [ ] `data.content` is non-empty
- [ ] `data.target.path` matches the path you passed

---

## 6. Create note

**Command:** ask OpenCode to call `obsidian_create_note` with:
- `name`: a unique title (e.g. `"Smoke Test Note"`)
- `content`: `"# Smoke Test\n\nCreated by obsidian-opencode-plugin manual smoke test."`
- `vault`: your vault name

- [ ] `ok` is `true`
- [ ] `data.created` is `true`
- [ ] The note appears in Obsidian

---

## 7. Append note

**Command:** ask OpenCode to call `obsidian_append_note` with:
- `file`: the note created in step 6 (`"Smoke Test Note"`)
- `content`: `"\n\n## Appended section\n\nAppended by smoke test."`
- `vault`: your vault name

- [ ] `ok` is `true`
- [ ] `data.appended` is `true`
- [ ] The appended content appears in the note in Obsidian

---

## 8. Set property

**Command:** ask OpenCode to call `obsidian_set_property` with:
- `file`: `"Smoke Test Note"`
- `name`: `"status"`
- `value`: `"tested"`
- `vault`: your vault name

- [ ] `ok` is `true`
- [ ] `data.property` is `"status"`
- [ ] `data.updated` is `true`
- [ ] The frontmatter field appears in Obsidian

---

## 9. Degraded mode: CLI not found

Temporarily rename or remove `obsidian` from PATH, then call `obsidian_read`.

- [ ] `ok` is `false`
- [ ] `error.code` is `"CLI_NOT_FOUND"`
- [ ] `hint` contains a human-readable suggestion
- [ ] The tool does not throw or crash OpenCode

Restore `obsidian` to PATH after this check.

---

## 10. Write-without-vault rejection

**Command:** call `obsidian_create_note` with no `vault` and no `defaultVault` configured.

- [ ] `ok` is `false`
- [ ] `error.code` is `"VAULT_REQUIRED"`

---

## 11. Path with spaces and Unicode

**Command:** call `obsidian_read` with `file` containing spaces and non-ASCII characters
(e.g. `"Notas de revisión"` or `"2026-04 Week Notes"`).

- [ ] `ok` is `true` (if the file exists) or `ok` is `false` with a meaningful error (not a crash)
- [ ] No shell quoting artifacts in `stdout` or `stderr`

---

## Sign-off

| Check | Result | Notes |
|---|---|---|
| All unit tests pass | | |
| Type-check clean | | |
| env-doctor | | |
| skills-check | | |
| search | | |
| read by file | | |
| read by path | | |
| create | | |
| append | | |
| set-property | | |
| degraded mode | | |
| write-without-vault | | |
| spaces/Unicode | | |

**Tested by:** _______________  
**Date:** _______________  
**OpenCode version:** _______________  
**Obsidian version:** _______________  
**obsidian CLI version:** _______________
