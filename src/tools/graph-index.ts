import { mkdirSync, existsSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { buildGraph } from "../lib/graph/graph-builder"
import { buildGraphologyFromState, loadGraphState, saveGraphState, saveGraphSummary } from "../lib/graph/graph-store"
import { detectCommunities } from "../lib/graph/graph-community"
import { renderNodeNote, renderGraphIndex } from "../lib/graph/note-renderer"
import { resolveGraphPaths, nodeIdToNoteName } from "../lib/graph/graph-paths"
import type { AstEdge, GraphState } from "../lib/graph/types"
import type { ResultEnvelope } from "../lib/types"
import type { GraphIndexData } from "../lib/graph/types"

/** Load the local graph state built by `opengem graph` (fast, no re-indexing). */
function loadLocalState(rootDir: string): GraphState | null {
  const path = join(rootDir, ".opengem", "graph-state.json")
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as GraphState
    return parsed.version === "1" ? parsed : null
  } catch { return null }
}

export async function runGraphIndexTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: {
    rootDir: string
    vault?: string
    graphDir?: string
    languages?: string[]
    force?: boolean
    vaultPath?: string
  }
  defaultVault: string | null
  activeVault: string | null
  vaultPath: string | null
}): Promise<ResultEnvelope<GraphIndexData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  // Treat empty string same as null — use defaultVault / active vault fallback
  const inputVault = args.input.vault?.trim() || null
  let vault = resolveVault({ action: "write", inputVault, activeVault: args.activeVault, config })

  if (!vault) {
    // Try auto-detecting from running Obsidian app
    const vaultInfo = await args.shell(["obsidian", "vault"])
    if (vaultInfo.exitCode === 0) {
      vault = vaultInfo.stdout.match(/^name\t(.+)$/m)?.[1]?.trim() ?? null
    }
  }

  if (!vault) {
    return errorResult(
      "VAULT_REQUIRED",
      "Could not resolve vault. Pass vault name or run `opengem init` to configure defaultVault.",
      "Pass vault=<name> or configure defaultVault in opencode.json",
      "obsidian_graph_index",
      args.input,
      ["cli", "app", "vault"],
      ["cli", "app", "vault"],
    )
  }

  let vaultPath = args.input.vaultPath ?? args.vaultPath
  if (!vaultPath) {
    // Auto-detect: `obsidian vault` outputs "path\t<absolute-path>" for the active vault
    const vaultInfo = await args.shell(["obsidian", "vault"])
    if (vaultInfo.exitCode === 0) {
      const match = vaultInfo.stdout.match(/^path\t(.+)$/m)
      if (match) vaultPath = match[1].trim()
    }
  }
  if (!vaultPath) {
    return errorResult(
      "VAULT_NOT_FOUND",
      "Could not detect vault filesystem path. Pass vaultPath explicitly or ensure Obsidian is running.",
      "Run obsidian_env_doctor to check vault detection",
      "obsidian_graph_index",
      args.input,
      ["cli", "app", "vault"],
      ["cli", "app", "vault"],
    )
  }

  const graphPaths = resolveGraphPaths({ vault, vaultPath, graphDir: args.input.graphDir })

  // Ensure .obsidian dir exists for state file
  const stateDir = dirname(graphPaths.statePath)
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true })

  // ── Graph data: prefer local state to avoid re-indexing the whole codebase ──
  // `opengem graph` already built and cached the state in .opengem/graph-state.json.
  // Only re-run buildGraph when force=true or no local state exists.
  let nodes: GraphState["nodes"]
  let edges: GraphState["edges"]
  let fileHashes: GraphState["fileHashes"]
  let filesProcessed: number
  let filesSkipped: number

  const localState = args.input.force ? null : loadLocalState(args.input.rootDir)

  if (localState) {
    // Fast path: reuse already-built graph, no filesystem scanning needed
    nodes = localState.nodes
    edges = localState.edges
    fileHashes = localState.fileHashes
    filesProcessed = 0
    filesSkipped = nodes.length
  } else {
    // Full build (first run or force=true)
    const built = await buildGraph({
      rootDir: args.input.rootDir,
      existing: null,
      languages: args.input.languages,
    })
    nodes = built.nodes
    edges = built.edges
    fileHashes = built.fileHashes
    filesProcessed = built.filesProcessed
    filesSkipped = built.filesSkipped
  }

  // Community detection
  const graphology = buildGraphologyFromState({
    version: "1",
    indexedAt: new Date().toISOString(),
    rootDir: args.input.rootDir,
    fileHashes,
    nodes,
    edges,
    communities: {},
  })
  const communities = detectCommunities(graphology)
  const communityCount = new Set(Object.values(communities)).size

  // Index structures for rendering
  const nodeIndex = new Map(nodes.map(n => [n.id, n]))
  const outgoingByNode = new Map<string, AstEdge[]>()
  const incomingByNode = new Map<string, AstEdge[]>()
  for (const e of edges) {
    if (!e.target.startsWith("__unresolved__")) {
      const out = outgoingByNode.get(e.source) ?? []; out.push(e); outgoingByNode.set(e.source, out)
      const inc = incomingByNode.get(e.target) ?? []; inc.push(e); incomingByNode.set(e.target, inc)
    }
  }

  // Write notes in parallel chunks of 20
  const CHUNK = 20
  for (let i = 0; i < nodes.length; i += CHUNK) {
    const chunk = nodes.slice(i, i + CHUNK)
    await Promise.all(chunk.map(node => {
      const content = renderNodeNote({
        node,
        community: communities[node.id] ?? 0,
        outgoing: outgoingByNode.get(node.id) ?? [],
        incoming: incomingByNode.get(node.id) ?? [],
        nodeIndex,
        graphDir: graphPaths.graphDir,
      })
      const noteName = nodeIdToNoteName(node.id, graphPaths.graphDir)
      return executeObsidianCli(
        args.shell, "create",
        { name: noteName, content, vault, overwrite: true },
        { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
      )
    }))
  }

  // Write graph index note
  const indexContent = renderGraphIndex(graphPaths.graphDir, nodes.length, communityCount, new Date().toISOString())
  await executeObsidianCli(
    args.shell, "create",
    { name: `${graphPaths.graphDir}/INDEX.md`, content: indexContent, vault, overwrite: true },
    { requiredCapabilities: ["cli", "app", "vault"], checkedCapabilities: ["cli", "app", "vault"] },
  )

  const indexedAt = new Date().toISOString()

  // Persist full state to vault
  const state = { version: "1" as const, indexedAt, rootDir: args.input.rootDir, fileHashes, nodes, edges, communities }
  await saveGraphState(graphPaths.statePath, state)

  // Persist lightweight summary to project dir (used by system transform hook)
  await saveGraphSummary(args.input.rootDir, {
    version: "1",
    rootDir: args.input.rootDir,
    indexedAt,
    nodeCount: nodes.length,
    edgeCount: edges.filter(e => !e.target.startsWith("__unresolved__")).length,
    communityCount,
  })

  return {
    schemaVersion: "1.0",
    ok: true,
    command: "obsidian_graph_index",
    args: args.input,
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
    data: { rootDir: args.input.rootDir, filesProcessed, filesSkipped, nodesWritten: nodes.length, edgesTotal: edges.length, communities: communityCount, vault },
    stdout: "",
    stderr: "",
    exitCode: 0,
    hint: `Graph stored in ${graphPaths.graphDir}/. Open Obsidian Graph View and filter by opengem_node: true.`,
    error: null,
  }
}
