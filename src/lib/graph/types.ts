// ── AST extraction (language-agnostic intermediate form) ─────────────────────

export type AstNodeKind = "function" | "class" | "module" | "method" | "variable"
export type AstEdgeKind = "calls" | "imports" | "contains" | "inherits" | "defines"

export type AstNode = {
  id: string          // stable: "<relFile>#<name>", e.g. "src/lib/cli.ts#executeObsidianCli"
  kind: AstNodeKind
  name: string
  file: string        // relative to project root
  line: number
  language: "javascript" | "typescript" | "python"
  docComment: string | null
}

export type AstEdge = {
  source: string      // AstNode.id
  target: string      // AstNode.id or "__unresolved__/<symbol>"
  kind: AstEdgeKind
}

// ── Graph state (serialised to JSON on disk) ──────────────────────────────────

export type CommunityMap = Record<string, number>   // nodeId → communityId

export type GraphState = {
  version: "1"
  indexedAt: string                       // ISO timestamp
  rootDir: string                         // absolute path that was indexed
  fileHashes: Record<string, string>      // relPath → SHA256 hex
  nodes: AstNode[]
  edges: AstEdge[]
  communities: CommunityMap
}

// ── Tool output types ─────────────────────────────────────────────────────────

export type GraphNodeSummary = {
  id: string
  kind: AstNodeKind
  name: string
  file: string
  line: number
  community: number
  edgeCount: number
  notePath: string
}

export type GraphNeighborsData = {
  nodeId: string
  incoming: Array<{ id: string; name: string; edgeKind: AstEdgeKind; notePath: string }>
  outgoing: Array<{ id: string; name: string; edgeKind: AstEdgeKind; notePath: string }>
}

export type GraphPathData = {
  source: string
  target: string
  path: string[]          // ordered node IDs
  edgeKinds: AstEdgeKind[]
  notePaths: string[]     // corresponding vault note paths
}

export type GraphQueryData = {
  query: string
  matches: GraphNodeSummary[]
}

export type GraphIndexData = {
  rootDir: string
  filesProcessed: number
  filesSkipped: number    // unchanged (cache hit)
  nodesWritten: number
  edgesTotal: number
  communities: number
  vault: string
}
