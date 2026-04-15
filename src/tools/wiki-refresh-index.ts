import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { buildIndexMarkdown, type WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiRefreshIndexData = { indexPath: string; pageCount: number; vault: string }

export async function runWikiRefreshIndexTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiRefreshIndexData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_refresh_index", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const searchResult = await executeObsidianCli(
    args.shell, "search",
    { query: `path:${args.wikiPaths.wiki}`, vault },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )
  if (!searchResult.ok) return { ...searchResult, data: null }

  const pages = searchResult.stdout.split("\n").map(l => l.trim()).filter(Boolean)
  const indexContent = buildIndexMarkdown(pages)

  const writeResult = await executeObsidianCli(
    args.shell, "create",
    { name: args.wikiPaths.index, content: indexContent, vault, silent: true, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  return { ...writeResult, data: writeResult.ok ? { indexPath: args.wikiPaths.index, pageCount: pages.length, vault } : null }
}
