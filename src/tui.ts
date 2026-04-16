import type { TuiPlugin } from "@opencode-ai/plugin/tui"

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(api: Parameters<TuiPlugin>[0], text: string, autoSubmit = true) {
  api.client.tui.appendPrompt({ text }).then(() => {
    if (autoSubmit) api.client.tui.submitPrompt()
  }).catch(() => {
    api.ui.toast({ variant: "error", title: "OpenGem", message: "Failed to send command" })
  })
}

// ── TUI Plugin ────────────────────────────────────────────────────────────────

export const OpenGemTuiPlugin: TuiPlugin = async (api) => {
  api.command.register(() => [
    // ── Graph commands ───────────────────────────────────────────────────────
    {
      title: "Graph: Index this project",
      value: "og:graph:index",
      description: "Parse the codebase with tree-sitter and store a knowledge graph in Obsidian",
      category: "OpenGem",
      slash: { name: "og graph", aliases: ["opengem graph"] },
      onSelect: () => send(api,
        "Index this project into my Obsidian knowledge graph (use obsidian_graph_index with the current directory and my configured vault)"
      ),
    },
    {
      title: "Graph: Find a symbol",
      value: "og:graph:query",
      description: "Search for a function, class, or module in the knowledge graph",
      category: "OpenGem",
      slash: { name: "og find", aliases: ["og query"] },
      onSelect: () => send(api, "Search the code graph for: ", false),
    },
    {
      title: "Graph: Explain connections",
      value: "og:graph:neighbors",
      description: "Show what calls, imports, or is related to a symbol",
      category: "OpenGem",
      slash: { name: "og explain" },
      onSelect: () => send(api, "Explain the connections of this symbol in the code graph: ", false),
    },
    {
      title: "Graph: Trace path between symbols",
      value: "og:graph:path",
      description: "Find the shortest path between two symbols in the graph",
      category: "OpenGem",
      slash: { name: "og path" },
      onSelect: () => send(api, "Find the path in the code graph from ", false),
    },

    // ── Wiki commands ────────────────────────────────────────────────────────
    {
      title: "Wiki: Add article",
      value: "og:wiki:add",
      description: "Ingest a URL into your Obsidian wiki (raw + curated pages)",
      category: "OpenGem",
      slash: { name: "og wiki", aliases: ["opengem wiki"] },
      onSelect: () => send(api, "Add this article to my wiki: ", false),
    },
    {
      title: "Wiki: Search",
      value: "og:wiki:search",
      description: "Search your Obsidian wiki with citations",
      category: "OpenGem",
      slash: { name: "og search", aliases: ["og s"] },
      onSelect: () => send(api, "Search my wiki for: ", false),
    },
    {
      title: "Wiki: Save this answer",
      value: "og:wiki:save",
      description: "Save the last answer as a note in wiki/answers/",
      category: "OpenGem",
      slash: { name: "og save" },
      onSelect: () => send(api,
        "Save the last answer to my Obsidian wiki using obsidian_wiki_save_answer"
      ),
    },
    {
      title: "Wiki: Health check",
      value: "og:wiki:lint",
      description: "Detect broken links, orphan pages, and missing index entries",
      category: "OpenGem",
      slash: { name: "og lint" },
      onSelect: () => send(api,
        "Run obsidian_wiki_lint to check my wiki for broken links and orphan pages"
      ),
    },

    // ── Meta ─────────────────────────────────────────────────────────────────
    {
      title: "OpenGem: Help",
      value: "og:help",
      description: "List all available OpenGem tools and how to use them",
      category: "OpenGem",
      slash: { name: "og help", aliases: ["og", "opengem"] },
      onSelect: () => send(api,
        "List all available OpenGem tools with a brief description and example usage for each one"
      ),
    },
    {
      title: "OpenGem: Environment check",
      value: "og:doctor",
      description: "Verify Obsidian CLI is installed and the app is running",
      category: "OpenGem",
      slash: { name: "og doctor" },
      onSelect: () => send(api,
        "Run obsidian_env_doctor to check my Obsidian setup"
      ),
    },
  ])
}

export default OpenGemTuiPlugin
