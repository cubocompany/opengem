import { errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { loadGraphState, buildGraphologyFromState } from "../lib/graph/graph-store"
import { resolveGraphPaths, nodeIdToNoteName } from "../lib/graph/graph-paths"
import type { ResultEnvelope } from "../lib/types"
import type { GraphNeighborsData, AstEdgeKind } from "../lib/graph/types"

export async function runGraphNeighborsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: {
    nodeId?: string
    name?: string
    vault?: string
    vaultPath?: string
    graphDir?: string
    edgeKinds?: AstEdgeKind[]
  }
  defaultVault: string | null
  activeVault: string | null
  vaultPath: string | null
}): Promise<ResultEnvelope<GraphNeighborsData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Vault required", "Pass vault or configure defaultVault", "obsidian_graph_neighbors", args.input, [], [])
  }

  const vaultPath = args.input.vaultPath ?? args.vaultPath
  if (!vaultPath) {
    return errorResult("VAULT_NOT_FOUND", "Vault filesystem path required", "Run obsidian_graph_index first", "obsidian_graph_neighbors", args.input, [], [])
  }

  const graphPaths = resolveGraphPaths({ vault, vaultPath, graphDir: args.input.graphDir })
  const state = await loadGraphState(graphPaths.statePath)

  if (!state) {
    return errorResult("GRAPH_NOT_INDEXED", "No graph state found", "Run obsidian_graph_index first", "obsidian_graph_neighbors", args.input, [], [])
  }

  // Resolve node
  let nodeId = args.input.nodeId
  if (!nodeId && args.input.name) {
    const match = state.nodes.find(n => n.name === args.input.name || n.id.endsWith(`#${args.input.name}`))
    nodeId = match?.id
  }

  if (!nodeId) {
    return errorResult("GRAPH_NODE_NOT_FOUND", `Node not found: ${args.input.nodeId ?? args.input.name}`, "Use obsidian_graph_query to discover node IDs", "obsidian_graph_neighbors", args.input, [], [])
  }

  const g = buildGraphologyFromState(state)
  if (!g.hasNode(nodeId)) {
    return errorResult("GRAPH_NODE_NOT_FOUND", `Node not in graph: ${nodeId}`, "", "obsidian_graph_neighbors", args.input, [], [])
  }

  const nodeIndex = new Map(state.nodes.map(n => [n.id, n]))
  const kindFilter = new Set(args.input.edgeKinds ?? [])

  const outgoing = g.outEdges(nodeId)
    .map(edgeKey => {
      const edgeKind = g.getEdgeAttribute(edgeKey, "kind") as AstEdgeKind
      if (kindFilter.size > 0 && !kindFilter.has(edgeKind)) return null
      const targetId = g.target(edgeKey)
      return { id: targetId, name: nodeIndex.get(targetId)?.name ?? targetId, edgeKind, notePath: nodeIdToNoteName(targetId, graphPaths.graphDir) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const incoming = g.inEdges(nodeId)
    .map(edgeKey => {
      const edgeKind = g.getEdgeAttribute(edgeKey, "kind") as AstEdgeKind
      if (kindFilter.size > 0 && !kindFilter.has(edgeKind)) return null
      const sourceId = g.source(edgeKey)
      return { id: sourceId, name: nodeIndex.get(sourceId)?.name ?? sourceId, edgeKind, notePath: nodeIdToNoteName(sourceId, graphPaths.graphDir) }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_graph_neighbors",
    args: args.input,
    requiredCapabilities: [],
    checkedCapabilities: [],
    data: { nodeId, incoming, outgoing },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: null,
    error: null,
  }
}
