import type { AstNode, AstEdge } from "./types"

type Extracted = { nodes: AstNode[]; edges: AstEdge[] }

function makeId(file: string, name: string): string {
  return `${file}#${name}`
}

// Deduplicate heading names within a file by appending occurrence count
function uniqueName(base: string, counts: Map<string, number>): string {
  const n = (counts.get(base) ?? 0) + 1
  counts.set(base, n)
  return n === 1 ? base : `${base} (${n})`
}

export function extractMarkdown(content: string, file: string): Extracted {
  const nodes: AstNode[] = []
  const edges: AstEdge[] = []
  const seen = new Set<string>()
  const headingCounts = new Map<string, number>()

  function addNode(name: string, kind: AstNode["kind"], line: number): string {
    const id = makeId(file, name)
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({ id, kind, name, file, line, language: "markdown", docComment: null })
    }
    return id
  }

  const moduleId = addNode(file, "module", 0)
  const lines = content.split("\n")

  // Section stack: tracks the nearest ancestor section at each heading level
  // Index 1 = H1, index 2 = H2, index 3 = H3
  const sectionStack: (string | null)[] = [null, null, null, null]
  let inFrontmatter = false
  let frontmatterDone = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Skip YAML frontmatter (--- ... ---)
    if (i === 0 && line.trim() === "---") { inFrontmatter = true; continue }
    if (inFrontmatter) {
      if (line.trim() === "---") { inFrontmatter = false; frontmatterDone = true }
      continue
    }

    // Skip fenced code blocks
    if (line.startsWith("```") || line.startsWith("~~~")) {
      // Toggle code block tracking (simple, not nested)
      continue
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length          // 1, 2, or 3
      const rawName = headingMatch[2].replace(/\s*#+\s*$/, "").trim()
      const name = uniqueName(rawName, headingCounts)
      const id = addNode(name, "section", lineNum)

      // Parent is the nearest ancestor section, or the module if at top level
      const parentId = level === 1
        ? moduleId
        : (sectionStack[level - 1] ?? sectionStack[level - 2] ?? moduleId)

      edges.push({ source: parentId, target: id, kind: "contains" })

      // Update stack: this heading invalidates all deeper levels
      sectionStack[level] = id
      for (let d = level + 1; d <= 3; d++) sectionStack[d] = null
      continue
    }

    // Nearest enclosing section (or module if none)
    const contextId = sectionStack[3] ?? sectionStack[2] ?? sectionStack[1] ?? moduleId

    // ── Wikilinks: [[Page]] or [[Page|Alias]] ─────────────────────────────────
    const wikilinkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let m: RegExpExecArray | null
    while ((m = wikilinkRe.exec(line)) !== null) {
      const target = m[1].trim()
      edges.push({ source: contextId, target: `__unresolved__/${target}`, kind: "imports" })
    }

    // ── Markdown links: [text](./path) — relative only ────────────────────────
    const mdLinkRe = /\[([^\]]+)\]\(([^)]+)\)/g
    while ((m = mdLinkRe.exec(line)) !== null) {
      const href = m[2].trim()
      if (!href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto")) {
        edges.push({ source: contextId, target: `__unresolved__/${href}`, kind: "imports" })
      }
    }
  }

  return { nodes, edges }
}
