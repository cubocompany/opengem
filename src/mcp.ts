#!/usr/bin/env node
/**
 * opengem mcp — MCP server that exposes the local code knowledge graph.
 *
 * Tools:
 *   graph_index   — index a directory into .opengem/graph-state.json
 *   graph_query   — search nodes by name or file
 *   graph_explain — show incoming/outgoing edges for a symbol
 *   graph_path    — find shortest path between two symbols
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { buildGraph } from "./lib/graph/graph-builder"
import { buildDegreeMap, buildGraphologyFromState } from "./lib/graph/graph-store"
import { detectCommunities } from "./lib/graph/graph-community"
import { writeOutputs } from "./lib/graph/output-renderer"
import { bidirectional } from "graphology-shortest-path"
import type { GraphState, AstNodeKind } from "./lib/graph/types"

// ── State helpers ─────────────────────────────────────────────────────────────

function localStatePath(rootDir: string): string {
  return join(rootDir, ".opengem", "graph-state.json")
}

function loadLocalState(rootDir: string): GraphState | null {
  const path = localStatePath(rootDir)
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as GraphState
    return parsed.version === "1" ? parsed : null
  } catch { return null }
}

function saveLocalState(rootDir: string, state: GraphState): void {
  const path = localStatePath(rootDir)
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8")
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "opengem",
  version: "1.0.0",
})

// graph_index ─────────────────────────────────────────────────────────────────

server.tool(
  "graph_index",
  "Index a directory's source code into a local knowledge graph at .opengem/graph-state.json. Run this before using graph_query, graph_explain, or graph_path.",
  {
    rootDir: z.string().describe("Absolute path to the directory to index"),
    force: z.boolean().optional().describe("Discard cache and re-index all files"),
  },
  async ({ rootDir, force }) => {
    const absDir = resolve(rootDir)
    const existing = force ? null : loadLocalState(absDir)

    const { nodes, edges, fileHashes, filesProcessed, filesSkipped } = await buildGraph({
      rootDir: absDir,
      existing,
    })

    const graphology = buildGraphologyFromState({
      version: "1", indexedAt: new Date().toISOString(),
      rootDir: absDir, fileHashes, nodes, edges, communities: {},
    })
    const communities = detectCommunities(graphology)
    const communityCount = new Set(Object.values(communities)).size
    const resolvedEdges = edges.filter(e => !e.target.startsWith("__unresolved__")).length

    const finalState: GraphState = {
      version: "1", indexedAt: new Date().toISOString(),
      rootDir: absDir, fileHashes, nodes, edges, communities,
    }
    saveLocalState(absDir, finalState)

    const summaryPath = join(absDir, ".opengem", "graph-summary.json")
    writeFileSync(summaryPath, JSON.stringify({
      version: "1", rootDir: absDir, indexedAt: new Date().toISOString(),
      nodeCount: nodes.length, edgeCount: resolvedEdges, communityCount,
    }, null, 2) + "\n", "utf8")

    try { writeOutputs(finalState) } catch { /* non-fatal */ }

    return {
      content: [{
        type: "text",
        text: `Indexed ${filesProcessed} files (${filesSkipped} cached) — ${nodes.length} nodes, ${resolvedEdges} edges, ${communityCount} communities. Output written to opengem-out/.`,
      }],
    }
  }
)

// graph_query ─────────────────────────────────────────────────────────────────

server.tool(
  "graph_query",
  "Search the code knowledge graph for nodes matching a name or file path.",
  {
    rootDir: z.string().describe("Project root directory (where .opengem/ lives)"),
    query: z.string().describe("Search term — matched against node name and file path"),
    kind: z.enum(["function", "class", "module", "method", "variable", "section"]).optional()
      .describe("Filter by node kind"),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)"),
  },
  async ({ rootDir, query, kind, limit = 20 }) => {
    const state = loadLocalState(resolve(rootDir))
    if (!state) return { content: [{ type: "text", text: "No graph found. Run graph_index first." }] }

    const degrees = buildDegreeMap(state.nodes, state.edges)
    const q = query.toLowerCase()
    const matches = state.nodes
      .filter(n => {
        if (!n.name.toLowerCase().includes(q) && !n.file.toLowerCase().includes(q)) return false
        if (kind && n.kind !== kind) return false
        return true
      })
      .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
      .slice(0, limit)
      .map(n => ({
        id: n.id, kind: n.kind, name: n.name, file: n.file, line: n.line,
        edgeCount: degrees.get(n.id) ?? 0,
        community: state.communities[n.id] ?? 0,
      }))

    return {
      content: [{
        type: "text",
        text: matches.length === 0
          ? `No matches for "${query}".`
          : JSON.stringify(matches, null, 2),
      }],
    }
  }
)

// graph_explain ───────────────────────────────────────────────────────────────

server.tool(
  "graph_explain",
  "Show all incoming and outgoing edges for a symbol in the code knowledge graph.",
  {
    rootDir: z.string().describe("Project root directory (where .opengem/ lives)"),
    symbol: z.string().describe("Symbol name or node ID"),
  },
  async ({ rootDir, symbol }) => {
    const state = loadLocalState(resolve(rootDir))
    if (!state) return { content: [{ type: "text", text: "No graph found. Run graph_index first." }] }

    const node = state.nodes.find(n => n.name === symbol || n.id === symbol || n.id.endsWith(`#${symbol}`))
    if (!node) return { content: [{ type: "text", text: `Symbol not found: ${symbol}` }] }

    const nodeIndex = new Map(state.nodes.map(n => [n.id, n]))
    const incoming = state.edges
      .filter(e => e.target === node.id && !e.source.startsWith("__unresolved__"))
      .map(e => ({ edgeKind: e.kind, id: e.source, name: nodeIndex.get(e.source)?.name ?? e.source, file: nodeIndex.get(e.source)?.file ?? "" }))
    const outgoing = state.edges
      .filter(e => e.source === node.id && !e.target.startsWith("__unresolved__"))
      .map(e => ({ edgeKind: e.kind, id: e.target, name: nodeIndex.get(e.target)?.name ?? e.target, file: nodeIndex.get(e.target)?.file ?? "" }))

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ node: { id: node.id, kind: node.kind, file: node.file, line: node.line }, incoming, outgoing }, null, 2),
      }],
    }
  }
)

// graph_path ──────────────────────────────────────────────────────────────────

server.tool(
  "graph_path",
  "Find the shortest dependency path between two symbols in the code knowledge graph.",
  {
    rootDir: z.string().describe("Project root directory (where .opengem/ lives)"),
    from: z.string().describe("Source symbol name or node ID"),
    to: z.string().describe("Target symbol name or node ID"),
  },
  async ({ rootDir, from, to }) => {
    const state = loadLocalState(resolve(rootDir))
    if (!state) return { content: [{ type: "text", text: "No graph found. Run graph_index first." }] }

    const findNode = (sym: string) => state.nodes.find(n => n.name === sym || n.id === sym || n.id.endsWith(`#${sym}`))
    const fromNode = findNode(from)
    const toNode = findNode(to)
    if (!fromNode) return { content: [{ type: "text", text: `Symbol not found: ${from}` }] }
    if (!toNode) return { content: [{ type: "text", text: `Symbol not found: ${to}` }] }

    const g = buildGraphologyFromState(state)
    if (!g.hasNode(fromNode.id) || !g.hasNode(toNode.id)) {
      return { content: [{ type: "text", text: "One or both symbols have no edges in the graph." }] }
    }

    const path = bidirectional(g, fromNode.id, toNode.id)
    if (!path) return { content: [{ type: "text", text: `No path found between "${from}" and "${to}".` }] }

    const nodeIndex = new Map(state.nodes.map(n => [n.id, n]))
    const steps = path.map(id => {
      const n = nodeIndex.get(id)
      return { id, name: n?.name ?? id, kind: n?.kind, file: n?.file, line: n?.line }
    })

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ hops: path.length - 1, path: steps }, null, 2),
      }],
    }
  }
)

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport()
await server.connect(transport)
