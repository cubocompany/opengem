# MVP Readiness

This document records the evidence that v1 is ready for use or publication.
Fill in each section after completing the manual smoke test.

---

## Build

| Check | Status |
|---|---|
| `bun install` | |
| `bun test` | |
| `bun run check` | |

**Test count:** ___  
**Date verified:** _______________

---

## Automated test coverage

| Module | Tests | Notes |
|---|---|---|
| `src/lib/config.ts` | 3 | vault resolution rules |
| `src/lib/cli.ts` | 15 | argv builder, error envelopes, executor |
| `src/lib/skills.ts` | 9 | path detection, validation, sync plan |
| `src/lib/capabilities.ts` | 4 | CLI/app detection seams |
| `src/tools/env-doctor.ts` | 2 | structured output |
| `src/tools/skills-check.ts` | 3 | found/missing lists |
| `src/tools/read.ts` | 3 | content, target validation, degraded |
| `src/tools/search.ts` | 2 | vault fallback, query in data |
| `src/tools/create-note.ts` | 2 | vault enforcement, success |
| `src/tools/append-note.ts` | 3 | target validation, vault, success |
| `src/tools/set-property.ts` | 3 | vault, target, success |
| `src/index.ts` | 1 | all 7 tools registered |
| **Total** | **51** | |

---

## Manual smoke test

> Complete `docs/manual-smoke-test.md` and paste results here.

| Step | Pass/Fail | Notes |
|---|---|---|
| env-doctor | | |
| skills-check | | |
| search | | |
| read by file | | |
| read by path | | |
| create note | | |
| append note | | |
| set property | | |
| degraded mode (CLI_NOT_FOUND) | | |
| write-without-vault (VAULT_REQUIRED) | | |
| spaces and Unicode | | |

---

## Known limitations (v1)

- `obsidian_env_doctor` checks `appRunning` by calling `obsidian status`; this may not reflect all app states.
- No active vault detection from the app; read-fallback to active vault requires passing `vault` or configuring `defaultVault`.
- `bun run sync:skills` fetches from GitHub directly; requires internet access for the remote path (use `--source` for offline).
- v1.5 commands (`backlinks`, `tags`, `plugin.reload`, `dev.*`) are not implemented.
- `obsidian.eval` is excluded from v1 per security policy.

---

## Versions tested

| Component | Version |
|---|---|
| OpenCode | |
| Obsidian | |
| obsidian CLI | |
| Node / Bun | |
| `@opencode-ai/plugin` | 1.4.6 |

---

## Go / No-go

- [ ] All automated tests pass
- [ ] Type-check clean
- [ ] Manual smoke test complete with no blocking failures
- [ ] Known limitations documented
- [ ] README covers install, config, and usage

**Decision:** _______________  
**By:** _______________  
**Date:** _______________
