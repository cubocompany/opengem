import type { PluginConfig, VaultAction } from "./types"

export function resolvePluginConfig(input: Partial<PluginConfig>): PluginConfig {
  return {
    defaultVault: input.defaultVault ?? null,
    skills: {
      mode: input.skills?.mode ?? "external",
      externalPath: input.skills?.externalPath ?? null,
      syncDirName: input.skills?.syncDirName ?? "obsidian-opencode-plugin-bundled",
    },
    wiki: {
      rawDir: input.wiki?.rawDir ?? "raw",
      wikiDir: input.wiki?.wikiDir ?? "wiki",
      schemaDir: input.wiki?.schemaDir ?? "schema",
    },
    graph: {
      graphDir: input.graph?.graphDir ?? "graph",
    },
    evalEnabled: input.evalEnabled ?? false,
  }
}

export function resolveVault(args: {
  action: VaultAction
  inputVault: string | null
  activeVault: string | null
  config: PluginConfig
}): string | null {
  if (args.inputVault) return args.inputVault
  if (args.config.defaultVault) return args.config.defaultVault
  if (args.action === "read") return args.activeVault
  return null
}
