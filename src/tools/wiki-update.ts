import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiUpdateData = { path: string; vault: string; updated: boolean }

export async function runWikiUpdateTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { pageName: string; content: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiUpdateData | null>> {
  if (!args.input.pageName) {
    return errorResult("INVALID_ARGS", "pageName is required", "Provide a wiki page name", "obsidian_wiki_update", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_update", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const path = `${args.wikiPaths.wiki}/${args.input.pageName}`
  const result = await executeObsidianCli(
    args.shell, "create",
    { name: path, content: args.input.content, vault, silent: true, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  return { ...result, data: result.ok ? { path, vault, updated: true } : null }
}
