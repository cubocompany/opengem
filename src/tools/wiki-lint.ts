import { executeObsidianCli } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { detectBrokenLinks, type WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiLintData = {
  pageCount: number
  brokenLinks: Array<{ source: string; link: string }>
  orphanPages: string[]
  missingIndexEntries: string[]
}

export async function runWikiLintTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
  readLinks?: () => Promise<Record<string, string[]>>
  readIndex?: () => Promise<string>
}): Promise<ResultEnvelope<WikiLintData>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  const searchResult = await executeObsidianCli(
    args.shell, "files",
    { folder: args.wikiPaths.wiki, ext: "md", ...(vault ? { vault } : {}) },
    { requiredCapabilities: ["cli", "app"], checkedCapabilities: ["cli", "app"] },
  )

  const pages = searchResult.ok
    ? searchResult.stdout.split("\n").map(l => l.trim()).filter(Boolean)
    : []

  const links = args.readLinks ? await args.readLinks() : {}
  const indexContent = args.readIndex ? await args.readIndex() : ""

  const brokenLinks = detectBrokenLinks(pages, links)

  const indexedNames = new Set(
    (indexContent.match(/\[\[([^\]]+)\]\]/g) ?? [])
      .map(l => l.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim())
  )
  const orphanPages = pages.filter(p => {
    const name = p.replace(/^wiki\//, "").replace(/\.md$/, "")
    return !indexedNames.has(name)
  })

  const pageNames = new Set(pages.map(p => p.replace(/^wiki\//, "").replace(/\.md$/, "")))
  const missingIndexEntries = [...indexedNames].filter(n => !pageNames.has(n))

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_wiki_lint",
    args: args.input,
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
    data: { pageCount: pages.length, brokenLinks, orphanPages, missingIndexEntries },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: brokenLinks.length > 0 || orphanPages.length > 0 ? "Run obsidian_wiki_refresh_index to fix index issues" : null,
    error: null,
  }
}
