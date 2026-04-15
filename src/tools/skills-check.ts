import { existsSync } from "node:fs"
import { join } from "node:path"
import type { ResultEnvelope } from "../lib/types"

type SkillsCheckData = {
  mode: string
  skillsPath: string
  found: string[]
  missing: string[]
}

export async function runSkillsCheck(args: {
  mode: string
  skillsPath: string
  requiredSkills: string[]
  exists?: (path: string) => boolean
}): Promise<ResultEnvelope<SkillsCheckData>> {
  const exists = args.exists ?? existsSync
  const found: string[] = []
  const missing: string[] = []

  for (const skill of args.requiredSkills) {
    if (exists(join(args.skillsPath, skill, "SKILL.md"))) {
      found.push(skill)
    } else {
      missing.push(skill)
    }
  }

  const ok = missing.length === 0

  return {
    schemaVersion: "1.0",
    ok,
    command: "obsidian_skills_check",
    args: { mode: args.mode },
    requiredCapabilities: [],
    checkedCapabilities: ["skills"],
    data: {
      mode: args.mode,
      skillsPath: args.skillsPath,
      found,
      missing,
    },
    stdout: "",
    stderr: "",
    exitCode: ok ? 0 : 1,
    hint: ok ? null : "Run obsidian_env_doctor or bun run sync:skills to fix missing skills",
    error: ok
      ? null
      : {
          code: "BUNDLED_SKILLS_OUT_OF_SYNC",
          kind: "capability",
          message: `Missing skills: ${missing.join(", ")}`,
        },
  }
}
