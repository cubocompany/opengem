export type WikiPaths = {
  vault: string
  raw: string
  wiki: string
  schema: string
  answers: string
  index: string
}

export function resolveWikiPaths(args: {
  vault: string
  rawDir?: string
  wikiDir?: string
  schemaDir?: string
}): WikiPaths {
  const raw = args.rawDir ?? "raw"
  const wiki = args.wikiDir ?? "wiki"
  const schema = args.schemaDir ?? "schema"

  return {
    vault: args.vault,
    raw,
    wiki,
    schema,
    answers: `${wiki}/answers`,
    index: `${wiki}/INDEX.md`,
  }
}

export function buildIndexMarkdown(pages: string[]): string {
  const sorted = [...pages].sort()
  const now = new Date().toISOString()
  const links = sorted
    .map(p => {
      const name = p.replace(/^wiki\//, "").replace(/\.md$/, "")
      return `- [[${name}]]`
    })
    .join("\n")

  return `# Wiki Index\n\n> generated: ${now}\n\n${links}\n`
}

export type BrokenLink = { source: string; link: string }

export function detectBrokenLinks(
  pages: string[],
  links: Record<string, string[]>,
): BrokenLink[] {
  const pageNames = new Set(
    pages.map(p => p.replace(/^wiki\//, "").replace(/\.md$/, ""))
  )

  const broken: BrokenLink[] = []
  for (const [source, sourceLinks] of Object.entries(links)) {
    for (const link of sourceLinks) {
      const name = link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim()
      if (!pageNames.has(name)) {
        broken.push({ source, link })
      }
    }
  }
  return broken
}
