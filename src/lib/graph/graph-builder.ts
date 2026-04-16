import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { getParser, detectLanguage, isDedicated } from "./ast-parser"
import { extractJsTs } from "./ast-js"
import { extractPython } from "./ast-py"
import { extractGeneric } from "./ast-generic"
import { LANGUAGE_CONFIGS } from "./language-configs"
import { computeFileHash } from "./graph-store"
import type { AstNode, AstEdge, GraphState } from "./types"

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache", "__pycache__", ".venv", "venv", "coverage"])

function collectFiles(dir: string, root: string): string[] {
  const results: string[] = []
  let entries: string[]
  try { entries = readdirSync(dir, { encoding: "utf8" }) as string[] } catch { return results }

  for (const entry of entries) {
    if (entry.startsWith(".") && entry !== ".") continue
    const full = join(dir, entry)
    let stat
    try { stat = statSync(full) } catch { continue }
    if (stat.isDirectory()) {
      if (IGNORED_DIRS.has(entry)) continue
      results.push(...collectFiles(full, root))
    } else if (stat.isFile() && detectLanguage(entry)) {
      results.push(full)
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
  const allFiles = collectFiles(args.rootDir, args.rootDir)
  const defaultLangs = ["typescript", "javascript", "python", ...Object.keys(LANGUAGE_CONFIGS)]
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
    if (!lang || !allowedLangs.has(lang)) continue

    let content: string
    try { content = readFileSync(fullPath, "utf8") } catch { continue }

    const hash = computeFileHash(content)

    if (existingHashes[relPath] === hash) {
      // Cache hit — reuse existing nodes/edges for this file
      filesSkipped++
      fileHashes[relPath] = hash
      allNodes.push(...(existingNodesByFile.get(relPath) ?? []))
      allEdges.push(...(existingEdgesByFile.get(relPath) ?? []))
      continue
    }

    // Parse file
    try {
      const parser = await getParser(lang)
      const tree = parser.parse(content)
      if (!tree) { filesSkipped++; continue }
      let extracted: { nodes: AstNode[]; edges: AstEdge[] }

      if (isDedicated(lang)) {
        if (lang === "python") {
          extracted = extractPython(tree, relPath)
        } else {
          extracted = extractJsTs(tree, relPath, lang)
        }
      } else {
        const cfg = LANGUAGE_CONFIGS[lang]
        extracted = extractGeneric(tree, relPath, lang, cfg)
      }

      allNodes.push(...extracted.nodes)
      allEdges.push(...extracted.edges)
      fileHashes[relPath] = hash
      filesProcessed++
    } catch {
      // Skip unparseable files silently
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
