import { join } from "node:path"

export type GraphPaths = {
  vault: string
  vaultPath: string    // absolute filesystem path to vault
  graphDir: string     // vault-relative folder for notes, e.g. "graph"
  statePath: string    // absolute: "<vaultPath>/.obsidian/opengem-graph.json"
}

export function resolveGraphPaths(args: {
  vault: string
  vaultPath: string
  graphDir?: string
}): GraphPaths {
  const graphDir = args.graphDir ?? "graph"
  return {
    vault: args.vault,
    vaultPath: args.vaultPath,
    graphDir,
    statePath: join(args.vaultPath, ".obsidian", "opengem-graph.json"),
  }
}

/** "src/lib/cli.ts#executeObsidianCli" → "graph/src-lib-cli-ts--executeObsidianCli.md" */
export function nodeIdToNoteName(nodeId: string, graphDir: string): string {
  const slug = nodeId
    .replace(/#/g, "--")
    .replace(/\//g, "-")
    .replace(/\./g, "-")
    .replace(/[^a-zA-Z0-9_\-]/g, "")
    .replace(/-{3,}/g, "--")
    .slice(0, 120)
  return `${graphDir}/${slug}.md`
}

/** Inverse: extract the node id encoded in a note name (best-effort) */
export function noteNameToNodeId(noteName: string, graphDir: string): string | null {
  const prefix = `${graphDir}/`
  if (!noteName.startsWith(prefix)) return null
  return noteName.slice(prefix.length).replace(/\.md$/, "")
}
