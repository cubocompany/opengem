# Obsidian OpenCode Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenCode-native TypeScript plugin that vendors Obsidian skills metadata, validates the local environment, syncs bundled skills into a standard OpenCode path, and exposes MVP Obsidian tools backed by the `obsidian` CLI.

**Architecture:** The plugin keeps portable skill content in `skills/` and adds a thin OpenCode integration layer in `src/`. Runtime operations go through a single CLI wrapper with deterministic vault resolution, structured result envelopes, and stable error codes; tools and diagnostics reuse the same service layer so degraded mode stays consistent.

**Tech Stack:** TypeScript, Bun, `@opencode-ai/plugin`, Bun test, Node/Bun filesystem APIs

---

## File structure

### Create

- `package.json` — plugin package metadata, scripts, dependencies
- `tsconfig.json` — TypeScript config for plugin source and tests
- `README.md` — install, config, and usage docs
- `.gitignore` — ignore build/test artifacts
- `src/index.ts` — OpenCode plugin entrypoint
- `src/lib/types.ts` — shared types, result envelope, error codes
- `src/lib/config.ts` — plugin config and vault resolution rules
- `src/lib/capabilities.ts` — CLI/app/skills detection helpers
- `src/lib/skills.ts` — bundled/external skills sync and manifest logic
- `src/lib/cli.ts` — `obsidian` CLI command builder and executor
- `src/lib/commands.ts` — documented manifest for future slash-command wrappers and tool labels
- `src/lib/tool-inputs.ts` — shared schemas for tools/commands
- `src/tools/read.ts` — `obsidian_read`
- `src/tools/search.ts` — `obsidian_search`
- `src/tools/create-note.ts` — `obsidian_create_note`
- `src/tools/append-note.ts` — `obsidian_append_note`
- `src/tools/set-property.ts` — `obsidian_set_property`
- `src/tools/skills-check.ts` — `obsidian_skills_check`
- `src/tools/env-doctor.ts` — `obsidian_env_doctor`
- `scripts/sync-upstream-skills.ts` — fetch/copy upstream skills into local `skills/`
- `skills/README.md` — documents vendored skills source/version policy
- `skills/manifest.json` — upstream repo/version and bundled files list
- `tests/config.test.ts` — vault/config behavior
- `tests/capabilities.test.ts` — environment detection behavior
- `tests/skills.test.ts` — sync/version drift behavior
- `tests/cli.test.ts` — CLI arg building and error mapping
- `tests/tools.test.ts` — tool execution envelopes and degraded mode
- `tests/fixtures/skills/...` — local fake skill trees for sync tests
- `tests/fixtures/cli/...` — fake CLI outputs for parser/executor tests
- `docs/manual-smoke-test.md` — manual verification checklist
- `docs/mvp-readiness.md` — captured execution evidence for handoff

### Modify later during execution

- `skills/<name>/SKILL.md` — vendored upstream skill files synced by script

## Chunk 1: Foundation and skill packaging

### Task 1: Scaffold the plugin package and test harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Write the failing package sanity test**

Create `tests/config.test.ts` with the first failing test:

```ts
import { expect, test } from "bun:test"
import { resolvePluginConfig } from "../src/lib/config"

test("resolvePluginConfig returns built-in defaults", () => {
  const config = resolvePluginConfig({})

  expect(config.defaultVault).toBeNull()
  expect(config.skills.mode).toBe("external")
  expect(config.skills.syncDirName).toBe("obsidian-opencode-plugin-bundled")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/config.test.ts`
Expected: FAIL with module not found for `../src/lib/config`

- [ ] **Step 3: Create package metadata and TypeScript config**

Write `package.json`:

```json
{
  "name": "obsidian-opencode-plugin",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "bun test",
    "check": "tsc --noEmit",
    "sync:skills": "bun run scripts/sync-upstream-skills.ts"
  },
  "dependencies": {
    "@opencode-ai/plugin": "latest"
  },
  "devDependencies": {
    "bun-types": "^1.2.0",
    "typescript": "^5.8.0"
  }
}
```

Write `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "types": ["bun-types"]
  },
  "include": ["src", "tests", "scripts"]
}
```

Write `.gitignore`:

```gitignore
node_modules
dist
.DS_Store
coverage
```

- [ ] **Step 4: Add minimal README stub**

Write `README.md`:

```md
# Obsidian OpenCode Plugin

OpenCode plugin that bundles Obsidian skills metadata and exposes MVP Obsidian CLI-backed tools.
```

- [ ] **Step 5: Run test to verify it still fails for the right reason**

Run: `bun test tests/config.test.ts`
Expected: FAIL with module not found for `../src/lib/config`

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json tsconfig.json .gitignore README.md tests/config.test.ts
git commit -m "chore: scaffold obsidian opencode plugin package"
```

### Task 2: Implement shared types and plugin config resolution

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/config.ts`
- Modify: `tests/config.test.ts`

- [ ] **Step 1: Rewrite tests to lock vault and skills config rules**

Replace `tests/config.test.ts` with:

```ts
import { expect, test } from "bun:test"
import { resolvePluginConfig, resolveVault } from "../src/lib/config"

test("resolvePluginConfig returns built-in defaults", () => {
  const config = resolvePluginConfig({})

  expect(config.defaultVault).toBeNull()
  expect(config.skills.mode).toBe("external")
  expect(config.skills.syncDirName).toBe("obsidian-opencode-plugin-bundled")
})

test("write operations require explicit or default vault", () => {
  const config = resolvePluginConfig({ defaultVault: "Main" })
  const resolved = resolveVault({
    action: "write",
    inputVault: null,
    activeVault: "Ignored",
    config,
  })

  expect(resolved).toBe("Main")
})

test("read operations may fall back to active vault", () => {
  const config = resolvePluginConfig({})
  const resolved = resolveVault({
    action: "read",
    inputVault: null,
    activeVault: "Daily Vault",
    config,
  })

  expect(resolved).toBe("Daily Vault")
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test tests/config.test.ts`
Expected: FAIL with module not found for `../src/lib/config`

- [ ] **Step 3: Implement minimal shared types**

Write `src/lib/types.ts`:

```ts
export type SkillsMode = "external" | "bundled"
export type VaultAction = "read" | "write"

export type PluginConfig = {
  defaultVault: string | null
  skills: {
    mode: SkillsMode
    externalPath: string | null
    syncDirName: string
  }
}

export type CommandErrorCode =
  | "INVALID_ARGS"
  | "CLI_NOT_FOUND"
  | "APP_NOT_RUNNING"
  | "VAULT_REQUIRED"
  | "VAULT_NOT_FOUND"
  | "FILE_OR_PATH_REQUIRED"
  | "MUTUALLY_EXCLUSIVE_TARGET"
  | "PATH_OUTSIDE_VAULT"
  | "COMMAND_NOT_ENABLED"
  | "BUNDLED_SKILLS_OUT_OF_SYNC"
```

- [ ] **Step 4: Implement config resolution and deterministic vault selection**

Write `src/lib/config.ts`:

```ts
import type { PluginConfig, VaultAction } from "./types"

export function resolvePluginConfig(input: Partial<PluginConfig>): PluginConfig {
  return {
    defaultVault: input.defaultVault ?? null,
    skills: {
      mode: input.skills?.mode ?? "external",
      externalPath: input.skills?.externalPath ?? null,
      syncDirName: input.skills?.syncDirName ?? "obsidian-opencode-plugin-bundled",
    },
  }
}

export function resolveVault(args: {
  action: VaultAction
  inputVault: string | null
  activeVault: string | null
  config: PluginConfig
}) {
  if (args.inputVault) return args.inputVault
  if (args.config.defaultVault) return args.config.defaultVault
  if (args.action === "read") return args.activeVault
  return null
}
```

- [ ] **Step 5: Run targeted tests**

Run: `bun test tests/config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit config layer**

Run:

```bash
git add src/lib/types.ts src/lib/config.ts tests/config.test.ts
git commit -m "feat: add plugin config and vault resolution"
```

### Task 3: Vendor skills metadata and implement sync policy

**Files:**
- Create: `skills/README.md`
- Create: `skills/manifest.json`
- Create: `scripts/sync-upstream-skills.ts`
- Create: `src/lib/skills.ts`
- Create: `tests/skills.test.ts`
- Create: `tests/sync-upstream-skills.test.ts`
- Create: `tests/fixtures/skills/upstream/obsidian-markdown/SKILL.md`
- Create: `tests/fixtures/skills/upstream/obsidian-bases/SKILL.md`
- Create: `tests/fixtures/skills/upstream/json-canvas/SKILL.md`
- Create: `tests/fixtures/skills/upstream/obsidian-cli/SKILL.md`
- Create: `tests/fixtures/skills/upstream/defuddle/SKILL.md`

- [ ] **Step 1: Write failing sync policy tests**

Write `tests/skills.test.ts`:

```ts
import { expect, test } from "bun:test"
import { join } from "node:path"
import { detectSkillsState } from "../src/lib/skills"

test("detectSkillsState prefers explicit external path", async () => {
  const result = await detectSkillsState({
    mode: "external",
    explicitPath: "/tmp/external",
    homeDir: "/tmp/home",
    syncDirName: "custom-sync",
  })

  expect(result.path).toBe("/tmp/external")
  expect(result.mode).toBe("external")
})

test("detectSkillsState uses default external path when present", async () => {
  const result = await detectSkillsState({
    mode: "external",
    explicitPath: null,
    homeDir: "tests/fixtures",
    syncDirName: "custom-sync",
    exists: (path) => path.endsWith("obsidian-skills"),
  })

  expect(result.path.endsWith("obsidian-skills")).toBe(true)
})

test("detectSkillsState falls back to bundled path when external default is missing", async () => {
  const homeDir = join("tmp", "home")
  const result = await detectSkillsState({
    mode: "external",
    explicitPath: null,
    homeDir,
    syncDirName: "custom-sync",
    exists: () => false,
  })

  expect(result.path).toBe(join(homeDir, ".opencode", "skills", "custom-sync"))
})

test("detectSkillsState uses bundled path in bundled mode", async () => {
  const homeDir = join("tmp", "home")
  const result = await detectSkillsState({
    mode: "bundled",
    explicitPath: null,
    homeDir,
    syncDirName: "custom-sync",
    exists: () => false,
  })

  expect(result.mode).toBe("bundled")
  expect(result.path).toBe(join(homeDir, ".opencode", "skills", "custom-sync"))
})
```

Write `tests/sync-upstream-skills.test.ts` with failing tests for:

- manifest contains every required skill name,
- sync fails when a listed skill is missing from the source,
- sync updates `skills/manifest.json` with a synced timestamp,
- `--clean` is required before deleting extraneous vendored files.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test tests/skills.test.ts`
Expected: FAIL with module not found for `../src/lib/skills`

- [ ] **Step 3: Add vendored skills metadata files**

Write `skills/README.md`:

```md
# Vendored skills

These files mirror selected upstream `kepano/obsidian-skills` content.
Use `bun run sync:skills` to refresh them.
```

Write `skills/manifest.json`:

```json
{
  "upstreamRepo": "https://github.com/kepano/obsidian-skills",
  "upstreamRef": "main",
  "skills": [
    "obsidian-markdown",
    "obsidian-bases",
    "json-canvas",
    "obsidian-cli",
    "defuddle"
  ]
}
```

- [ ] **Step 4: Implement minimal detection and sync service**

Write `src/lib/skills.ts`:

```ts
import { existsSync } from "node:fs"
import { join } from "node:path"

export async function detectSkillsState(args: {
  mode: "external" | "bundled"
  explicitPath: string | null
  homeDir: string
  syncDirName: string
  exists?: (path: string) => boolean
}) {
  const exists = args.exists ?? existsSync

  if (args.explicitPath) {
    return { mode: "external" as const, path: args.explicitPath }
  }

  const bundledPath = join(args.homeDir, ".opencode", "skills", args.syncDirName)
  if (args.mode === "bundled") {
    return { mode: "bundled" as const, path: bundledPath }
  }

  const externalDefault = join(args.homeDir, ".opencode", "skills", "obsidian-skills")
  return {
    mode: args.mode,
    path: exists(externalDefault) ? externalDefault : bundledPath,
  }
}
```

Write `scripts/sync-upstream-skills.ts` with this exact contract:

- input: optional `--source=/absolute/or/relative/path/to/obsidian-skills`
- fallback source: clone or fetch raw files from the `upstreamRepo` and `upstreamRef` defined in `skills/manifest.json`
- required output: create/update `skills/<name>/SKILL.md` for every listed skill in the manifest
- validation: fail if any listed skill is missing from the source
- manifest update: write the resolved source ref plus synced timestamp back into `skills/manifest.json`
- safety: do not delete non-manifest files under `skills/` without an explicit `--clean` flag

Start with `tests/sync-upstream-skills.test.ts`, implement core sync/validation functions in `src/lib/skills.ts`, and keep `scripts/sync-upstream-skills.ts` as a thin CLI wrapper.

- [ ] **Step 5: Run skills tests**

Run: `bun test tests/skills.test.ts`
Expected: PASS

- [ ] **Step 6: Commit skills packaging**

Run:

```bash
git add skills scripts/sync-upstream-skills.ts src/lib/skills.ts tests/skills.test.ts tests/sync-upstream-skills.test.ts tests/fixtures/skills
git commit -m "feat: add bundled skills manifest and sync policy"
```

## Chunk 2: CLI runtime and MVP tools

### Task 4: Build the `obsidian` CLI wrapper and error envelopes

**Files:**
- Create: `src/lib/cli.ts`
- Modify: `src/lib/types.ts`
- Create: `tests/cli.test.ts`

- [ ] **Step 1: Verify the actual `obsidian` CLI contract before writing tests**

Capture from upstream docs/help/examples:

- exact command names for MVP (`read`, `search`, `create`, `append`, `property:set`),
- exact argument encoding (`key=value`, flags, quoting expectations),
- expected failure signals where available.

Record the verified contract in a comment block at the top of `tests/cli.test.ts` so the tests lock real behavior instead of guessed syntax.

- [ ] **Step 2: Write failing CLI builder and error-mapping tests**

Write `tests/cli.test.ts`:

```ts
import { expect, test } from "bun:test"
import { buildObsidianArgs } from "../src/lib/cli"

test("buildObsidianArgs maps read by file", () => {
  expect(buildObsidianArgs("read", { file: "My Note" })).toEqual([
    "read",
    "file=My Note",
  ])
})

test("buildObsidianArgs rejects file and path together", () => {
  expect(() =>
    buildObsidianArgs("read", { file: "A", path: "a.md" }),
  ).toThrow("MUTUALLY_EXCLUSIVE_TARGET")
})
```

- [ ] **Step 3: Run tests to verify failure**

Run: `bun test tests/cli.test.ts`
Expected: FAIL with module not found for `../src/lib/cli`

- [ ] **Step 4: Add a shared result envelope type before implementing the CLI wrapper**

Extend `src/lib/types.ts` with:

```ts
export type ResultEnvelope<TData = unknown> = {
  schemaVersion: "1.0"
  ok: boolean
  command: string
  args: Record<string, unknown>
  requiredCapabilities: string[]
  checkedCapabilities: string[]
  data: TData
  stdout: string
  stderr: string
  exitCode: number
  hint: string | null
  error: null | { code: CommandErrorCode; kind: string; message: string }
}
```

- [ ] **Step 5: Implement raw argv builder and full-envelope error helpers**

Write `src/lib/cli.ts`:

```ts
import type { CommandErrorCode } from "./types"

export function buildObsidianArgs(command: string, args: Record<string, unknown>) {
  if (args.file && args.path) throw new Error("MUTUALLY_EXCLUSIVE_TARGET")

  return [
    command,
    ...Object.entries(args)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => typeof value === "boolean" ? (value ? key : "") : `${key}=${String(value)}`)
      .filter(Boolean),
  ]
}

export function errorResult(code: CommandErrorCode, message: string, hint: string, command = "", args: Record<string, unknown> = {}, requiredCapabilities: string[] = [], checkedCapabilities: string[] = []): ResultEnvelope<null> {
  return {
    schemaVersion: "1.0",
    command,
    args,
    requiredCapabilities,
    checkedCapabilities,
    data: null,
    stdout: "",
    stderr: "",
    exitCode: 1,
    ok: false,
    error: { code, kind: "capability", message },
    hint,
  }
}
```

- [ ] **Step 6: Add failing executor tests, then implement the executor seam**

Extend `src/lib/cli.ts`:

```ts
export async function executeObsidianCli(
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>,
  command: string,
  args: Record<string, unknown>,
  meta: {
    requiredCapabilities: string[]
    checkedCapabilities: string[]
    mapError?: (result: { exitCode: number; stderr: string }) => { code: string; kind: string; message: string }
  },
) {
  const built = buildObsidianArgs(command, args)
  const result = await shell(["obsidian", ...built])
  const mappedError = result.exitCode === 0
    ? null
    : meta.mapError?.({ exitCode: result.exitCode, stderr: result.stderr })
      ?? { code: "COMMAND_NOT_ENABLED", kind: "runtime", message: result.stderr || "CLI command failed" }

  return {
    schemaVersion: "1.0",
    ok: result.exitCode === 0,
    command: `obsidian_${command.replace(":", "_")}`,
    args,
    requiredCapabilities: meta.requiredCapabilities,
    checkedCapabilities: meta.checkedCapabilities,
    data: null,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    hint: result.exitCode === 0 ? null : "Ask OpenCode to use obsidian_env_doctor",
    error: mappedError,
  }
}
```

Add failing tests before implementation for at least:

- raw argv output (no embedded shell quotes),
- `INVALID_ARGS` mapping,
- `CLI_NOT_FOUND` mapping,
- `APP_NOT_RUNNING` mapping.

- [ ] **Step 7: Run CLI tests**

Run: `bun test tests/cli.test.ts`
Expected: PASS

- [ ] **Step 8: Commit CLI wrapper**

Run:

```bash
git add src/lib/cli.ts src/lib/types.ts tests/cli.test.ts
git commit -m "feat: add obsidian cli wrapper"
```

### Task 5: Implement capability detection and environment doctor

**Files:**
- Create: `src/lib/capabilities.ts`
- Create: `src/tools/env-doctor.ts`
- Create: `src/tools/skills-check.ts`
- Create: `tests/capabilities.test.ts`
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: Write failing capability tests**

Write `tests/capabilities.test.ts`:

```ts
import { expect, test } from "bun:test"
import { detectCli } from "../src/lib/capabilities"

test("detectCli returns false when which fails", async () => {
  const result = await detectCli(async () => false)
  expect(result).toBe(false)
})
```

Create `tests/tools.test.ts` with a failing env doctor assertion:

```ts
import { expect, test } from "bun:test"
import { runEnvDoctor } from "../src/tools/env-doctor"

test("runEnvDoctor returns structured capabilities", async () => {
  const result = await runEnvDoctor({
    detectCli: async () => true,
    detectApp: async () => true,
    detectSkills: async () => ({ mode: "bundled", path: "/tmp/skills", inSync: true }),
    defaultVault: "Main",
  })

  expect(result.ok).toBe(true)
  expect(result.data.skills.inSync).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test tests/capabilities.test.ts tests/tools.test.ts`
Expected: FAIL with missing modules

- [ ] **Step 3: Implement capabilities helpers**

Write `src/lib/capabilities.ts`:

```ts
export async function detectCli(which: () => Promise<boolean>) {
  return which()
}

export async function detectApp(ping: () => Promise<boolean>) {
  return ping()
}
```

- [ ] **Step 4: Implement env doctor and skills check tools**

Write `src/tools/env-doctor.ts`:

```ts
export async function runEnvDoctor(args: {
  detectCli: () => Promise<boolean>
  detectApp: () => Promise<boolean>
  detectSkills: () => Promise<{ mode: string; path: string; inSync: boolean }>
  defaultVault: string | null
}) {
  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_env_doctor",
    args: {},
    requiredCapabilities: [],
    checkedCapabilities: ["cli", "app", "skills"],
    data: {
      cliInstalled: await args.detectCli(),
      appRunning: await args.detectApp(),
      defaultVault: args.defaultVault,
      skills: await args.detectSkills(),
    },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: null,
    error: null,
  }
}
```

Write `src/tools/skills-check.ts` with the same envelope style returning `found`, `missing`, and `skillsPath`.

- [ ] **Step 5: Run capability and tool tests**

Run: `bun test tests/capabilities.test.ts tests/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit diagnostics layer**

Run:

```bash
git add src/lib/capabilities.ts src/tools/env-doctor.ts src/tools/skills-check.ts tests/capabilities.test.ts tests/tools.test.ts
git commit -m "feat: add capability checks and diagnostics tools"
```

### Task 6: Implement the five MVP Obsidian tools on the shared service layer

**Files:**
- Create: `src/lib/tool-inputs.ts`
- Create: `src/tools/read.ts`
- Create: `src/tools/search.ts`
- Create: `src/tools/create-note.ts`
- Create: `src/tools/append-note.ts`
- Create: `src/tools/set-property.ts`
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: Write failing tool tests for read and create**

Extend `tests/tools.test.ts`:

```ts
import { runReadTool } from "../src/tools/read"
import { runSearchTool } from "../src/tools/search"
import { runCreateNoteTool } from "../src/tools/create-note"
import { runAppendNoteTool } from "../src/tools/append-note"
import { runSetPropertyTool } from "../src/tools/set-property"

test("runReadTool returns content in data payload", async () => {
  const result = await runReadTool({
    shell: async () => ({ exitCode: 0, stdout: "# Hello", stderr: "" }),
    input: { file: "My Note", vault: "Main" },
  })

  expect(result.ok).toBe(true)
  expect(result.data.content).toBe("# Hello")
})

test("runCreateNoteTool rejects missing vault on write", async () => {
  await expect(
    runCreateNoteTool({
      shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      input: { name: "New Note", content: "# x" },
      defaultVault: null,
      activeVault: "Daily",
    }),
  ).resolves.toMatchObject({
    ok: false,
    error: { code: "VAULT_REQUIRED" },
  })
})

test("runSearchTool uses read vault resolution", async () => {
  const result = await runSearchTool({
    shell: async () => ({ exitCode: 0, stdout: "hit", stderr: "" }),
    input: { query: "term" },
    defaultVault: null,
    activeVault: "Daily",
  })

  expect(result.ok).toBe(true)
  expect(result.args.vault).toBe("Daily")
})

test("runAppendNoteTool validates note target", async () => {
  await expect(
    runAppendNoteTool({
      shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      input: { content: "x", vault: "Main" },
      defaultVault: "Main",
      activeVault: null,
    }),
  ).resolves.toMatchObject({
    ok: false,
    error: { code: "FILE_OR_PATH_REQUIRED" },
  })
})

test("runSetPropertyTool returns structured property payload", async () => {
  const result = await runSetPropertyTool({
    shell: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    input: { name: "status", value: "done", file: "My Note", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data.property).toBe("status")
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test tests/tools.test.ts`
Expected: FAIL with missing tool modules

- [ ] **Step 3: Add shared input validation helpers**

Write `src/lib/tool-inputs.ts` with small validators:

```ts
export function ensureSingleTarget(input: { file?: string; path?: string }) {
  if (!input.file && !input.path) throw new Error("FILE_OR_PATH_REQUIRED")
  if (input.file && input.path) throw new Error("MUTUALLY_EXCLUSIVE_TARGET")
}
```

- [ ] **Step 4: Implement the MVP tools with shared vault rules**

Use the same pattern for each tool. Example `src/tools/read.ts`:

```ts
import { executeObsidianCli } from "../lib/cli"
import { ensureSingleTarget } from "../lib/tool-inputs"

export async function runReadTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { file?: string; path?: string; vault?: string }
}) {
  ensureSingleTarget(args.input)
  const result = await executeObsidianCli(args.shell, "read", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app", "vault"],
  })
  return { ...result, data: { target: { file: args.input.file ?? null, path: args.input.path ?? null, vault: args.input.vault ?? null }, content: result.stdout } }
}
```

Example `src/tools/create-note.ts`:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"

export async function runCreateNoteTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { name: string; content: string; vault?: string; template?: string; silent?: boolean; overwrite?: boolean }
  defaultVault: string | null
  activeVault: string | null
}) {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })
  if (!vault) return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_create_note", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])

  const result = await executeObsidianCli(args.shell, "create", { ...args.input, vault }, {
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
  })
  return { ...result, data: { name: args.input.name, created: result.ok, opened: !args.input.silent } }
}
```

Implement matching variants for `search`, `append`, and `property:set`, each only after its failing tests exist. For `search`, use read-style vault fallback rules. For `append` and `property:set`, require explicit/default vault plus single-target validation.

- [ ] **Step 5: Run all tool tests**

Run: `bun test tests/tools.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the MVP tools**

Run:

```bash
git add src/lib/tool-inputs.ts src/tools tests/tools.test.ts
git commit -m "feat: add mvp obsidian tools"
```

## Chunk 3: OpenCode registration, docs, and verification

### Task 7: Register the plugin entrypoint and expose tools in degraded mode

**Files:**
- Create: `src/lib/commands.ts`
- Create: `src/index.ts`
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: Write failing plugin registration test**

Replace the registration section of `tests/tools.test.ts` with:

```ts
import { ObsidianPlugin } from "../src"

test("plugin registers obsidian tools", async () => {
  const plugin = await ObsidianPlugin({
    project: null,
    client: { app: { log: async () => {} } },
    $: undefined,
    directory: ".",
    worktree: ".",
  } as never)

  expect(plugin.tool).toBeDefined()
  expect(plugin.tool.obsidian_read).toBeDefined()
  expect(plugin.tool.obsidian_search).toBeDefined()
  expect(plugin.tool.obsidian_create_note).toBeDefined()
  expect(plugin.tool.obsidian_append_note).toBeDefined()
  expect(plugin.tool.obsidian_set_property).toBeDefined()
  expect(plugin.tool.obsidian_skills_check).toBeDefined()
  expect(plugin.tool.obsidian_env_doctor).toBeDefined()
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun test tests/tools.test.ts`
Expected: FAIL with missing `src/index.ts`

- [ ] **Step 3: Verify the current OpenCode command-registration limitations and lock the v1 tool-first approach**

Document in `src/lib/commands.ts` that OpenCode plugins add tools/hooks, while slash commands live outside the plugin API. Store a stable manifest of human-facing labels and suggested future slash wrappers there instead of inventing unsupported runtime command registration.

Minimum proof required before continuing:

- one verified statement in code comments and docs that v1 ships stable tools,
- any slash-command wrappers are deferred or shipped separately from the plugin runtime.

- [ ] **Step 4: Implement plugin entrypoint and wire all MVP tools**

Write `src/lib/commands.ts` as a manifest that maps each tool ID to a human-facing label, description, and optional future slash-command name.

Write `src/index.ts`:

```ts
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { runReadTool } from "./tools/read"

export const ObsidianPlugin: Plugin = async () => {
  return {
    tool: {
      obsidian_read: tool({
        description: "Read an Obsidian note by file name or path",
        args: {},
        async execute(args) {
          return runReadTool({ shell: async () => ({ exitCode: 1, stdout: "", stderr: "shell not wired" }), input: args as never })
        },
      }),
    },
  }
}

export default ObsidianPlugin
```

Then expand it to register all seven MVP tools. Degraded-mode behavior must return structured unavailable responses when capabilities are missing.

- [ ] **Step 5: Add one degraded-mode execution test**

Add a test that simulates missing CLI support and verifies one CLI-backed tool returns:

```ts
{
  ok: false,
  error: { code: "CLI_NOT_FOUND" }
}
```

- [ ] **Step 6: Run tests and typecheck**

Run: `bun test tests/tools.test.ts && bun run check`
Expected: PASS

- [ ] **Step 7: Commit OpenCode registration**

Run:

```bash
git add src/index.ts src/lib/commands.ts tests/tools.test.ts
git commit -m "feat: register obsidian opencode plugin"
```

### Task 8: Finish docs, verification scripts, and smoke-test checklist

**Files:**
- Modify: `README.md`
- Modify: `skills/README.md`
- Optionally create: `docs/manual-smoke-test.md`

- [ ] **Step 1: Write the failing documentation checklist**

Add this checklist to `README.md` and leave placeholders until implementation is wired:

```md
## Verification

- [ ] `bun test`
- [ ] `bun run check`
- [ ] Tool `obsidian_skills_check` is discoverable
- [ ] Tool `obsidian_env_doctor` is discoverable
- [ ] Tool `obsidian_read` succeeds against a known note
- [ ] Tool `obsidian_search` succeeds against a known term
- [ ] Tool `obsidian_create_note` succeeds with explicit vault
- [ ] Tool `obsidian_append_note` succeeds against the created note
- [ ] Tool `obsidian_set_property` succeeds against the created note
```

- [ ] **Step 2: Replace the README stub with real install and config docs**

Document:

- npm installation path for OpenCode plugins,
- local plugin development via `.opencode/plugins/`,
- `defaultVault` config,
- `skills.mode` and `skills.externalPath`,
- `bun run sync:skills` vendoring flow,
- runtime bundled-skills sync behavior if implemented,
- degraded-mode behavior,
- stable MVP tool IDs.

- [ ] **Step 3: Add a manual smoke-test doc**

Write `docs/manual-smoke-test.md`:

```md
# Manual smoke test

1. Install plugin locally.
2. Run `bun test`.
3. Start OpenCode with the plugin enabled.
4. Ask OpenCode to use `obsidian_env_doctor` and confirm CLI/app detection.
5. Ask OpenCode to use `obsidian_skills_check` and confirm vendored or external skills are found.
6. Ask OpenCode to use `obsidian_read` against a known note.
7. Ask OpenCode to use `obsidian_search` against a known term.
8. Ask OpenCode to use `obsidian_create_note` with explicit vault.
9. Ask OpenCode to use `obsidian_append_note` against the created note.
10. Ask OpenCode to use `obsidian_set_property` against the same note.
11. Confirm degraded mode by disabling the CLI and rerunning one CLI-backed tool.
12. Restart OpenCode and verify plugin/tool discovery still works.
```

- [ ] **Step 4: Run full verification**

Run:

```bash
bun test
bun run check
```

Expected:

- tests PASS
- typecheck PASS
- plugin loads in OpenCode
- all seven MVP tools are discoverable
- one normal execution path and one degraded path are manually verified

- [ ] **Step 5: Commit docs and verification assets**

Run:

```bash
git add README.md skills/README.md docs/manual-smoke-test.md
git commit -m "docs: add plugin setup and smoke test guide"
```

### Task 9: Final evidence pass before execution handoff

**Files:**
- Modify as needed: any files touched by verification fixes

- [ ] **Step 1: Run the complete verification suite**

Run:

```bash
bun test
bun run check
```

Expected: both verification commands PASS with no TypeScript errors.

- [ ] **Step 2: Capture the MVP readiness notes**

Record in `docs/mvp-readiness.md` and in the PR summary:

- pasted output of `bun test`,
- pasted output of `bun run check`,
- supported MVP tools,
- bundled vs external skills behavior,
- vault write rules,
- exact plugin-load evidence including OpenCode version and startup log snippet,
- exact tool-discovery evidence listing the 7 registered tool IDs,
- one full success response envelope,
- one full degraded response envelope with `CLI_NOT_FOUND`,
- exact prompts/interactions used for each manual smoke-test step,
- known deferred items (`backlinks`, dev commands, LLM wiki workflows).

- [ ] **Step 3: Commit any final cleanup**

Run:

```bash
git add README.md docs/manual-smoke-test.md docs/mvp-readiness.md package.json tsconfig.json src skills tests
git commit -m "chore: finalize mvp implementation"
```
