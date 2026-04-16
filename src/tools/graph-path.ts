import { errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { loadGraphState, buildGraphologyFromState } from "../lib/graph/graph-store"
import { resolveGraphPaths, nodeIdToNoteName } from "../lib/graph/graph-paths"
import { bidirectional } from "graphology-shortest-path"
import type { ResultEnvelope } from "../lib/types"
import type { GraphPathData, AstEdgeKind } from "../lib/graph/types"

export async function runGraphPathTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: {
    source: string
    target: string
    vault?: string
    vaultPath?: string
    graphDir?: string
  }
  defaultVault: string | null
  activeVault: string | null
  vaultPath: string | null
}): Promise<ResultEnvelope<GraphPathData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Vault required", "Pass vault or configure defaultVault", "obsidian_graph_path", args.input, [], [])
  }

  let vaultPath = args.input.vaultPath ?? args.vaultPath
  if (!vaultPath) {
    const vaultInfo = await args.shell(["obsidian", "vault"])
    if (vaultInfo.exitCode === 0) {
      const match = vaultInfo.stdout.match(/^path\t(.+)$/m)
      if (match) vaultPath = match[1].trim()
    }
  }
  if (!vaultPath) {
    return errorResult("VAULT_NOT_FOUND", "Could not detect vault path. Pass vaultPath explicitly or ensure Obsidian is running.", "Run obsidian_graph_index first", "obsidian_graph_path", args.input, [], [])
  }

  const graphPaths = resolveGraphPaths({ vault, vaultPath, graphDir: args.input.graphDir })
  const state = await loadGraphState(graphPaths.statePath)

  if (!state) {
    return errorResult("GRAPH_NOT_INDEXED", "No graph state found", "Run obsidian_graph_index first", "obsidian_graph_path", args.input, [], [])
  }

  // Resolve source/target — accept either nodeId or symbol name
  const nodeIndex = new Map(state.nodes.map(n => [n.id, n]))
  const nameIndex = new Map(state.nodes.map(n => [n.name, n.id]))

  function resolveNode(query: string): string | null {
    if (nodeIndex.has(query)) return query
    return nameIndex.get(query) ?? null
  }

  const sourceId = resolveNode(args.input.source)
  const targetId = resolveNode(args.input.target)

  if (!sourceId) return errorResult("GRAPH_NODE_NOT_FOUND", `Source not found: ${args.input.source}`, "", "obsidian_graph_path", args.input, [], [])
  if (!targetId) return errorResult("GRAPH_NODE_NOT_FOUND", `Target not found: ${args.input.target}`, "", "obsidian_graph_path", args.input, [], [])

  const g = buildGraphologyFromState(state)
  const path = bidirectional(g, sourceId, targetId)

  if (!path) {
    return errorResult("GRAPH_PATH_NOT_FOUND", `No path from ${args.input.source} to ${args.input.target}`, "The nodes may be in disconnected components", "obsidian_graph_path", args.input, [], [])
  }

  const edgeKinds: AstEdgeKind[] = []
  for (let i = 0; i < path.length - 1; i++) {
    const edgeKey = g.edge(path[i], path[i + 1])
    edgeKinds.push(edgeKey ? (g.getEdgeAttribute(edgeKey, "kind") as AstEdgeKind) : "calls")
  }

  const notePaths = path.map(id => nodeIdToNoteName(id, graphPaths.graphDir))

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_graph_path",
    args: args.input,
    requiredCapabilities: [],
    checkedCapabilities: [],
    data: { source: sourceId, target: targetId, path, edgeKinds, notePaths },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: null,
    error: null,
  }
}
