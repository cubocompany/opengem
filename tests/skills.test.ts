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
