import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { getParser, detectLanguage, detectDocLanguage, isDedicated } from "./ast-parser"
import { extractJsTs } from "./ast-js"
import { extractPython } from "./ast-py"
import { extractGeneric } from "./ast-generic"
import { extractMarkdown } from "./ast-md"
import { extractPdf } from "./ast-pdf"
import { LANGUAGE_CONFIGS } from "./language-configs"
import { computeFileHash } from "./graph-store"
import { loadIgnoreRules } from "./ignore-parser"
import type { AstNode, AstEdge, GraphState } from "./types"

function collectFiles(dir: string, root: string, isIgnored: (rel: string) => boolean): string[] {
  const results: string[] = []
  let entries: string[]
  try { entries = readdirSync(dir, { encoding: "utf8" }) as string[] } catch { return results }

  for (const entry of entries) {
    const full = join(dir, entry)
    const rel = relative(root, full).replace(/\\/g, "/")
    let stat
    try { stat = statSync(full) } catch { continue }
    if (stat.isDirectory()) {
      if (isIgnored(rel + "/")) continue
      results.push(...collectFiles(full, root, isIgnored))
    } else if (stat.isFile()) {
      if (isIgnored(rel)) continue
      if (detectLanguage(entry) || detectDocLanguage(entry)) {
        results.push(full)
      }
    }
  }
  return results
}

export type BuildResult = {
  nodes: AstNode[]
  edges: AstEdge[]
  fileHashes: Record<string, string>
  filesProcessed: number
  filesSkipped: number
}

export async function buildGraph(args: {
  rootDir: string
  existing: GraphState | null
  languages?: string[]
}): Promise<BuildResult> {
  const isIgnored = loadIgnoreRules(args.rootDir)
  const allFiles = collectFiles(args.rootDir, args.rootDir, isIgnored)
  const defaultLangs = ["typescript", "javascript", "python", ...Object.keys(LANGUAGE_CONFIGS), "markdown", "pdf"]
  const allowedLangs = new Set(args.languages ?? defaultLangs)

  const existingHashes = args.existing?.fileHashes ?? {}
  const existingNodesByFile = new Map<string, AstNode[]>()
  const existingEdgesByFile = new Map<string, AstEdge[]>()

  if (args.existing) {
    for (const node of args.existing.nodes) {
      const list = existingNodesByFile.get(node.file) ?? []
      list.push(node)
      existingNodesByFile.set(node.file, list)
    }
    for (const edge of args.existing.edges) {
      // Attribute edges to the source node's file
      const sourceFile = edge.source.split("#")[0]
      const list = existingEdgesByFile.get(sourceFile) ?? []
      list.push(edge)
      existingEdgesByFile.set(sourceFile, list)
    }
  }

  const allNodes: AstNode[] = []
  const allEdges: AstEdge[] = []
  const fileHashes: Record<string, string> = { ...existingHashes }
  let filesProcessed = 0
  let filesSkipped = 0

  for (const fullPath of allFiles) {
    const relPath = relative(args.rootDir, fullPath).replace(/\\/g, "/")
    const lang = detectLanguage(fullPath)
    const docLang = detectDocLanguage(fullPath)
    const activeLang = lang ?? docLang
    if (!activeLang || !allowedLangs.has(activeLang)) continue

    let content: string
    try { content = readFileSync(fullPath, "utf8") } catch { continue }

    const hash = computeFileHash(content)

    if (existingHashes[relPath] === hash) {
      filesSkipped++
      fileHashes[relPath] = hash
      allNodes.push(...(existingNodesByFile.get(relPath) ?? []))
      allEdges.push(...(existingEdgesByFile.get(relPath) ?? []))
      continue
    }

    // Extract file
    try {
      let extracted: { nodes: AstNode[]; edges: AstEdge[] }

      if (docLang === "markdown") {
        extracted = extractMarkdown(content, relPath)
      } else if (docLang === "pdf") {
        extracted = await extractPdf(fullPath, relPath)
      } else if (lang) {
        const parser = await getParser(lang)
        const tree = parser.parse(content)
        if (!tree) { filesSkipped++; continue }

        if (isDedicated(lang)) {
          if (lang === "python") {
            extracted = extractPython(tree, relPath)
          } else {
            extracted = extractJsTs(tree, relPath, lang)
          }
        } else {
          extracted = extractGeneric(tree, relPath, lang, LANGUAGE_CONFIGS[lang])
        }
      } else {
        filesSkipped++; continue
      }

      allNodes.push(...extracted.nodes)
      allEdges.push(...extracted.edges)
      fileHashes[relPath] = hash
      filesProcessed++
    } catch {
      filesSkipped++
    }
  }

  // Resolve unresolved edges against known node names
  const nameIndex = new Map<string, string>() // name → nodeId (last wins for simplicity)
  for (const node of allNodes) {
    nameIndex.set(node.name, node.id)
  }

  const resolvedEdges = allEdges.map(edge => {
    if (!edge.target.startsWith("__unresolved__/")) return edge
    const symbol = edge.target.slice("__unresolved__/".length)
    const resolved = nameIndex.get(symbol)
    return resolved ? { ...edge, target: resolved } : edge
  })

  return { nodes: allNodes, edges: resolvedEdges, fileHashes, filesProcessed, filesSkipped }
}
