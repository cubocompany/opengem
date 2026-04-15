export type SkillsMode = "external" | "bundled"

export type PluginConfig = {
  defaultVault: string | null
  skills: {
    mode: SkillsMode
    externalPath: string | null
    syncDirName: string
  }
}

export function resolvePluginConfig(input: Partial<PluginConfig>): PluginConfig
