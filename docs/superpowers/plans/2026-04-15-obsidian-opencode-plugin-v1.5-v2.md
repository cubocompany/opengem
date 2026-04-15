Now I have a thorough understanding of the codebase style and patterns. Let me produce the implementation plan.

---

# Obsidian OpenCode Plugin — v1.5 & v2.0 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the plugin from MVP (7 tools) to v1.5 (17 tools: backlinks, tags, plugin management, and developer introspection) and v2.0 (24 tools: wiki workflow orchestration plus opt-in JS eval).

**Architecture:** All new tools follow the same envelope pattern as v1: `executeObsidianCli(shell, command, args, meta)`, injectable `shell` for tests, structured `ResultEnvelope<TData | null>`, and new entries in `TOOL_MANIFEST`. Wiki tools compose existing CLI tools rather than calling a new binary command. v2.0 adds a `WikiConfig` sub-config to `PluginConfig` and two new error codes.

---

## File structure

### Create (v1.5)

- `src/tools/backlinks.ts` — `obsidian_backlinks`
- `src/tools/tags.ts` — `obsidian_tags`
- `src/tools/tag-notes.ts` — `obsidian_tag_notes`
- `src/tools/plugin-reload.ts` — `obsidian_plugin_reload`
- `src/tools/plugins.ts` — `obsidian_plugins`
- `src/tools/dev-errors.ts` — `obsidian_dev_errors`
- `src/tools/dev-console.ts` — `obsidian_dev_console`
- `src/tools/dev-screenshot.ts` — `obsidian_dev_screenshot`
- `src/tools/dev-dom.ts` — `obsidian_dev_dom`
- `src/tools/dev-css.ts` — `obsidian_dev_css`
- `tests/tools-v1.5.test.ts` — all v1.5 tool tests

### Create (v2.0)

- `src/lib/wiki.ts` — `resolveWikiPaths`, `buildIndexMarkdown`, `detectBrokenLinks`
- `src/tools/wiki-ingest.ts` — `obsidian_wiki_ingest`
- `src/tools/wiki-update.ts` — `obsidian_wiki_update`
- `src/tools/wiki-refresh-index.ts` — `obsidian_wiki_refresh_index`
- `src/tools/wiki-search-cited.ts` — `obsidian_wiki_search_cited`
- `src/tools/wiki-save-answer.ts` — `obsidian_wiki_save_answer`
- `src/tools/wiki-lint.ts` — `obsidian_wiki_lint`
- `src/tools/eval.ts` — `obsidian_eval`
- `tests/wiki.test.ts` — wiki path helpers and lint logic
- `tests/tools-v2.0.test.ts` — all v2.0 tool tests

### Modify

- `src/lib/types.ts` — add `WIKI_PATH_CONFLICT`, `EVAL_DISABLED` error codes; add `WikiConfig` to `PluginConfig`
- `src/lib/commands.ts` — add 17 new entries to `TOOL_MANIFEST`
- `src/index.ts` — register all new tools
- `tests/tools.test.ts` — extend plugin-registration test to assert all 24 tools

---

## Chunk A — v1.5 read-like tools (backlinks, tags, plugins)

These tools follow the same pattern as `runReadTool` / `runSearchTool`: no vault write requirement, optional vault resolution, structured data payload parsed from stdout.

---

### Task A1: `obsidian_backlinks`

**Files:** Create `src/tools/backlinks.ts` · Modify `tests/tools-v1.5.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/tools-v1.5.test.ts`:

```ts
import { expect, test } from "bun:test"
import { runBacklinksTool } from "../src/tools/backlinks"

const okShell = (stdout = "") => async () => ({ exitCode: 0, stdout, stderr: "" })
const failShell = (stderr = "error") => async () => ({ exitCode: 1, stdout: "", stderr })

test("runBacklinksTool returns backlinks from stdout", async () => {
  const result = await runBacklinksTool({
    shell: okShell("notes/a.md\nnotes/b.md"),
    input: { path: "notes/target.md" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.path).toBe("notes/target.md")
  expect(result.data!.backlinks).toContain("notes/a.md")
})

test("runBacklinksTool passes counts flag when requested", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => {
    captured = cmd
    return { exitCode: 0, stdout: "notes/a.md 3", stderr: "" }
  }

  await runBacklinksTool({ shell, input: { path: "notes/target.md", counts: true } })

  expect(captured).toContain("counts")
})

test("runBacklinksTool requires path", async () => {
  const result = await runBacklinksTool({
    shell: okShell(),
    input: {} as never,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

test("runBacklinksTool returns CLI_NOT_FOUND on exit 127", async () => {
  const result = await runBacklinksTool({
    shell: async () => ({ exitCode: 127, stdout: "", stderr: "not found" }),
    input: { path: "notes/target.md" },
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("CLI_NOT_FOUND")
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun test tests/tools-v1.5.test.ts`
Expected: FAIL — module not found `../src/tools/backlinks`

- [ ] **Step 3: Implement `src/tools/backlinks.ts`**

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type BacklinksData = {
  path: string
  backlinks: string[]
}

export async function runBacklinksTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { path: string; counts?: boolean; vault?: string }
}): Promise<ResultEnvelope<BacklinksData | null>> {
  if (!args.input.path) {
    return errorResult("INVALID_ARGS", "path is required", "Provide path to the note", "obsidian_backlinks", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "backlinks", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? {
          path: args.input.path,
          backlinks: result.stdout.split("\n").map(l => l.trim()).filter(Boolean),
        }
      : null,
  }
}
```

- [ ] **Step 4: Add to `TOOL_MANIFEST` in `src/lib/commands.ts`**

```ts
obsidian_backlinks: {
  label: "List Backlinks",
  description: "List all notes that link to a given note path",
  futureSlashCommand: "obsidian.backlinks",
},
```

- [ ] **Step 5: Register in `src/index.ts`**

Import `runBacklinksTool` and add:

```ts
obsidian_backlinks: tool({
  description: obsidian_backlinks.description,
  args: {
    path: tool.schema.string().describe("Note path relative to vault root"),
    counts: tool.schema.boolean().optional().describe("Include link counts"),
    vault: tool.schema.string().optional().describe("Vault name"),
  },
  async execute(args) {
    return JSON.stringify(await runBacklinksTool({ shell, input: args }))
  },
}),
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `bun test tests/tools-v1.5.test.ts --grep backlinks`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```
git add src/tools/backlinks.ts src/lib/commands.ts src/index.ts tests/tools-v1.5.test.ts
git commit -m "feat: add obsidian_backlinks tool"
```

---

### Task A2: `obsidian_tags` and `obsidian_tag_notes`

**Files:** Create `src/tools/tags.ts` · Create `src/tools/tag-notes.ts` · Modify `tests/tools-v1.5.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v1.5.test.ts`:

```ts
import { runTagsTool } from "../src/tools/tags"
import { runTagNotesTool } from "../src/tools/tag-notes"

test("runTagsTool returns tags list from stdout", async () => {
  const result = await runTagsTool({
    shell: okShell("#project\n#inbox"),
    input: {},
  })

  expect(result.ok).toBe(true)
  expect(result.data!.tags).toContain("#project")
})

test("runTagsTool accepts path to scope to single note", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => {
    captured = cmd
    return { exitCode: 0, stdout: "#note-tag", stderr: "" }
  }

  await runTagsTool({ shell, input: { path: "notes/a.md" } })
  expect(captured.join(" ")).toContain("path=notes/a.md")
})

test("runTagsTool passes sort and counts flags", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  await runTagsTool({ shell, input: { counts: true, sort: "count" } })
  expect(captured).toContain("counts")
  expect(captured.join(" ")).toContain("sort=count")
})

test("runTagNotesTool returns notes for a given tag", async () => {
  const result = await runTagNotesTool({
    shell: okShell("notes/a.md\nnotes/b.md"),
    input: { name: "project" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.tag).toBe("project")
  expect(result.data!.notes).toContain("notes/a.md")
})

test("runTagNotesTool requires name", async () => {
  const result = await runTagNotesTool({
    shell: okShell(),
    input: {} as never,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun test tests/tools-v1.5.test.ts`
Expected: FAIL — module not found for tags and tag-notes

- [ ] **Step 3: Implement `src/tools/tags.ts`**

```ts
import { executeObsidianCli } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type TagsData = { tags: string[] }

export async function runTagsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { path?: string; counts?: boolean; sort?: string; vault?: string }
}): Promise<ResultEnvelope<TagsData | null>> {
  const result = await executeObsidianCli(args.shell, "tags", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { tags: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/tag-notes.ts`**

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type TagNotesData = { tag: string; notes: string[] }

export async function runTagNotesTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { name: string; vault?: string }
}): Promise<ResultEnvelope<TagNotesData | null>> {
  if (!args.input.name) {
    return errorResult("INVALID_ARGS", "name is required", "Provide tag name", "obsidian_tag_notes", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "tag", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? {
          tag: args.input.name,
          notes: result.stdout.split("\n").map(l => l.trim()).filter(Boolean),
        }
      : null,
  }
}
```

- [ ] **Step 5: Add to `TOOL_MANIFEST`**

```ts
obsidian_tags: {
  label: "List Tags",
  description: "List all tags in the vault, or tags on a specific note",
  futureSlashCommand: "obsidian.tags",
},
obsidian_tag_notes: {
  label: "Notes by Tag",
  description: "List all notes that use a specific tag",
  futureSlashCommand: "obsidian.tag.notes",
},
```

- [ ] **Step 6: Register in `src/index.ts`**

```ts
obsidian_tags: tool({
  description: obsidian_tags.description,
  args: {
    path: tool.schema.string().optional().describe("Scope tags to a single note path"),
    counts: tool.schema.boolean().optional().describe("Include usage counts"),
    sort: tool.schema.string().optional().describe("Sort order: count or name"),
    vault: tool.schema.string().optional(),
  },
  async execute(args) {
    return JSON.stringify(await runTagsTool({ shell, input: args }))
  },
}),

obsidian_tag_notes: tool({
  description: obsidian_tag_notes.description,
  args: {
    name: tool.schema.string().describe("Tag name (without leading #)"),
    vault: tool.schema.string().optional(),
  },
  async execute(args) {
    return JSON.stringify(await runTagNotesTool({ shell, input: args }))
  },
}),
```

- [ ] **Step 7: Run tests — verify they pass**

Run: `bun test tests/tools-v1.5.test.ts --grep "runTagsTool|runTagNotesTool"`
Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```
git add src/tools/tags.ts src/tools/tag-notes.ts src/lib/commands.ts src/index.ts tests/tools-v1.5.test.ts
git commit -m "feat: add obsidian_tags and obsidian_tag_notes tools"
```

---

### Task A3: `obsidian_plugins` and `obsidian_plugin_reload`

**Files:** Create `src/tools/plugins.ts` · Create `src/tools/plugin-reload.ts` · Modify `tests/tools-v1.5.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v1.5.test.ts`:

```ts
import { runPluginsTool } from "../src/tools/plugins"
import { runPluginReloadTool } from "../src/tools/plugin-reload"

test("runPluginsTool returns plugin list from stdout", async () => {
  const result = await runPluginsTool({
    shell: okShell("dataview\nTemplater"),
    input: {},
  })

  expect(result.ok).toBe(true)
  expect(result.data!.plugins).toContain("dataview")
})

test("runPluginReloadTool reloads by id", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  const result = await runPluginReloadTool({ shell, input: { id: "dataview" } })

  expect(result.ok).toBe(true)
  expect(result.data!.id).toBe("dataview")
  expect(captured.join(" ")).toContain("plugin:reload")
})

test("runPluginReloadTool requires id", async () => {
  const result = await runPluginReloadTool({
    shell: okShell(),
    input: {} as never,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun test tests/tools-v1.5.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `src/tools/plugins.ts`**

```ts
import { executeObsidianCli } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type PluginsData = { plugins: string[] }

export async function runPluginsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
}): Promise<ResultEnvelope<PluginsData | null>> {
  const result = await executeObsidianCli(args.shell, "plugins", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { plugins: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/plugin-reload.ts`**

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type PluginReloadData = { id: string; reloaded: boolean }

export async function runPluginReloadTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { id: string }
}): Promise<ResultEnvelope<PluginReloadData | null>> {
  if (!args.input.id) {
    return errorResult("INVALID_ARGS", "id is required", "Provide a plugin id", "obsidian_plugin_reload", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "plugin:reload", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok ? { id: args.input.id, reloaded: true } : null,
  }
}
```

- [ ] **Step 5: Add to `TOOL_MANIFEST`, register in `src/index.ts`**

Manifest entries:
```ts
obsidian_plugins: {
  label: "List Plugins",
  description: "List all installed Obsidian plugins",
  futureSlashCommand: "obsidian.plugins",
},
obsidian_plugin_reload: {
  label: "Reload Plugin",
  description: "Reload an Obsidian plugin by ID without restarting the app",
  futureSlashCommand: "obsidian.plugin.reload",
},
```

Tool registrations in `src/index.ts`:
```ts
obsidian_plugins: tool({
  description: obsidian_plugins.description,
  args: { vault: tool.schema.string().optional() },
  async execute(args) {
    return JSON.stringify(await runPluginsTool({ shell, input: args }))
  },
}),

obsidian_plugin_reload: tool({
  description: obsidian_plugin_reload.description,
  args: {
    id: tool.schema.string().describe("Plugin ID as shown in community plugin settings"),
  },
  async execute(args) {
    return JSON.stringify(await runPluginReloadTool({ shell, input: args }))
  },
}),
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `bun test tests/tools-v1.5.test.ts --grep "runPlugins"`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```
git add src/tools/plugins.ts src/tools/plugin-reload.ts src/lib/commands.ts src/index.ts tests/tools-v1.5.test.ts
git commit -m "feat: add obsidian_plugins and obsidian_plugin_reload tools"
```

---

## Chunk B — v1.5 dev tools (errors, console, screenshot, DOM, CSS)

These tools expose the `dev:*` CLI namespace. `obsidian_dev_console` manages capture state plus retrieval in one call via an `action` discriminator. `obsidian_dev_screenshot` writes a PNG inside the vault (write action — vault required). `obsidian_dev_dom` and `obsidian_dev_css` are read-only queries.

---

### Task B1: `obsidian_dev_errors` and `obsidian_dev_console`

**Files:** Create `src/tools/dev-errors.ts` · Create `src/tools/dev-console.ts` · Modify `tests/tools-v1.5.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v1.5.test.ts`:

```ts
import { runDevErrorsTool } from "../src/tools/dev-errors"
import { runDevConsoleTool } from "../src/tools/dev-console"

test("runDevErrorsTool returns errors list from stdout", async () => {
  const result = await runDevErrorsTool({
    shell: okShell("TypeError at plugin.js:12\nReferenceError at main.js:5"),
    input: {},
  })

  expect(result.ok).toBe(true)
  expect(result.data!.errors).toHaveLength(2)
  expect(result.data!.errors[0]).toContain("TypeError")
})

test("runDevErrorsTool returns empty list on clean output", async () => {
  const result = await runDevErrorsTool({ shell: okShell(""), input: {} })

  expect(result.ok).toBe(true)
  expect(result.data!.errors).toHaveLength(0)
})

test("runDevConsoleTool starts debug capture", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  const result = await runDevConsoleTool({ shell, input: { action: "start" } })

  expect(result.ok).toBe(true)
  expect(captured.join(" ")).toContain("dev:debug")
  expect(captured).toContain("on")
})

test("runDevConsoleTool retrieves console output with limit", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "[log] hello", stderr: "" } }

  const result = await runDevConsoleTool({ shell, input: { action: "get", limit: 50 } })

  expect(result.ok).toBe(true)
  expect(result.data!.output).toContain("[log] hello")
  expect(captured.join(" ")).toContain("limit=50")
})

test("runDevConsoleTool stops debug capture", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  await runDevConsoleTool({ shell, input: { action: "stop" } })

  expect(captured).toContain("off")
})

test("runDevConsoleTool rejects unknown action", async () => {
  const result = await runDevConsoleTool({
    shell: okShell(),
    input: { action: "unknown" as never },
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun test tests/tools-v1.5.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `src/tools/dev-errors.ts`**

```ts
import { executeObsidianCli } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevErrorsData = { errors: string[] }

export async function runDevErrorsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
}): Promise<ResultEnvelope<DevErrorsData | null>> {
  const result = await executeObsidianCli(args.shell, "dev:errors", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { errors: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/dev-console.ts`**

The console tool dispatches to different CLI sub-commands based on `action`:
- `start` → `obsidian dev:debug on`
- `stop`  → `obsidian dev:debug off`
- `get`   → `obsidian dev:console [limit=N]`

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevConsoleData = { action: string; output?: string }

export async function runDevConsoleTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { action: "start" | "stop" | "get"; limit?: number }
}): Promise<ResultEnvelope<DevConsoleData | null>> {
  const { action, limit } = args.input

  if (action !== "start" && action !== "stop" && action !== "get") {
    return errorResult("INVALID_ARGS", "action must be start, stop, or get", "Use start, stop, or get", "obsidian_dev_console", args.input, ["cli", "app"], ["cli", "app"])
  }

  if (action === "get") {
    const cliArgs = limit !== undefined ? { limit } : {}
    const result = await executeObsidianCli(args.shell, "dev:console", cliArgs, {
      requiredCapabilities: ["cli", "app"],
      checkedCapabilities: ["cli", "app"],
    })
    return { ...result, data: result.ok ? { action: "get", output: result.stdout } : null }
  }

  // start or stop → dev:debug on/off  (positional, not key=value)
  const onOff = action === "start" ? "on" : "off"
  const shell = args.shell
  const result = await executeObsidianCli(
    async (cmd) => shell([...cmd.slice(0, -1), onOff]),  // inject positional arg
    "dev:debug",
    {},
    { requiredCapabilities: ["cli", "app"], checkedCapabilities: ["cli", "app"] },
  )
  return { ...result, data: result.ok ? { action } : null }
}
```

> **Note on positional args:** `dev:debug on/off` takes a positional argument, not a key=value pair. The wrapper above splices it in after building the argv. If the CLI later changes to `dev:debug state=on`, rewrite to use standard `buildObsidianArgs`.

- [ ] **Step 5: Add to `TOOL_MANIFEST` and register in `src/index.ts`**

Manifest:
```ts
obsidian_dev_errors: {
  label: "Dev: Recent Errors",
  description: "Get recent JavaScript errors from the running Obsidian app",
  futureSlashCommand: "obsidian.dev.errors",
},
obsidian_dev_console: {
  label: "Dev: Console Capture",
  description: "Start/stop debug capture or retrieve console output from the running app",
  futureSlashCommand: "obsidian.dev.console",
},
```

Index registration:
```ts
obsidian_dev_errors: tool({
  description: obsidian_dev_errors.description,
  args: { vault: tool.schema.string().optional() },
  async execute(args) {
    return JSON.stringify(await runDevErrorsTool({ shell, input: args }))
  },
}),

obsidian_dev_console: tool({
  description: obsidian_dev_console.description,
  args: {
    action: tool.schema.enum(["start", "stop", "get"]).describe("start/stop capture or get output"),
    limit: tool.schema.number().optional().describe("Max lines to return (get action only)"),
  },
  async execute(args) {
    return JSON.stringify(await runDevConsoleTool({ shell, input: args }))
  },
}),
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `bun test tests/tools-v1.5.test.ts --grep "runDevErrors|runDevConsole"`
Expected: PASS (6 tests)

- [ ] **Step 7: Commit**

```
git add src/tools/dev-errors.ts src/tools/dev-console.ts src/lib/commands.ts src/index.ts tests/tools-v1.5.test.ts
git commit -m "feat: add obsidian_dev_errors and obsidian_dev_console tools"
```

---

### Task B2: `obsidian_dev_screenshot`

**Files:** Create `src/tools/dev-screenshot.ts` · Modify `tests/tools-v1.5.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v1.5.test.ts`:

```ts
import { runDevScreenshotTool } from "../src/tools/dev-screenshot"

test("runDevScreenshotTool captures screenshot to vault path", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  const result = await runDevScreenshotTool({
    shell,
    input: { path: "shots/home.png", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data!.path).toBe("shots/home.png")
  expect(captured.join(" ")).toContain("path=shots/home.png")
})

test("runDevScreenshotTool requires vault on write", async () => {
  const result = await runDevScreenshotTool({
    shell: okShell(),
    input: { path: "shots/home.png" },
    defaultVault: null,
    activeVault: "Daily",
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runDevScreenshotTool requires path", async () => {
  const result = await runDevScreenshotTool({
    shell: okShell(),
    input: {} as never,
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})
```

- [ ] **Step 2: Run test — verify it fails**

- [ ] **Step 3: Implement `src/tools/dev-screenshot.ts`**

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { ResultEnvelope } from "../lib/types"

type DevScreenshotData = { path: string; vault: string }

export async function runDevScreenshotTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { path: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
}): Promise<ResultEnvelope<DevScreenshotData | null>> {
  if (!args.input.path) {
    return errorResult("INVALID_ARGS", "path is required", "Provide output path inside the vault", "obsidian_dev_screenshot", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_dev_screenshot", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const result = await executeObsidianCli(args.shell, "dev:screenshot", { path: args.input.path, vault }, {
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return {
    ...result,
    data: result.ok ? { path: args.input.path, vault } : null,
  }
}
```

- [ ] **Step 4: Add to manifest and register in index**

Manifest:
```ts
obsidian_dev_screenshot: {
  label: "Dev: Screenshot",
  description: "Capture a screenshot of the running Obsidian app to a vault path (PNG)",
  futureSlashCommand: "obsidian.dev.screenshot",
},
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `bun test tests/tools-v1.5.test.ts --grep "Screenshot"`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```
git add src/tools/dev-screenshot.ts src/lib/commands.ts src/index.ts tests/tools-v1.5.test.ts
git commit -m "feat: add obsidian_dev_screenshot tool"
```

---

### Task B3: `obsidian_dev_dom` and `obsidian_dev_css`

**Files:** Create `src/tools/dev-dom.ts` · Create `src/tools/dev-css.ts` · Modify `tests/tools-v1.5.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v1.5.test.ts`:

```ts
import { runDevDomTool } from "../src/tools/dev-dom"
import { runDevCssTool } from "../src/tools/dev-css"

test("runDevDomTool returns DOM inspection result", async () => {
  const result = await runDevDomTool({
    shell: okShell("My Note Title"),
    input: { selector: ".view-header-title" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.selector).toBe(".view-header-title")
  expect(result.data!.output).toBe("My Note Title")
})

test("runDevDomTool passes mode flags", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "3", stderr: "" } }

  await runDevDomTool({ shell, input: { selector: ".workspace-leaf", mode: "total" } })
  expect(captured.join(" ")).toContain("total")
})

test("runDevDomTool requires selector", async () => {
  const result = await runDevDomTool({
    shell: okShell(),
    input: {} as never,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

test("runDevCssTool returns computed CSS property", async () => {
  const result = await runDevCssTool({
    shell: okShell("16px"),
    input: { selector: ".cm-editor", prop: "font-size" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.selector).toBe(".cm-editor")
  expect(result.data!.output).toBe("16px")
})

test("runDevCssTool requires selector", async () => {
  const result = await runDevCssTool({ shell: okShell(), input: {} as never })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})
```

- [ ] **Step 2: Run test — verify it fails**

- [ ] **Step 3: Implement `src/tools/dev-dom.ts`**

`mode` is a positional/flag argument from a fixed set (`text`, `all`, `total`). `attr=X` and `css=X` use key=value form. The implementation passes `mode` as a plain boolean flag when it is one of the simple modes, or as a key=value pair for `attr` and `css`:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevDomData = { selector: string; output: string }

export async function runDevDomTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: {
    selector: string
    mode?: "text" | "all" | "total" | string  // also accepts attr=X or css=X via dedicated fields
    attr?: string
    css?: string
  }
}): Promise<ResultEnvelope<DevDomData | null>> {
  if (!args.input.selector) {
    return errorResult("INVALID_ARGS", "selector is required", "Provide a CSS selector", "obsidian_dev_dom", args.input, ["cli", "app"], ["cli", "app"])
  }

  const { selector, mode, attr, css, ...rest } = args.input
  const cliArgs: Record<string, unknown> = { selector, ...rest }
  if (mode && ["text", "all", "total"].includes(mode)) cliArgs[mode] = true
  if (attr) cliArgs["attr"] = attr
  if (css) cliArgs["css"] = css

  const result = await executeObsidianCli(args.shell, "dev:dom", cliArgs, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok ? { selector, output: result.stdout } : null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/dev-css.ts`**

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevCssData = { selector: string; prop?: string; output: string }

export async function runDevCssTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { selector: string; prop?: string }
}): Promise<ResultEnvelope<DevCssData | null>> {
  if (!args.input.selector) {
    return errorResult("INVALID_ARGS", "selector is required", "Provide a CSS selector", "obsidian_dev_css", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "dev:css", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok ? { selector: args.input.selector, prop: args.input.prop, output: result.stdout } : null,
  }
}
```

- [ ] **Step 5: Add to manifest and register in index**

Manifest:
```ts
obsidian_dev_dom: {
  label: "Dev: DOM Inspector",
  description: "Inspect DOM elements by CSS selector (text, count, attribute, or computed CSS)",
  futureSlashCommand: "obsidian.dev.dom",
},
obsidian_dev_css: {
  label: "Dev: CSS Inspector",
  description: "Inspect computed CSS properties by CSS selector",
  futureSlashCommand: "obsidian.dev.css",
},
```

Index:
```ts
obsidian_dev_dom: tool({
  description: obsidian_dev_dom.description,
  args: {
    selector: tool.schema.string().describe("CSS selector to target"),
    mode: tool.schema.enum(["text", "all", "total"]).optional(),
    attr: tool.schema.string().optional().describe("Attribute name to read"),
    css: tool.schema.string().optional().describe("CSS property to read"),
  },
  async execute(args) {
    return JSON.stringify(await runDevDomTool({ shell, input: args }))
  },
}),

obsidian_dev_css: tool({
  description: obsidian_dev_css.description,
  args: {
    selector: tool.schema.string().describe("CSS selector"),
    prop: tool.schema.string().optional().describe("Specific CSS property name"),
  },
  async execute(args) {
    return JSON.stringify(await runDevCssTool({ shell, input: args }))
  },
}),
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `bun test tests/tools-v1.5.test.ts`
Expected: PASS (all v1.5 tests)

- [ ] **Step 7: Extend plugin-registration test in `tests/tools.test.ts`**

Update the assertion:
```ts
test("plugin registers all v1.5 tools", async () => {
  const hooks = await ObsidianPlugin({} as never, {})

  const expectedV15 = [
    "obsidian_backlinks", "obsidian_tags", "obsidian_tag_notes",
    "obsidian_plugins", "obsidian_plugin_reload",
    "obsidian_dev_errors", "obsidian_dev_console",
    "obsidian_dev_screenshot", "obsidian_dev_dom", "obsidian_dev_css",
  ]
  for (const id of expectedV15) {
    expect(hooks.tool![id]).toBeDefined()
  }
})
```

- [ ] **Step 8: Commit**

```
git add src/tools/dev-dom.ts src/tools/dev-css.ts src/lib/commands.ts src/index.ts tests/tools-v1.5.test.ts tests/tools.test.ts
git commit -m "feat: add obsidian_dev_dom, obsidian_dev_css tools and v1.5 registration test"
```

---

## Chunk C — v2.0 wiki infrastructure

Before implementing wiki workflow tools, establish the shared path-resolution and markup-generation helpers, the two new error codes, and the `WikiConfig` extension to `PluginConfig`.

---

### Task C1: Extend types and add `WikiConfig`

**Files:** Modify `src/lib/types.ts`

- [ ] **Step 1: Write failing test in `tests/wiki.test.ts`**

```ts
import { expect, test } from "bun:test"
import { resolveWikiPaths, buildIndexMarkdown, detectBrokenLinks } from "../src/lib/wiki"

test("resolveWikiPaths returns canonical paths for all three layers", () => {
  const paths = resolveWikiPaths({ vault: "Main", rawDir: "raw", wikiDir: "wiki", schemaDir: "schema" })

  expect(paths.raw).toBe("raw")
  expect(paths.wiki).toBe("wiki")
  expect(paths.schema).toBe("schema")
  expect(paths.answers).toBe("wiki/answers")
  expect(paths.index).toBe("wiki/INDEX.md")
})

test("resolveWikiPaths uses defaults when dirs omitted", () => {
  const paths = resolveWikiPaths({ vault: "Main" })

  expect(paths.raw).toBe("raw")
  expect(paths.wiki).toBe("wiki")
  expect(paths.schema).toBe("schema")
})

test("buildIndexMarkdown generates sorted wikilink list", () => {
  const md = buildIndexMarkdown(["wiki/beta.md", "wiki/alpha.md", "wiki/gamma.md"])

  const lines = md.split("\n").filter(l => l.startsWith("- [["))
  expect(lines[0]).toContain("alpha")
  expect(lines[1]).toContain("beta")
  expect(lines[2]).toContain("gamma")
})

test("buildIndexMarkdown includes generation timestamp", () => {
  const md = buildIndexMarkdown(["wiki/a.md"])
  expect(md).toContain("generated:")
})

test("detectBrokenLinks finds links not in page list", () => {
  const pages = ["wiki/a.md", "wiki/b.md"]
  const links: Record<string, string[]> = {
    "wiki/a.md": ["[[b]]", "[[missing]]"],
    "wiki/b.md": ["[[a]]"],
  }

  const broken = detectBrokenLinks(pages, links)
  expect(broken).toHaveLength(1)
  expect(broken[0].source).toBe("wiki/a.md")
  expect(broken[0].link).toBe("[[missing]]")
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun test tests/wiki.test.ts`
Expected: FAIL — module not found `../src/lib/wiki`

- [ ] **Step 3: Add error codes and `WikiConfig` to `src/lib/types.ts`**

Append to `CommandErrorCode` union:
```ts
  | "WIKI_PATH_CONFLICT"
  | "EVAL_DISABLED"
```

Add `WikiConfig` type and extend `PluginConfig`:
```ts
export type WikiConfig = {
  rawDir: string
  wikiDir: string
  schemaDir: string
}

// In PluginConfig, add:
//   wiki: WikiConfig
```

Updated `PluginConfig`:
```ts
export type PluginConfig = {
  defaultVault: string | null
  skills: { mode: SkillsMode; externalPath: string | null; syncDirName: string }
  wiki: WikiConfig
}
```

- [ ] **Step 4: Update `resolvePluginConfig` in `src/lib/config.ts`** to add `wiki` defaults:

```ts
wiki: {
  rawDir: input.wiki?.rawDir ?? "raw",
  wikiDir: input.wiki?.wikiDir ?? "wiki",
  schemaDir: input.wiki?.schemaDir ?? "schema",
},
```

- [ ] **Step 5: Implement `src/lib/wiki.ts`**

```ts
export type WikiPaths = {
  vault: string
  raw: string
  wiki: string
  schema: string
  answers: string
  index: string
}

export function resolveWikiPaths(args: {
  vault: string
  rawDir?: string
  wikiDir?: string
  schemaDir?: string
}): WikiPaths {
  const raw = args.rawDir ?? "raw"
  const wiki = args.wikiDir ?? "wiki"
  const schema = args.schemaDir ?? "schema"

  return {
    vault: args.vault,
    raw,
    wiki,
    schema,
    answers: `${wiki}/answers`,
    index: `${wiki}/INDEX.md`,
  }
}

export function buildIndexMarkdown(pages: string[]): string {
  const sorted = [...pages].sort()
  const now = new Date().toISOString()
  const links = sorted
    .map(p => {
      const name = p.replace(/^wiki\//, "").replace(/\.md$/, "")
      return `- [[${name}]]`
    })
    .join("\n")

  return `# Wiki Index\n\n> generated: ${now}\n\n${links}\n`
}

export type BrokenLink = { source: string; link: string }

export function detectBrokenLinks(
  pages: string[],
  links: Record<string, string[]>,
): BrokenLink[] {
  const pageNames = new Set(
    pages.map(p => p.replace(/^wiki\//, "").replace(/\.md$/, ""))
  )

  const broken: BrokenLink[] = []
  for (const [source, sourceLinks] of Object.entries(links)) {
    for (const link of sourceLinks) {
      const name = link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim()
      if (!pageNames.has(name)) {
        broken.push({ source, link })
      }
    }
  }
  return broken
}
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `bun test tests/wiki.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```
git add src/lib/types.ts src/lib/config.ts src/lib/wiki.ts tests/wiki.test.ts
git commit -m "feat: add WikiConfig, wiki path helpers, and index/lint utilities"
```

---

## Chunk D — v2.0 wiki workflow tools and obsidian_eval

---

### Task D1: `obsidian_wiki_ingest` and `obsidian_wiki_update`

**Files:** Create `src/tools/wiki-ingest.ts` · Create `src/tools/wiki-update.ts` · Create `tests/tools-v2.0.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts`

- [ ] **Step 1: Write failing tests**

Write `tests/tools-v2.0.test.ts`:

```ts
import { expect, test } from "bun:test"
import { runWikiIngestTool } from "../src/tools/wiki-ingest"
import { runWikiUpdateTool } from "../src/tools/wiki-update"

const okShell = (stdout = "") => async () => ({ exitCode: 0, stdout, stderr: "" })
const failShell = (stderr = "error") => async () => ({ exitCode: 1, stdout: "", stderr })

test("runWikiIngestTool creates raw note and wiki page", async () => {
  const calls: string[][] = []
  const shell = async (cmd: string[]) => { calls.push(cmd); return { exitCode: 0, stdout: "", stderr: "" } }

  const result = await runWikiIngestTool({
    shell,
    input: {
      sourceName: "article",
      sourceContent: "# Source content",
      wikiContent: "# Wiki summary",
      vault: "Main",
    },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.rawPath).toContain("raw/")
  expect(result.data!.wikiPath).toContain("wiki/")
  // Expect at least two CLI calls: one create for raw/, one create for wiki/
  expect(calls.length).toBeGreaterThanOrEqual(2)
})

test("runWikiIngestTool requires vault", async () => {
  const result = await runWikiIngestTool({
    shell: okShell(),
    input: { sourceName: "art", sourceContent: "x", wikiContent: "y" },
    defaultVault: null,
    activeVault: "Daily",
    wikiPaths: { vault: "", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runWikiUpdateTool creates or updates a wiki page", async () => {
  let lastCall: string[] = []
  const shell = async (cmd: string[]) => { lastCall = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  const result = await runWikiUpdateTool({
    shell,
    input: { pageName: "TypeScript", content: "# TypeScript\n...", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.path).toContain("wiki/TypeScript")
  expect(lastCall.join(" ")).toContain("wiki/TypeScript")
})

test("runWikiUpdateTool requires pageName", async () => {
  const result = await runWikiUpdateTool({
    shell: okShell(),
    input: { pageName: "", content: "x", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `bun test tests/tools-v2.0.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Implement `src/tools/wiki-ingest.ts`**

`wiki_ingest` orchestrates two `create` CLI calls: one into `raw/`, one into `wiki/`. Both require write access. It delegates to `executeObsidianCli` directly rather than calling `runCreateNoteTool` to avoid double vault resolution:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiIngestData = {
  rawPath: string
  wikiPath: string
  vault: string
}

export async function runWikiIngestTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { sourceName: string; sourceContent: string; wikiContent: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiIngestData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_ingest", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const { raw, wiki } = args.wikiPaths
  const rawName = `${raw}/${args.input.sourceName}`
  const wikiName = `${wiki}/${args.input.sourceName}`

  const rawResult = await executeObsidianCli(
    args.shell, "create",
    { name: rawName, content: args.input.sourceContent, vault, silent: true, overwrite: false },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )
  if (!rawResult.ok) return { ...rawResult, data: null }

  const wikiResult = await executeObsidianCli(
    args.shell, "create",
    { name: wikiName, content: args.input.wikiContent, vault, silent: true, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  return {
    ...wikiResult,
    data: wikiResult.ok ? { rawPath: rawName, wikiPath: wikiName, vault } : null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/wiki-update.ts`**

`wiki_update` maps to a `create --overwrite` call into `wiki/`:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiUpdateData = { path: string; vault: string; updated: boolean }

export async function runWikiUpdateTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { pageName: string; content: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiUpdateData | null>> {
  if (!args.input.pageName) {
    return errorResult("INVALID_ARGS", "pageName is required", "Provide a wiki page name", "obsidian_wiki_update", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_update", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const path = `${args.wikiPaths.wiki}/${args.input.pageName}`
  const result = await executeObsidianCli(
    args.shell, "create",
    { name: path, content: args.input.content, vault, silent: true, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  return { ...result, data: result.ok ? { path, vault, updated: true } : null }
}
```

- [ ] **Step 5: Add to `TOOL_MANIFEST` and register in `src/index.ts`**

Manifest:
```ts
obsidian_wiki_ingest: {
  label: "Wiki: Ingest Source",
  description: "Copy a source document into raw/ and create or update its wiki/ page",
  futureSlashCommand: "obsidian.wiki.ingest",
},
obsidian_wiki_update: {
  label: "Wiki: Update Page",
  description: "Create or overwrite a wiki/ knowledge page",
  futureSlashCommand: "obsidian.wiki.update",
},
```

In `src/index.ts`, resolve `wikiPaths` inside the plugin factory using `resolveWikiPaths`:
```ts
import { resolveWikiPaths } from "./lib/wiki"
// inside ObsidianPlugin factory:
const wikiPaths = resolveWikiPaths({
  vault: config.defaultVault ?? "",
  rawDir: config.wiki.rawDir,
  wikiDir: config.wiki.wikiDir,
  schemaDir: config.wiki.schemaDir,
})
```

Tool registration pattern (both ingest and update follow the same shape):
```ts
obsidian_wiki_ingest: tool({
  description: obsidian_wiki_ingest.description,
  args: {
    sourceName: tool.schema.string().describe("Source document name (becomes raw/<name> and wiki/<name>)"),
    sourceContent: tool.schema.string().describe("Raw source content (immutable)"),
    wikiContent: tool.schema.string().describe("Wiki summary/knowledge content"),
    vault: tool.schema.string().optional(),
  },
  async execute(args) {
    return JSON.stringify(await runWikiIngestTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
  },
}),
```

- [ ] **Step 6: Run tests — verify they pass**

Run: `bun test tests/tools-v2.0.test.ts --grep "Ingest|Update"`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```
git add src/tools/wiki-ingest.ts src/tools/wiki-update.ts src/lib/commands.ts src/index.ts tests/tools-v2.0.test.ts
git commit -m "feat: add obsidian_wiki_ingest and obsidian_wiki_update tools"
```

---

### Task D2: `obsidian_wiki_refresh_index`, `obsidian_wiki_search_cited`, `obsidian_wiki_save_answer`

**Files:** Create `src/tools/wiki-refresh-index.ts` · Create `src/tools/wiki-search-cited.ts` · Create `src/tools/wiki-save-answer.ts` · Modify `tests/tools-v2.0.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v2.0.test.ts`:

```ts
import { runWikiRefreshIndexTool } from "../src/tools/wiki-refresh-index"
import { runWikiSearchCitedTool } from "../src/tools/wiki-search-cited"
import { runWikiSaveAnswerTool } from "../src/tools/wiki-save-answer"

test("runWikiRefreshIndexTool writes INDEX.md from search results", async () => {
  let lastCreateCall: string[] = []
  const shell = async (cmd: string[]) => {
    if (cmd.includes("search")) return { exitCode: 0, stdout: "wiki/alpha.md\nwiki/beta.md", stderr: "" }
    lastCreateCall = cmd
    return { exitCode: 0, stdout: "", stderr: "" }
  }

  const result = await runWikiRefreshIndexTool({
    shell,
    input: { vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.pageCount).toBe(2)
  expect(lastCreateCall.join(" ")).toContain("wiki/INDEX.md")
})

test("runWikiSearchCitedTool returns results with citation prefix", async () => {
  const result = await runWikiSearchCitedTool({
    shell: okShell("wiki/alpha.md\n> excerpt line"),
    input: { query: "typescript", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.query).toBe("typescript")
  expect(result.data!.results).toContain("wiki/alpha.md")
})

test("runWikiSaveAnswerTool writes to wiki/answers/", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }

  const result = await runWikiSaveAnswerTool({
    shell,
    input: { question: "What is Bun?", answer: "Bun is a JS runtime.", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.path).toContain("wiki/answers/")
  expect(captured.join(" ")).toContain("wiki/answers/")
})
```

- [ ] **Step 2: Run test — verify it fails**

- [ ] **Step 3: Implement `src/tools/wiki-refresh-index.ts`**

This tool: (1) runs `obsidian search` scoped to `wiki/`, (2) calls `buildIndexMarkdown`, (3) writes the result with `obsidian create --overwrite` to the index path:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { buildIndexMarkdown, type WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiRefreshIndexData = { indexPath: string; pageCount: number; vault: string }

export async function runWikiRefreshIndexTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiRefreshIndexData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_refresh_index", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const searchResult = await executeObsidianCli(
    args.shell, "search",
    { query: `path:${args.wikiPaths.wiki}`, vault },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )
  if (!searchResult.ok) return { ...searchResult, data: null }

  const pages = searchResult.stdout.split("\n").map(l => l.trim()).filter(Boolean)
  const indexContent = buildIndexMarkdown(pages)

  const writeResult = await executeObsidianCli(
    args.shell, "create",
    { name: args.wikiPaths.index, content: indexContent, vault, silent: true, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  return {
    ...writeResult,
    data: writeResult.ok ? { indexPath: args.wikiPaths.index, pageCount: pages.length, vault } : null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/wiki-search-cited.ts`**

Wraps `obsidian search`, prefixes results with citation markers:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiSearchCitedData = { query: string; results: string }

export async function runWikiSearchCitedTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { query: string; limit?: number; vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiSearchCitedData | null>> {
  if (!args.input.query) {
    return errorResult("INVALID_ARGS", "query is required", "Provide a search query", "obsidian_wiki_search_cited", args.input, ["cli", "app"], ["cli", "app"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  const scopedQuery = `path:${args.wikiPaths.wiki} ${args.input.query}`
  const cliArgs = { query: scopedQuery, ...(args.input.limit ? { limit: args.input.limit } : {}), ...(vault ? { vault } : {}) }

  const result = await executeObsidianCli(args.shell, "search", cliArgs, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok ? { query: args.input.query, results: result.stdout } : null,
  }
}
```

- [ ] **Step 5: Implement `src/tools/wiki-save-answer.ts`**

Derives a slug from the question and creates under `wiki/answers/`:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiSaveAnswerData = { path: string; vault: string }

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

export async function runWikiSaveAnswerTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { question: string; answer: string; vault?: string; tags?: string[] }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiSaveAnswerData | null>> {
  if (!args.input.question) {
    return errorResult("INVALID_ARGS", "question is required", "Provide a question", "obsidian_wiki_save_answer", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_save_answer", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const slug = slugify(args.input.question)
  const path = `${args.wikiPaths.answers}/${slug}`
  const tags = args.input.tags?.length ? `\ntags: [${args.input.tags.join(", ")}]` : ""
  const content = `---\nquestion: "${args.input.question}"${tags}\n---\n\n${args.input.answer}\n`

  const result = await executeObsidianCli(
    args.shell, "create",
    { name: path, content, vault, silent: true, overwrite: false },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  return { ...result, data: result.ok ? { path, vault } : null }
}
```

- [ ] **Step 6: Add to manifest and register in index** (follow same pattern as D1)

- [ ] **Step 7: Run tests — verify they pass**

Run: `bun test tests/tools-v2.0.test.ts --grep "Index|Cited|Answer"`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```
git add src/tools/wiki-refresh-index.ts src/tools/wiki-search-cited.ts src/tools/wiki-save-answer.ts src/lib/commands.ts src/index.ts tests/tools-v2.0.test.ts
git commit -m "feat: add obsidian_wiki_refresh_index, wiki_search_cited, wiki_save_answer"
```

---

### Task D3: `obsidian_wiki_lint` and `obsidian_eval`

**Files:** Create `src/tools/wiki-lint.ts` · Create `src/tools/eval.ts` · Modify `tests/tools-v2.0.test.ts` · Modify `src/lib/commands.ts` · Modify `src/index.ts` · Modify `tests/tools.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `tests/tools-v2.0.test.ts`:

```ts
import { runWikiLintTool } from "../src/tools/wiki-lint"
import { runEvalTool } from "../src/tools/eval"

test("runWikiLintTool reports broken links from search-derived data", async () => {
  // Shell always returns ok — lint logic is driven by the stub readLinks
  const result = await runWikiLintTool({
    shell: okShell("wiki/a.md\nwiki/b.md"),
    input: { vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
    readLinks: async () => ({
      "wiki/a.md": ["[[b]]", "[[missing-page]]"],
      "wiki/b.md": ["[[a]]"],
    }),
  })

  expect(result.ok).toBe(true) // lint result is always ok=true (it is a report)
  expect(result.data!.brokenLinks).toHaveLength(1)
  expect(result.data!.brokenLinks[0].link).toBe("[[missing-page]]")
  expect(result.data!.orphanPages).toHaveLength(0)
})

test("runWikiLintTool detects orphan pages (not in index)", async () => {
  const result = await runWikiLintTool({
    shell: okShell("wiki/a.md\nwiki/b.md"),
    input: { vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths: { vault: "Main", raw: "raw", wiki: "wiki", schema: "schema", answers: "wiki/answers", index: "wiki/INDEX.md" },
    readLinks: async () => ({}),
    readIndex: async () => "- [[a]]\n", // only a is indexed; b is orphan
  })

  expect(result.data!.orphanPages).toContain("wiki/b.md")
})

test("runEvalTool executes JS and returns stdout", async () => {
  const result = await runEvalTool({
    shell: okShell("42"),
    input: { code: "return 40 + 2" },
    evalEnabled: true,
  })

  expect(result.ok).toBe(true)
  expect(result.data!.result).toBe("42")
})

test("runEvalTool returns EVAL_DISABLED when not opted in", async () => {
  const result = await runEvalTool({
    shell: okShell(),
    input: { code: "return 1" },
    evalEnabled: false,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("EVAL_DISABLED")
})
```

- [ ] **Step 2: Run test — verify it fails**

- [ ] **Step 3: Implement `src/tools/wiki-lint.ts`**

`wiki_lint` is a pure reporting tool (always returns `ok: true`). It accepts injectable `readLinks` and `readIndex` for testing:

```ts
import { executeObsidianCli } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { detectBrokenLinks, type WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiLintData = {
  pageCount: number
  brokenLinks: Array<{ source: string; link: string }>
  orphanPages: string[]
  missingIndexEntries: string[]
}

export async function runWikiLintTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
  readLinks?: () => Promise<Record<string, string[]>>
  readIndex?: () => Promise<string>
}): Promise<ResultEnvelope<WikiLintData>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  const searchResult = await executeObsidianCli(
    args.shell, "search",
    { query: `path:${args.wikiPaths.wiki}`, ...(vault ? { vault } : {}) },
    { requiredCapabilities: ["cli", "app"], checkedCapabilities: ["cli", "app"] },
  )

  const pages = searchResult.ok
    ? searchResult.stdout.split("\n").map(l => l.trim()).filter(Boolean)
    : []

  const links = args.readLinks ? await args.readLinks() : {}
  const indexContent = args.readIndex ? await args.readIndex() : ""

  const brokenLinks = detectBrokenLinks(pages, links)

  // Orphans: pages not mentioned in the index
  const indexedNames = new Set(
    (indexContent.match(/\[\[([^\]]+)\]\]/g) ?? []).map(l => l.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim())
  )
  const orphanPages = pages.filter(p => {
    const name = p.replace(/^wiki\//, "").replace(/\.md$/, "")
    return !indexedNames.has(name)
  })

  // Missing index entries: pages in index not found in search results
  const pageNames = new Set(pages.map(p => p.replace(/^wiki\//, "").replace(/\.md$/, "")))
  const missingIndexEntries = [...indexedNames].filter(n => !pageNames.has(n))

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_wiki_lint",
    args: args.input,
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
    data: { pageCount: pages.length, brokenLinks, orphanPages, missingIndexEntries },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: brokenLinks.length > 0 || orphanPages.length > 0 ? "Run obsidian_wiki_refresh_index to fix index issues" : null,
    error: null,
  }
}
```

- [ ] **Step 4: Implement `src/tools/eval.ts`**

`obsidian_eval` is gated behind an explicit `evalEnabled` flag to avoid accidental code execution:

```ts
import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type EvalData = { result: string }

export async function runEvalTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { code: string }
  evalEnabled: boolean
}): Promise<ResultEnvelope<EvalData | null>> {
  if (!args.evalEnabled) {
    return errorResult("EVAL_DISABLED", "obsidian_eval is disabled", "Set evalEnabled: true in plugin config to opt in", "obsidian_eval", args.input, ["cli", "app"], [])
  }

  if (!args.input.code) {
    return errorResult("INVALID_ARGS", "code is required", "Provide JavaScript code to evaluate", "obsidian_eval", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "eval", { code: args.input.code }, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok ? { result: result.stdout } : null,
  }
}
```

- [ ] **Step 5: Add `evalEnabled` to `PluginConfig` and update `resolvePluginConfig`**

In `src/lib/types.ts`:
```ts
// In PluginConfig:
evalEnabled: boolean
```

In `src/lib/config.ts`:
```ts
evalEnabled: input.evalEnabled ?? false,
```

- [ ] **Step 6: Add to manifest and register in index**

Manifest:
```ts
obsidian_wiki_lint: {
  label: "Wiki: Health Check",
  description: "Detect broken wikilinks, orphan pages, and missing index entries in wiki/",
  futureSlashCommand: "obsidian.wiki.lint",
},
obsidian_eval: {
  label: "Eval (opt-in)",
  description: "Execute JavaScript in the Obsidian app context. Requires evalEnabled in plugin config.",
  futureSlashCommand: "obsidian.eval",
},
```

In `src/index.ts`, `obsidian_eval` registration reads `config.evalEnabled` and passes it through.

- [ ] **Step 7: Extend plugin-registration test in `tests/tools.test.ts`**

```ts
test("plugin registers all v2.0 tools", async () => {
  const hooks = await ObsidianPlugin({} as never, {})

  const expectedV20 = [
    "obsidian_wiki_ingest", "obsidian_wiki_update",
    "obsidian_wiki_refresh_index", "obsidian_wiki_search_cited",
    "obsidian_wiki_save_answer", "obsidian_wiki_lint",
    "obsidian_eval",
  ]
  for (const id of expectedV20) {
    expect(hooks.tool![id]).toBeDefined()
  }
})
```

- [ ] **Step 8: Run all tests**

Run: `bun test`
Expected: PASS (all tests across all test files)

- [ ] **Step 9: Commit**

```
git add src/tools/wiki-lint.ts src/tools/eval.ts src/lib/types.ts src/lib/config.ts src/lib/commands.ts src/index.ts tests/tools-v2.0.test.ts tests/tools.test.ts
git commit -m "feat: add obsidian_wiki_lint and obsidian_eval, complete v2.0 tool set"
```

---

## Implementation order summary

```
Chunk A (v1.5 read-like)
  A1  obsidian_backlinks
  A2  obsidian_tags + obsidian_tag_notes
  A3  obsidian_plugins + obsidian_plugin_reload

Chunk B (v1.5 dev tools)
  B1  obsidian_dev_errors + obsidian_dev_console
  B2  obsidian_dev_screenshot
  B3  obsidian_dev_dom + obsidian_dev_css
      ↳ update plugin-registration test for v1.5

Chunk C (v2.0 infrastructure)
  C1  WikiConfig + wiki.ts helpers + extend types.ts + config.ts

Chunk D (v2.0 wiki workflow)
  D1  obsidian_wiki_ingest + obsidian_wiki_update
  D2  obsidian_wiki_refresh_index + wiki_search_cited + wiki_save_answer
  D3  obsidian_wiki_lint + obsidian_eval + evalEnabled flag
      ↳ update plugin-registration test for v2.0
      ↳ bun test (full suite green)
```

---

## Key invariants to enforce throughout

- Every tool file exports exactly one `run*Tool` function with injectable `shell`.
- `executeObsidianCli` is the only place that calls `shell`; no tool calls `shell` directly.
- Tools that take a `WikiPaths` argument receive it from the plugin factory (index.ts) — never re-resolve it inside the tool function.
- `obsidian_eval` must never be registered unless `config.evalEnabled === true` (or register it but always return `EVAL_DISABLED` when disabled — the current design).
- `obsidian_wiki_lint` always returns `ok: true`; it is a report, not a capability check.
- `WIKI_PATH_CONFLICT` and `EVAL_DISABLED` must appear in the `CommandErrorCode` union in `types.ts` before any tool that uses them is committed.

---

### Critical Files for Implementation

- `/d/Projects/obsidian-opencode-plugin/src/lib/types.ts`
- `/d/Projects/obsidian-opencode-plugin/src/lib/commands.ts`
- `/d/Projects/obsidian-opencode-plugin/src/index.ts`
- `/d/Projects/obsidian-opencode-plugin/src/lib/cli.ts`
- `/d/Projects/obsidian-opencode-plugin/src/tools/read.ts`