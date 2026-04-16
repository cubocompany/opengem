import { extractText, extractLinks } from "unpdf"
import { readFileSync } from "node:fs"
import type { AstNode, AstEdge } from "./types"

type Extracted = { nodes: AstNode[]; edges: AstEdge[] }

// Heuristic: a line is a "heading" if it's short, has no sentence-ending punctuation,
// and is followed by substantive content. We cap at ~80 chars.
const MAX_HEADING_LEN = 80
const HEADING_RE = /^[A-Z0-9][\w\s,:()/\-–—]{2,79}$/

function looksLikeHeading(line: string): boolean {
  const t = line.trim()
  if (t.length === 0 || t.length > MAX_HEADING_LEN) return false
  if (t.endsWith(".") || t.endsWith(",") || t.endsWith(";")) return false
  return HEADING_RE.test(t)
}

function slugHeading(name: string, counts: Map<string, number>): string {
  const n = (counts.get(name) ?? 0) + 1
  counts.set(name, n)
  return n === 1 ? name : `${name} (${n})`
}

export async function extractPdf(filePath: string, relFile: string): Promise<Extracted> {
  const nodes: AstNode[] = []
  const edges: AstEdge[] = []
  const seen = new Set<string>()
  const headingCounts = new Map<string, number>()

  function makeId(name: string) { return `${relFile}#${name}` }

  function addNode(name: string, kind: AstNode["kind"], line: number): string {
    const id = makeId(name)
    if (!seen.has(id)) {
      seen.add(id)
      nodes.push({ id, kind, name, file: relFile, line, language: "pdf", docComment: null })
    }
    return id
  }

  const buffer = readFileSync(filePath).buffer as ArrayBuffer

  // Extract text per page
  const { totalPages, text } = await extractText(new Uint8Array(buffer), { mergePages: false })

  const moduleId = addNode(relFile, "module", 0)
  let currentSectionId: string | null = null

  const allLines = (Array.isArray(text) ? text : [text]).flatMap((page, pi) =>
    (page as string).split("\n").map(l => ({ text: l.trim(), page: pi + 1 }))
  )

  let lineNum = 0
  for (const { text: line, page } of allLines) {
    lineNum++
    if (!line) continue

    if (looksLikeHeading(line)) {
      const name = slugHeading(line, headingCounts)
      const id = addNode(name, "section", page)
      edges.push({ source: moduleId, target: id, kind: "contains" })
      currentSectionId = id
      continue
    }
  }

  // Extract hyperlinks (internal/relative only)
  try {
    const { links } = await extractLinks(new Uint8Array(buffer))
    const contextId = currentSectionId ?? moduleId
    for (const url of links) {
      if (!url.startsWith("http") && !url.startsWith("mailto")) {
        edges.push({ source: contextId, target: `__unresolved__/${url}`, kind: "imports" })
      }
    }
  } catch {
    // extractLinks may not be supported by all PDFs — ignore
  }

  return { nodes, edges }
}
