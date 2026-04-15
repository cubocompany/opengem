import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiSearchCitedData = { query: string; results: string }

export async function runWikiSearchCitedTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { query: string; limit?: number; vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiSearchCitedData | null>> {
  if (!args.input.query) {
    return errorResult("INVALID_ARGS", "query is required", "Provide a search query", "obsidian_wiki_search_cited", args.input, ["cli", "app"], ["cli", "app"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  const cliArgs: Record<string, unknown> = { query: args.input.query, path: args.wikiPaths.wiki }
  if (args.input.limit) cliArgs["limit"] = args.input.limit
  if (vault) cliArgs["vault"] = vault

  const result = await executeObsidianCli(args.shell, "search", cliArgs, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return { ...result, data: result.ok ? { query: args.input.query, results: result.stdout } : null }
}
