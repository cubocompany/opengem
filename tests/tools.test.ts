import { expect, test } from "bun:test"
import { runEnvDoctor } from "../src/tools/env-doctor"
import { runSkillsCheck } from "../src/tools/skills-check"
import { runReadTool } from "../src/tools/read"
import { runSearchTool } from "../src/tools/search"
import { runCreateNoteTool } from "../src/tools/create-note"
import { runAppendNoteTool } from "../src/tools/append-note"
import { runSetPropertyTool } from "../src/tools/set-property"
import { OpenGemPlugin } from "../src/index"

const okShell = (stdout = "") => async () => ({ exitCode: 0, stdout, stderr: "" })
const failShell = (stderr = "error") => async () => ({ exitCode: 1, stdout: "", stderr })

// --- env-doctor ---

test("runEnvDoctor returns structured capabilities", async () => {
  const result = await runEnvDoctor({
    detectCli: async () => true,
    detectApp: async () => true,
    detectSkills: async () => ({ mode: "bundled", path: "/tmp/skills", inSync: true }),
    defaultVault: "Main",
  })

  expect(result.ok).toBe(true)
  expect(result.data.cliInstalled).toBe(true)
  expect(result.data.appRunning).toBe(true)
  expect(result.data.defaultVault).toBe("Main")
  expect(result.data.skills.inSync).toBe(true)
  expect(result.schemaVersion).toBe("1.0")
})

test("runEnvDoctor reports missing CLI without failing the call", async () => {
  const result = await runEnvDoctor({
    detectCli: async () => false,
    detectApp: async () => false,
    detectSkills: async () => ({ mode: "external", path: "/tmp/skills", inSync: false }),
    defaultVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data.cliInstalled).toBe(false)
  expect(result.data.appRunning).toBe(false)
  expect(result.data.defaultVault).toBeNull()
  expect(result.data.skills.inSync).toBe(false)
})

// --- skills-check ---

test("runSkillsCheck returns found and empty missing list when all present", async () => {
  const result = await runSkillsCheck({
    mode: "external",
    skillsPath: "/tmp/skills",
    requiredSkills: ["obsidian-markdown", "obsidian-cli"],
    exists: () => true,
  })

  expect(result.ok).toBe(true)
  expect(result.data.found).toEqual(["obsidian-markdown", "obsidian-cli"])
  expect(result.data.missing).toHaveLength(0)
  expect(result.data.skillsPath).toBe("/tmp/skills")
})

test("runSkillsCheck returns missing list when skills are absent", async () => {
  const result = await runSkillsCheck({
    mode: "external",
    skillsPath: "/tmp/skills",
    requiredSkills: ["obsidian-markdown", "missing-skill"],
    exists: (p) => !p.includes("missing-skill"),
  })

  expect(result.ok).toBe(false)
  expect(result.data.missing).toContain("missing-skill")
  expect(result.data.found).toContain("obsidian-markdown")
  expect(result.error?.code).toBe("BUNDLED_SKILLS_OUT_OF_SYNC")
})

test("runSkillsCheck includes mode and schemaVersion in envelope", async () => {
  const result = await runSkillsCheck({
    mode: "bundled",
    skillsPath: "/tmp/bundled",
    requiredSkills: ["obsidian-cli"],
    exists: () => true,
  })

  expect(result.schemaVersion).toBe("1.0")
  expect(result.data.mode).toBe("bundled")
})

// --- read ---

test("runReadTool returns content in data payload", async () => {
  const result = await runReadTool({
    shell: okShell("# Hello"),
    input: { file: "My Note", vault: "Main" },
  })

  expect(result.ok).toBe(true)
  expect(result.data!.content).toBe("# Hello")
  expect(result.data!.target.file).toBe("My Note")
})

test("runReadTool rejects file and path together", async () => {
  const result = await runReadTool({
    shell: okShell(),
    input: { file: "A", path: "a.md" },
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("MUTUALLY_EXCLUSIVE_TARGET")
})

test("runReadTool requires file or path", async () => {
  const result = await runReadTool({
    shell: okShell(),
    input: {},
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("FILE_OR_PATH_REQUIRED")
})

// --- search ---

test("runSearchTool uses read vault resolution", async () => {
  const result = await runSearchTool({
    shell: okShell("hit"),
    input: { query: "term" },
    defaultVault: null,
    activeVault: "Daily",
  })

  expect(result.ok).toBe(true)
  expect(result.args.vault).toBe("Daily")
})

test("runSearchTool returns query in data", async () => {
  const result = await runSearchTool({
    shell: okShell("results"),
    input: { query: "obsidian", limit: 5 },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data!.query).toBe("obsidian")
  expect(result.data!.results).toBe("results")
})

// --- create-note ---

test("runCreateNoteTool rejects missing vault on write", async () => {
  const result = await runCreateNoteTool({
    shell: okShell(),
    input: { name: "New Note", content: "# x" },
    defaultVault: null,
    activeVault: "Daily",
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runCreateNoteTool succeeds with default vault", async () => {
  const result = await runCreateNoteTool({
    shell: okShell(),
    input: { name: "New Note", content: "# Hello" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data!.name).toBe("New Note")
  expect(result.data!.created).toBe(true)
})

// --- append-note ---

test("runAppendNoteTool validates note target", async () => {
  const result = await runAppendNoteTool({
    shell: okShell(),
    input: { content: "x", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("FILE_OR_PATH_REQUIRED")
})

test("runAppendNoteTool rejects missing vault", async () => {
  const result = await runAppendNoteTool({
    shell: okShell(),
    input: { file: "My Note", content: "x" },
    defaultVault: null,
    activeVault: "Daily",
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runAppendNoteTool succeeds with valid args", async () => {
  const result = await runAppendNoteTool({
    shell: okShell(),
    input: { file: "My Note", content: "new line" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data!.appended).toBe(true)
  expect(result.data!.target.file).toBe("My Note")
})

// --- set-property ---

test("runSetPropertyTool returns structured property payload", async () => {
  const result = await runSetPropertyTool({
    shell: okShell(),
    input: { name: "status", value: "done", file: "My Note", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(true)
  expect(result.data!.property).toBe("status")
  expect(result.data!.value).toBe("done")
  expect(result.data!.updated).toBe(true)
})

test("runSetPropertyTool rejects missing vault", async () => {
  const result = await runSetPropertyTool({
    shell: okShell(),
    input: { name: "status", value: "done", file: "My Note" },
    defaultVault: null,
    activeVault: "Daily",
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runSetPropertyTool rejects missing target", async () => {
  const result = await runSetPropertyTool({
    shell: okShell(),
    input: { name: "status", value: "done", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("FILE_OR_PATH_REQUIRED")
})

// --- plugin registration ---

test("plugin registers all MVP tools", async () => {
  const hooks = await OpenGemPlugin({} as never, {})

  expect(hooks.tool).toBeDefined()
  expect(hooks.tool!.obsidian_read).toBeDefined()
  expect(hooks.tool!.obsidian_search).toBeDefined()
  expect(hooks.tool!.obsidian_create_note).toBeDefined()
  expect(hooks.tool!.obsidian_append_note).toBeDefined()
  expect(hooks.tool!.obsidian_set_property).toBeDefined()
  expect(hooks.tool!.obsidian_skills_check).toBeDefined()
  expect(hooks.tool!.obsidian_env_doctor).toBeDefined()
})

test("plugin registers all v1.5 tools", async () => {
  const hooks = await OpenGemPlugin({} as never, {})

  expect(hooks.tool!.obsidian_backlinks).toBeDefined()
  expect(hooks.tool!.obsidian_tags).toBeDefined()
  expect(hooks.tool!.obsidian_tag_notes).toBeDefined()
  expect(hooks.tool!.obsidian_plugins).toBeDefined()
  expect(hooks.tool!.obsidian_plugin_reload).toBeDefined()
  expect(hooks.tool!.obsidian_dev_errors).toBeDefined()
  expect(hooks.tool!.obsidian_dev_console).toBeDefined()
  expect(hooks.tool!.obsidian_dev_screenshot).toBeDefined()
  expect(hooks.tool!.obsidian_dev_dom).toBeDefined()
  expect(hooks.tool!.obsidian_dev_css).toBeDefined()
})

test("plugin registers all v2.0 tools", async () => {
  const hooks = await OpenGemPlugin({} as never, {})

  expect(hooks.tool!.obsidian_wiki_ingest).toBeDefined()
  expect(hooks.tool!.obsidian_wiki_update).toBeDefined()
  expect(hooks.tool!.obsidian_wiki_refresh_index).toBeDefined()
  expect(hooks.tool!.obsidian_wiki_search_cited).toBeDefined()
  expect(hooks.tool!.obsidian_wiki_save_answer).toBeDefined()
  expect(hooks.tool!.obsidian_wiki_lint).toBeDefined()
  expect(hooks.tool!.obsidian_eval).toBeDefined()
})

// --- degraded mode ---

test("runReadTool returns CLI_NOT_FOUND when shell exits 127", async () => {
  const result = await runReadTool({
    shell: async () => ({ exitCode: 127, stdout: "", stderr: "obsidian: command not found" }),
    input: { file: "My Note" },
  })

  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("CLI_NOT_FOUND")
})
