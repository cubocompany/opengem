/**
 * Sync upstream obsidian-skills content into the local skills/ directory.
 *
 * Usage:
 *   bun run sync:skills [--source=/path/to/obsidian-skills] [--clean]
 *
 * Without --source, fetches SKILL.md files directly from GitHub using the
 * upstreamRepo and upstreamRef defined in skills/manifest.json.
 *
 * --clean: remove vendored skill directories not listed in the manifest.
 *          Required for deletion; omitting it is safe by default.
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync } from "node:fs"
import { join, resolve } from "node:path"
import { validateSkillsSource, buildSyncPlan, applyManifestUpdate, type SkillsManifest } from "../src/lib/skills"

const MANIFEST_PATH = join("skills", "manifest.json")
const DEST_PATH = "skills"

function parseArgs(argv: string[]): { source: string | null; clean: boolean } {
  let source: string | null = null
  let clean = false

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--source=")) {
      source = resolve(arg.slice("--source=".length))
    } else if (arg === "--clean") {
      clean = true
    }
  }

  return { source, clean }
}

async function fetchFromGitHub(upstreamRepo: string, upstreamRef: string, skill: string): Promise<string> {
  const rawBase = upstreamRepo
    .replace("https://github.com/", "https://raw.githubusercontent.com/")
  const url = `${rawBase}/${upstreamRef}/skills/${skill}/SKILL.md`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status} ${resp.statusText}`)
  return resp.text()
}

async function main() {
  const { source, clean } = parseArgs(process.argv)

  const manifest: SkillsManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  const { skills, upstreamRepo, upstreamRef } = manifest

  if (source) {
    console.log(`Syncing from local source: ${source}`)
    const validation = await validateSkillsSource({ skills, sourcePath: source })
    if (!validation.valid) {
      console.error(`Missing skills in source: ${validation.missing.join(", ")}`)
      process.exitCode = 1
      return
    }

    const plan = buildSyncPlan({ skills, sourcePath: source, destPath: DEST_PATH })
    for (const entry of plan) {
      mkdirSync(join(DEST_PATH, entry.skillName), { recursive: true })
      copyFileSync(entry.sourcePath, entry.destPath)
      console.log(`  synced ${entry.skillName}`)
    }

    const updated = applyManifestUpdate(manifest, {
      syncedAt: new Date().toISOString(),
      syncedRef: source,
    })
    writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2) + "\n")
  } else {
    console.log(`Fetching from ${upstreamRepo}@${upstreamRef}`)
    for (const skill of skills) {
      const content = await fetchFromGitHub(upstreamRepo, upstreamRef, skill)
      mkdirSync(join(DEST_PATH, skill), { recursive: true })
      writeFileSync(join(DEST_PATH, skill, "SKILL.md"), content)
      console.log(`  fetched ${skill}`)
    }

    const updated = applyManifestUpdate(manifest, {
      syncedAt: new Date().toISOString(),
      syncedRef: upstreamRef,
    })
    writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2) + "\n")
  }

  if (clean) {
    const existing = readdirSync(DEST_PATH).filter(
      (name) => name !== "README.md" && name !== "manifest.json"
    )
    for (const dir of existing) {
      if (!skills.includes(dir)) {
        rmSync(join(DEST_PATH, dir), { recursive: true, force: true })
        console.log(`  removed extraneous: ${dir}`)
      }
    }
  }

  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
