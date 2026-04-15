import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { buildLogEntry, type WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiIngestData = { rawPath: string; wikiPath: string; vault: string }

export async function runWikiIngestTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { sourceName: string; sourceContent: string; wikiContent: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiIngestData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_ingest", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const rawName = `${args.wikiPaths.raw}/${args.input.sourceName}`
  const wikiName = `${args.wikiPaths.wiki}/${args.input.sourceName}`

  const rawResult = await executeObsidianCli(
    args.shell, "create",
    { name: rawName, content: args.input.sourceContent, vault, overwrite: false },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )
  if (!rawResult.ok) return { ...rawResult, data: null }

  const wikiResult = await executeObsidianCli(
    args.shell, "create",
    { name: wikiName, content: args.input.wikiContent, vault, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  if (!wikiResult.ok) return { ...wikiResult, data: null }

  // Append to LOG.md (best-effort — ignore failure so ingest still succeeds)
  const logContent = buildLogEntry("ingest", {
    source: args.input.sourceName,
    files: [rawName, wikiName],
  })
  await executeObsidianCli(
    args.shell, "append",
    { path: `${args.wikiPaths.wiki}/LOG.md`, content: logContent, vault },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  ).catch(() => { /* best-effort */ })

  return { ...wikiResult, data: { rawPath: rawName, wikiPath: wikiName, vault } }
}
