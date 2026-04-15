import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { buildLogEntry, type WikiPaths } from "../lib/wiki"
import type { ResultEnvelope } from "../lib/types"

type WikiSaveAnswerData = { path: string; vault: string }

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
}

export async function runWikiSaveAnswerTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { question: string; answer: string; vault?: string; tags?: string[] }
  defaultVault: string | null
  activeVault: string | null
  wikiPaths: WikiPaths
}): Promise<ResultEnvelope<WikiSaveAnswerData | null>> {
  if (!args.input.question) {
    return errorResult("INVALID_ARGS", "question is required", "Provide a question", "obsidian_wiki_save_answer", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_wiki_save_answer", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const slug = slugify(args.input.question)
  const path = `${args.wikiPaths.answers}/${slug}`
  const tags = args.input.tags?.length ? `\ntags: [${args.input.tags.join(", ")}]` : ""
  const content = `---\nquestion: "${args.input.question}"${tags}\n---\n\n${args.input.answer}\n`

  const result = await executeObsidianCli(
    args.shell, "create",
    { name: path, content, vault, overwrite: false },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  if (!result.ok) return { ...result, data: null }

  // Append to LOG.md (best-effort)
  const logContent = buildLogEntry("query", {
    source: args.input.question,
    files: [path],
  })
  await executeObsidianCli(
    args.shell, "append",
    { path: `${args.wikiPaths.wiki}/LOG.md`, content: logContent, vault },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  ).catch(() => { /* best-effort */ })

  return { ...result, data: { path, vault } }
}
