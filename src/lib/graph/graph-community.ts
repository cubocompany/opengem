import louvain from "graphology-communities-louvain"
import type DirectedGraph from "graphology"
import type { CommunityMap } from "./types"

export function detectCommunities(graph: DirectedGraph): CommunityMap {
  if (graph.order === 0) return {}
  try {
    const communities = louvain(graph, { resolution: 1 })
    return communities as CommunityMap
  } catch {
    // Fallback: assign every node to community 0
    const map: CommunityMap = {}
    graph.forEachNode(id => { map[id] = 0 })
    return map
  }
}
