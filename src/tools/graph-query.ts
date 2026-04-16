import { errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { loadGraphState, buildDegreeMap } from "../lib/graph/graph-store"
import { resolveGraphPaths, nodeIdToNoteName } from "../lib/graph/graph-paths"
import type { ResultEnvelope } from "../lib/types"
import type { GraphQueryData, GraphNodeSummary, AstNodeKind } from "../lib/graph/types"

export async function runGraphQueryTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: {
    query: string
    kind?: AstNodeKind
    community?: number
    file?: string
    limit?: number
    vault?: string
    vaultPath?: string
    graphDir?: string
  }
  defaultVault: string | null
  activeVault: string | null
  vaultPath: string | null
}): Promise<ResultEnvelope<GraphQueryData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "read", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Vault required", "Pass vault or configure defaultVault", "obsidian_graph_query", args.input, [], [])
  }

  const vaultPath = args.input.vaultPath ?? args.vaultPath
  if (!vaultPath) {
    return errorResult("VAULT_NOT_FOUND", "Vault filesystem path required", "Run obsidian_graph_index first", "obsidian_graph_query", args.input, [], [])
  }

  const graphPaths = resolveGraphPaths({ vault, vaultPath, graphDir: args.input.graphDir })
  const state = await loadGraphState(graphPaths.statePath)

  if (!state) {
    return errorResult("GRAPH_NOT_INDEXED", "No graph state found", "Run obsidian_graph_index first", "obsidian_graph_query", args.input, [], [])
  }

  const degrees = buildDegreeMap(state.nodes, state.edges)
  const q = args.input.query.toLowerCase()
  const limit = args.input.limit ?? 20

  const matches: GraphNodeSummary[] = state.nodes
    .filter(node => {
      if (q && !node.name.toLowerCase().includes(q) && !node.file.toLowerCase().includes(q)) return false
      if (args.input.kind && node.kind !== args.input.kind) return false
      if (args.input.community !== undefined && state.communities[node.id] !== args.input.community) return false
      if (args.input.file && !node.file.includes(args.input.file)) return false
      return true
    })
    .sort((a, b) => (degrees.get(b.id) ?? 0) - (degrees.get(a.id) ?? 0))
    .slice(0, limit)
    .map(node => ({
      id: node.id,
      kind: node.kind,
      name: node.name,
      file: node.file,
      line: node.line,
      community: state.communities[node.id] ?? 0,
      edgeCount: degrees.get(node.id) ?? 0,
      notePath: nodeIdToNoteName(node.id, graphPaths.graphDir),
    }))

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_graph_query",
    args: args.input,
    requiredCapabilities: [],
    checkedCapabilities: [],
    data: { query: args.input.query, matches },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: matches.length === 0 ? "No matches found. Try a shorter query or omit filters." : null,
    error: null,
  }
}
