import { expect, test } from "bun:test"
import { runEnvDoctor } from "../src/tools/env-doctor"
import { runSkillsCheck } from "../src/tools/skills-check"

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
