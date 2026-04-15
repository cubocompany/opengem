import type { ResultEnvelope } from "../lib/types"

type EnvDoctorData = {
  cliInstalled: boolean
  appRunning: boolean
  defaultVault: string | null
  skills: {
    mode: string
    path: string
    inSync: boolean
  }
}

export async function runEnvDoctor(args: {
  detectCli: () => Promise<boolean>
  detectApp: () => Promise<boolean>
  detectSkills: () => Promise<{ mode: string; path: string; inSync: boolean }>
  defaultVault: string | null
}): Promise<ResultEnvelope<EnvDoctorData>> {
  const [cliInstalled, appRunning, skills] = await Promise.all([
    args.detectCli(),
    args.detectApp(),
    args.detectSkills(),
  ])

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_env_doctor",
    args: {},
    requiredCapabilities: [],
    checkedCapabilities: ["cli", "app", "skills"],
    data: {
      cliInstalled,
      appRunning,
      defaultVault: args.defaultVault,
      skills,
    },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: null,
    error: null,
  }
}
