import { expect, test } from "bun:test"
import { join } from "node:path"
import { validateSkillsSource, buildSyncPlan, applyManifestUpdate } from "../src/lib/skills"

const FIXTURE_UPSTREAM = join("tests", "fixtures", "skills", "upstream")
const REQUIRED_SKILLS = ["obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle"]

test("manifest contains every required skill name", () => {
  const plan = buildSyncPlan({
    skills: REQUIRED_SKILLS,
    sourcePath: FIXTURE_UPSTREAM,
    destPath: join("tmp", "dest"),
  })

  expect(plan.map((p) => p.skillName)).toEqual(REQUIRED_SKILLS)
})

test("validateSkillsSource succeeds when all skills are present", async () => {
  const result = await validateSkillsSource({
    skills: REQUIRED_SKILLS,
    sourcePath: FIXTURE_UPSTREAM,
    exists: () => true,
  })

  expect(result.missing).toHaveLength(0)
  expect(result.valid).toBe(true)
})

test("validateSkillsSource fails when a listed skill is missing from the source", async () => {
  const result = await validateSkillsSource({
    skills: ["obsidian-markdown", "missing-skill"],
    sourcePath: FIXTURE_UPSTREAM,
    exists: (p) => !p.includes("missing-skill"),
  })

  expect(result.valid).toBe(false)
  expect(result.missing).toContain("missing-skill")
})

test("applyManifestUpdate records synced timestamp and source ref", () => {
  const original = {
    upstreamRepo: "https://github.com/kepano/obsidian-skills",
    upstreamRef: "main",
    skills: REQUIRED_SKILLS,
  }

  const updated = applyManifestUpdate(original, {
    syncedAt: "2026-04-15T00:00:00.000Z",
    syncedRef: "abc123",
  })

  expect(updated.syncedAt).toBe("2026-04-15T00:00:00.000Z")
  expect(updated.syncedRef).toBe("abc123")
  expect(updated.skills).toEqual(REQUIRED_SKILLS)
})

test("buildSyncPlan does not include files not in manifest", () => {
  const plan = buildSyncPlan({
    skills: ["obsidian-markdown"],
    sourcePath: FIXTURE_UPSTREAM,
    destPath: join("tmp", "dest"),
  })

  expect(plan).toHaveLength(1)
  expect(plan[0].skillName).toBe("obsidian-markdown")
})
