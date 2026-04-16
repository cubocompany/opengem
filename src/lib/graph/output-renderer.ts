/**
 * opengem-out/ — human-readable and interactive outputs from the knowledge graph.
 *
 * Generates three files inside <rootDir>/opengem-out/:
 *   graph.json        — clean export of nodes, edges, and communities
 *   GRAPH_REPORT.md   — Karpathy-style report: god nodes, communities, language stats
 *   graph.html        — self-contained interactive vis.js visualization
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { GraphState } from "./types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function outDir(rootDir: string): string {
  return join(rootDir, "opengem-out")
}

function ensureOutDir(rootDir: string): string {
  const dir = outDir(rootDir)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// ── graph.json ────────────────────────────────────────────────────────────────

function buildGraphJson(state: GraphState) {
  const resolvedEdges = state.edges.filter(e => !e.target.startsWith("__unresolved__"))

  return {
    meta: {
      version: state.version,
      rootDir: state.rootDir,
      indexedAt: state.indexedAt,
      nodeCount: state.nodes.length,
      edgeCount: resolvedEdges.length,
      communityCount: new Set(Object.values(state.communities)).size,
    },
    nodes: state.nodes.map(n => ({
      id: n.id,
      name: n.name,
      kind: n.kind,
      file: n.file,
      line: n.line,
      language: n.language,
      community: state.communities[n.id] ?? 0,
    })),
    edges: resolvedEdges.map(e => ({
      source: e.source,
      target: e.target,
      kind: e.kind,
    })),
  }
}

// ── GRAPH_REPORT.md ───────────────────────────────────────────────────────────

function buildReport(state: GraphState): string {
  const resolvedEdges = state.edges.filter(e => !e.target.startsWith("__unresolved__"))
  const communityIds = new Set(Object.values(state.communities))
  const communityCount = communityIds.size

  // Degree map
  const degree = new Map<string, number>()
  for (const n of state.nodes) degree.set(n.id, 0)
  for (const e of resolvedEdges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }

  // God nodes (top 10 by degree)
  const sorted = [...state.nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
  const godNodes = sorted.slice(0, 10)

  // Language distribution
  const langCount = new Map<string, number>()
  for (const n of state.nodes) {
    langCount.set(n.language, (langCount.get(n.language) ?? 0) + 1)
  }
  const langRows = [...langCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `| ${lang.padEnd(18)} | ${String(count).padStart(6)} |`)
    .join("\n")

  // Community summary (top 5 by size)
  const communityMembers = new Map<number, string[]>()
  for (const [nodeId, comm] of Object.entries(state.communities)) {
    const list = communityMembers.get(comm) ?? []
    list.push(nodeId)
    communityMembers.set(comm, list)
  }
  const topCommunities = [...communityMembers.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)

  const communityRows = topCommunities.map(([id, members]) => {
    const sample = members
      .slice(0, 3)
      .map(nid => state.nodes.find(n => n.id === nid)?.name ?? nid)
      .join(", ")
    return `| ${String(id).padEnd(12)} | ${String(members.length).padStart(7)} | ${sample}${members.length > 3 ? ", …" : ""} |`
  }).join("\n")

  const indexedAt = new Date(state.indexedAt).toLocaleString()

  return `# OpenGem Graph Report

> **Methodology:** Raw sources are the full uncompressed representation of your codebase.
> The knowledge graph is the **distilled, queryable memory** — symbols, relationships, and communities
> extracted once, reused across every AI session. Use \`opengem query\`, \`opengem explain\`, and
> \`opengem path\` instead of reading files. The graph is your token-efficient entry point.

---

## Summary

| Metric | Value |
|---|---|
| Indexed at | ${indexedAt} |
| Root directory | \`${state.rootDir}\` |
| Total symbols | **${state.nodes.length}** |
| Total edges | **${resolvedEdges.length}** |
| Communities | **${communityCount}** |

---

## God Nodes (highest connectivity)

These symbols are the most connected in the graph — change them carefully.

| Symbol | Kind | File | Edges |
|---|---|---|---|
${godNodes.map(n => `| \`${n.name}\` | ${n.kind} | ${n.file}:${n.line} | ${degree.get(n.id) ?? 0} |`).join("\n")}

---

## Communities

Each community is a cluster of closely related symbols detected by the Louvain algorithm.

| Community | Symbols | Sample members |
|---|---|---|
${communityRows}

---

## Language Distribution

| Language | Symbols |
|---|---|
${langRows}

---

## Suggested questions for your AI assistant

- "What calls \`${godNodes[0]?.name ?? "main"}\`?"
- "Explain the connections of \`${godNodes[1]?.name ?? "init"}\`"
- "Find all functions in \`${state.nodes[0]?.file ?? "src/"}\`"
- "What is the path from \`${godNodes[0]?.name ?? "main"}\` to \`${godNodes[godNodes.length - 1]?.name ?? "utils"}\`?"

---

*Generated by [OpenGem](https://github.com/cubocompany/opengem)*
`
}

// ── graph.html (vis.js interactive) ──────────────────────────────────────────

function buildHtml(state: GraphState): string {
  const resolvedEdges = state.edges.filter(e => !e.target.startsWith("__unresolved__"))

  // Degree map for sizing nodes
  const degree = new Map<string, number>()
  for (const n of state.nodes) degree.set(n.id, 1)
  for (const e of resolvedEdges) {
    degree.set(e.source, (degree.get(e.source) ?? 1) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 1) + 1)
  }

  // Community-based color palette
  const communityIds = [...new Set(Object.values(state.communities))]
  const palette = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#bab0ac",
  ]
  const colorMap: Record<number, string> = {}
  communityIds.forEach((id, i) => {
    colorMap[id] = palette[i % palette.length]!
  })

  const kindShape: Record<string, string> = {
    function: "dot",
    method: "dot",
    class: "diamond",
    module: "square",
    variable: "triangleDown",
    section: "star",
  }

  // Limit to top 500 nodes by degree to keep the browser responsive
  const topNodes = [...state.nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, 500)
  const topNodeIds = new Set(topNodes.map(n => n.id))

  const visNodes = topNodes.map(n => {
    const d = degree.get(n.id) ?? 1
    const comm = state.communities[n.id] ?? 0
    return {
      id: n.id,
      label: n.name,
      title: `${n.kind} · ${n.file}:${n.line}`,
      value: d,
      color: colorMap[comm] ?? "#aaa",
      shape: kindShape[n.kind] ?? "dot",
      font: { size: Math.min(12 + d, 22), color: "#fff" },
    }
  })

  const visEdges = resolvedEdges
    .filter(e => topNodeIds.has(e.source) && topNodeIds.has(e.target))
    .slice(0, 2000)
    .map(e => ({
      from: e.source,
      to: e.target,
      label: e.kind,
      arrows: "to",
      color: { opacity: 0.4 },
      font: { size: 9, color: "#aaa", align: "middle" },
    }))

  const nodesJson = JSON.stringify(visNodes)
  const edgesJson = JSON.stringify(visEdges)
  const rootDir = state.rootDir.replace(/\\/g, "/")
  const indexedAt = new Date(state.indexedAt).toLocaleString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenGem Graph — ${rootDir}</title>
  <script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #e6edf3; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { padding: 12px 20px; border-bottom: 1px solid #21262d; display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 15px; font-weight: 600; }
    header small { font-size: 12px; color: #768390; }
    #controls { padding: 8px 20px; border-bottom: 1px solid #21262d; display: flex; gap: 8px; align-items: center; }
    #controls input { background: #161b22; border: 1px solid #30363d; color: #e6edf3; padding: 4px 8px; border-radius: 4px; font-size: 12px; width: 200px; }
    #controls input::placeholder { color: #484f58; }
    #controls button { background: #21262d; border: 1px solid #30363d; color: #e6edf3; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; }
    #controls button:hover { background: #30363d; }
    #graph { height: calc(100vh - 80px); }
    #tooltip { position: fixed; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 8px 12px; font-size: 12px; pointer-events: none; display: none; z-index: 100; }
    #legend { position: fixed; bottom: 16px; right: 16px; background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 10px 14px; font-size: 11px; }
    #legend h3 { font-size: 11px; color: #768390; margin-bottom: 6px; }
    .legend-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  </style>
</head>
<body>
<header>
  <h1>OpenGem Graph</h1>
  <small>${rootDir} · ${state.nodes.length} symbols · ${resolvedEdges.length} edges · indexed ${indexedAt}</small>
</header>
<div id="controls">
  <input id="search" placeholder="Search symbol or file…" />
  <button onclick="resetView()">Reset view</button>
</div>
<div id="graph"></div>
<div id="tooltip"></div>
<div id="legend">
  <h3>Node shapes</h3>
  <div class="legend-row"><div class="legend-dot" style="background:#4e79a7;border-radius:50%"></div>function / method</div>
  <div class="legend-row"><div class="legend-dot" style="background:#4e79a7;border-radius:0;transform:rotate(45deg)"></div>class</div>
  <div class="legend-row"><div class="legend-dot" style="background:#4e79a7;border-radius:2px"></div>module</div>
  <div class="legend-row" style="margin-top:6px;color:#768390;font-size:10px">Size = connectivity</div>
</div>
<script>
const nodes = new vis.DataSet(${nodesJson});
const edges = new vis.DataSet(${edgesJson});

const container = document.getElementById("graph");
const network = new vis.Network(container, { nodes, edges }, {
  physics: {
    enabled: true,
    barnesHut: { gravitationalConstant: -8000, centralGravity: 0.3, springLength: 120, damping: 0.12 },
    stabilization: { iterations: 200 },
  },
  interaction: { hover: true, tooltipDelay: 100, navigationButtons: false, keyboard: true },
  edges: { smooth: { type: "dynamic" } },
  nodes: { scaling: { min: 8, max: 36 } },
});

const tooltip = document.getElementById("tooltip");
network.on("hoverNode", ({ node, pointer }) => {
  const n = nodes.get(node);
  tooltip.innerHTML = "<b>" + n.label + "</b><br>" + n.title;
  tooltip.style.display = "block";
  tooltip.style.left = pointer.DOM.x + 14 + "px";
  tooltip.style.top = pointer.DOM.y + 14 + "px";
});
network.on("blurNode", () => { tooltip.style.display = "none"; });

document.getElementById("search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  nodes.forEach(n => {
    const match = q && (n.label.toLowerCase().includes(q) || n.title.toLowerCase().includes(q));
    nodes.update({ id: n.id, opacity: q ? (match ? 1 : 0.1) : 1, font: { ...n.font, color: q ? (match ? "#fff" : "#333") : "#fff" } });
  });
});

function resetView() {
  network.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
}
</script>
</body>
</html>`
}

// ── Public API ────────────────────────────────────────────────────────────────

export function writeOutputs(state: GraphState): { dir: string; files: string[] } {
  const dir = ensureOutDir(state.rootDir)
  const files: string[] = []

  // graph.json
  const jsonPath = join(dir, "graph.json")
  writeFileSync(jsonPath, JSON.stringify(buildGraphJson(state), null, 2) + "\n", "utf8")
  files.push("opengem-out/graph.json")

  // GRAPH_REPORT.md
  const reportPath = join(dir, "GRAPH_REPORT.md")
  writeFileSync(reportPath, buildReport(state), "utf8")
  files.push("opengem-out/GRAPH_REPORT.md")

  // graph.html
  const htmlPath = join(dir, "graph.html")
  writeFileSync(htmlPath, buildHtml(state), "utf8")
  files.push("opengem-out/graph.html")

  return { dir, files }
}
