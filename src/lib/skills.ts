import { existsSync } from "node:fs"
import { join } from "node:path"

export type SkillsState = {
  mode: "external" | "bundled"
  path: string
}

export type SkillsManifest = {
  upstreamRepo: string
  upstreamRef: string
  skills: string[]
  syncedAt?: string
  syncedRef?: string
}

export type SyncEntry = {
  skillName: string
  sourcePath: string
  destPath: string
}

export type ValidationResult = {
  valid: boolean
  missing: string[]
}

export async function detectSkillsState(args: {
  mode: "external" | "bundled"
  explicitPath: string | null
  homeDir: string
  syncDirName: string
  exists?: (path: string) => boolean
}): Promise<SkillsState> {
  const exists = args.exists ?? existsSync

  if (args.explicitPath) {
    return { mode: "external", path: args.explicitPath }
  }

  const bundledPath = join(args.homeDir, ".opencode", "skills", args.syncDirName)

  if (args.mode === "bundled") {
    return { mode: "bundled", path: bundledPath }
  }

  const externalDefault = join(args.homeDir, ".opencode", "skills", "obsidian-skills")
  return {
    mode: args.mode,
    path: exists(externalDefault) ? externalDefault : bundledPath,
  }
}

export async function validateSkillsSource(args: {
  skills: string[]
  sourcePath: string
  exists?: (path: string) => boolean
}): Promise<ValidationResult> {
  const exists = args.exists ?? existsSync
  const missing: string[] = []

  for (const skill of args.skills) {
    const skillFile = join(args.sourcePath, skill, "SKILL.md")
    if (!exists(skillFile)) {
      missing.push(skill)
    }
  }

  return { valid: missing.length === 0, missing }
}

export function buildSyncPlan(args: {
  skills: string[]
  sourcePath: string
  destPath: string
}): SyncEntry[] {
  return args.skills.map((skillName) => ({
    skillName,
    sourcePath: join(args.sourcePath, skillName, "SKILL.md"),
    destPath: join(args.destPath, skillName, "SKILL.md"),
  }))
}

export function applyManifestUpdate(
  manifest: SkillsManifest,
  update: { syncedAt: string; syncedRef: string },
): SkillsManifest {
  return { ...manifest, ...update }
}
