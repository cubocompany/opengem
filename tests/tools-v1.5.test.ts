import { expect, test } from "bun:test"
import { runBacklinksTool } from "../src/tools/backlinks"
import { runTagsTool } from "../src/tools/tags"
import { runTagNotesTool } from "../src/tools/tag-notes"
import { runPluginsTool } from "../src/tools/plugins"
import { runPluginReloadTool } from "../src/tools/plugin-reload"
import { runDevErrorsTool } from "../src/tools/dev-errors"
import { runDevConsoleTool } from "../src/tools/dev-console"
import { runDevScreenshotTool } from "../src/tools/dev-screenshot"
import { runDevDomTool } from "../src/tools/dev-dom"
import { runDevCssTool } from "../src/tools/dev-css"

const okShell = (stdout = "") => async () => ({ exitCode: 0, stdout, stderr: "" })

// --- backlinks ---

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
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "notes/a.md 3", stderr: "" } }
  await runBacklinksTool({ shell, input: { path: "notes/target.md", counts: true } })
  expect(captured).toContain("counts")
})

test("runBacklinksTool requires path", async () => {
  const result = await runBacklinksTool({ shell: okShell(), input: {} as never })
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

// --- tags ---

test("runTagsTool returns tags list from stdout", async () => {
  const result = await runTagsTool({ shell: okShell("#project\n#inbox"), input: {} })
  expect(result.ok).toBe(true)
  expect(result.data!.tags).toContain("#project")
})

test("runTagsTool accepts path to scope to single note", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "#note-tag", stderr: "" } }
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

// --- tag-notes ---

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
  const result = await runTagNotesTool({ shell: okShell(), input: {} as never })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

// --- plugins ---

test("runPluginsTool returns plugin list from stdout", async () => {
  const result = await runPluginsTool({ shell: okShell("dataview\nTemplater"), input: {} })
  expect(result.ok).toBe(true)
  expect(result.data!.plugins).toContain("dataview")
})

// --- plugin-reload ---

test("runPluginReloadTool reloads by id", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }
  const result = await runPluginReloadTool({ shell, input: { id: "dataview" } })
  expect(result.ok).toBe(true)
  expect(result.data!.id).toBe("dataview")
  expect(captured.join(" ")).toContain("plugin:reload")
})

test("runPluginReloadTool requires id", async () => {
  const result = await runPluginReloadTool({ shell: okShell(), input: {} as never })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

// --- dev-errors ---

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

// --- dev-console ---

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
  const result = await runDevConsoleTool({ shell: okShell(), input: { action: "unknown" as never } })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

// --- dev-screenshot ---

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

// --- dev-dom ---

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
  const result = await runDevDomTool({ shell: okShell(), input: {} as never })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

// --- dev-css ---

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
