import { createHash } from "node:crypto"
import { existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import DirectedGraph from "graphology"
import type { GraphState, AstNode, AstEdge } from "./types"

// ── Graph summary (stored in project dir for the system transform hook) ───────

export type GraphSummary = {
  version: "1"
  rootDir: string
  indexedAt: string
  nodeCount: number
  edgeCount: number
  communityCount: number
}

export function graphSummaryPath(projectDir: string): string {
  return join(projectDir, ".opengem", "graph-summary.json")
}

export async function saveGraphSummary(projectDir: string, summary: GraphSummary): Promise<void> {
  const path = graphSummaryPath(projectDir)
  const dir = dirname(path)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  await Bun.write(path, JSON.stringify(summary, null, 2) + "\n")
}

export async function loadGraphSummary(projectDir: string): Promise<GraphSummary | null> {
  const path = graphSummaryPath(projectDir)
  if (!existsSync(path)) return null
  try {
    const text = await Bun.file(path).text()
    return JSON.parse(text) as GraphSummary
  } catch {
    return null
  }
}

// ── State persistence ─────────────────────────────────────────────────────────

export async function loadGraphState(statePath: string): Promise<GraphState | null> {
  if (!existsSync(statePath)) return null
  try {
    const text = await Bun.file(statePath).text()
    const parsed = JSON.parse(text) as GraphState
    if (parsed.version !== "1") return null
    return parsed
  } catch {
    return null
  }
}

export async function saveGraphState(statePath: string, state: GraphState): Promise<void> {
  await Bun.write(statePath, JSON.stringify(state, null, 2) + "\n")
}

// ── Hashing ───────────────────────────────────────────────────────────────────

export function computeFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

// ── Graph reconstruction ──────────────────────────────────────────────────────

export function buildGraphologyFromState(state: GraphState): DirectedGraph {
  const g = new DirectedGraph()

  for (const node of state.nodes) {
    g.addNode(node.id, { ...node })
  }

  for (const edge of state.edges) {
    if (edge.target.startsWith("__unresolved__")) continue
    if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue
    if (!g.hasEdge(edge.source, edge.target)) {
      g.addEdge(edge.source, edge.target, { kind: edge.kind })
    }
  }

  return g
}

// ── Node degree helpers ───────────────────────────────────────────────────────

export function buildDegreeMap(nodes: AstNode[], edges: AstEdge[]): Map<string, number> {
  const degrees = new Map<string, number>()
  for (const n of nodes) degrees.set(n.id, 0)
  for (const e of edges) {
    if (e.target.startsWith("__unresolved__")) continue
    degrees.set(e.source, (degrees.get(e.source) ?? 0) + 1)
    degrees.set(e.target, (degrees.get(e.target) ?? 0) + 1)
  }
  return degrees
}
