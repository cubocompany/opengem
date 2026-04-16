/**
 * Manifest of MVP tool IDs with human-facing metadata.
 *
 * NOTE on slash commands: OpenCode plugins register tools and hooks only.
 * Slash commands (e.g. /obsidian.read) live outside the plugin runtime API
 * and are not registered here. This manifest records suggested future slash
 * wrappers for reference, but v1 ships tools only.
 */
export const TOOL_MANIFEST = {
  obsidian_read: {
    label: "Read Obsidian Note",
    description: "Read an Obsidian note by file name or path",
    futureSlashCommand: "obsidian.read",
  },
  obsidian_search: {
    label: "Search Obsidian Vault",
    description: "Search vault content by query string",
    futureSlashCommand: "obsidian.search",
  },
  obsidian_create_note: {
    label: "Create Obsidian Note",
    description: "Create a new note in a vault",
    futureSlashCommand: "obsidian.create",
  },
  obsidian_append_note: {
    label: "Append to Obsidian Note",
    description: "Append text to an existing note",
    futureSlashCommand: "obsidian.append",
  },
  obsidian_set_property: {
    label: "Set Obsidian Note Property",
    description: "Set a frontmatter property on a note",
    futureSlashCommand: "obsidian.property.set",
  },
  obsidian_skills_check: {
    label: "Check Obsidian Skills",
    description: "Validate that required Obsidian skills are discoverable by OpenCode",
    futureSlashCommand: "obsidian.skills.check",
  },
  obsidian_env_doctor: {
    label: "Obsidian Environment Doctor",
    description: "Run environment diagnostics: CLI installed, app running, skills synced",
    futureSlashCommand: "obsidian.env.doctor",
  },

  // v1.5 — vault queries
  obsidian_backlinks: {
    label: "List Backlinks",
    description: "List all notes that link to a given note path",
    futureSlashCommand: "obsidian.backlinks",
  },
  obsidian_tags: {
    label: "List Tags",
    description: "List all tags in the vault, or tags on a specific note",
    futureSlashCommand: "obsidian.tags",
  },
  obsidian_tag_notes: {
    label: "Notes by Tag",
    description: "List all notes that use a specific tag",
    futureSlashCommand: "obsidian.tag.notes",
  },
  obsidian_plugins: {
    label: "List Plugins",
    description: "List all installed Obsidian plugins",
    futureSlashCommand: "obsidian.plugins",
  },
  obsidian_plugin_reload: {
    label: "Reload Plugin",
    description: "Reload an Obsidian plugin by ID without restarting the app",
    futureSlashCommand: "obsidian.plugin.reload",
  },

  // v1.5 — dev tools
  obsidian_dev_errors: {
    label: "Dev: Recent Errors",
    description: "Get recent JavaScript errors from the running Obsidian app",
    futureSlashCommand: "obsidian.dev.errors",
  },
  obsidian_dev_console: {
    label: "Dev: Console Capture",
    description: "Start/stop debug capture or retrieve console output from the running app",
    futureSlashCommand: "obsidian.dev.console",
  },
  obsidian_dev_screenshot: {
    label: "Dev: Screenshot",
    description: "Capture a screenshot of the running Obsidian app to a vault path (PNG)",
    futureSlashCommand: "obsidian.dev.screenshot",
  },
  obsidian_dev_dom: {
    label: "Dev: DOM Inspector",
    description: "Inspect DOM elements by CSS selector (text, count, attribute, or computed CSS)",
    futureSlashCommand: "obsidian.dev.dom",
  },
  obsidian_dev_css: {
    label: "Dev: CSS Inspector",
    description: "Inspect computed CSS properties by CSS selector",
    futureSlashCommand: "obsidian.dev.css",
  },

  // v2.0 — wiki workflows
  obsidian_wiki_init: {
    label: "Wiki: Initialize",
    description: "Set up the wiki folder structure (raw/, wiki/, schema/) with SCHEMA.md, INDEX.md, and LOG.md. Run once per vault to get started.",
    futureSlashCommand: "obsidian.wiki.init",
  },
  obsidian_wiki_ingest: {
    label: "Wiki: Ingest Source",
    description: "Copy a source document into raw/ and create or update its wiki/ page",
    futureSlashCommand: "obsidian.wiki.ingest",
  },
  obsidian_wiki_update: {
    label: "Wiki: Update Page",
    description: "Create or overwrite a wiki/ knowledge page",
    futureSlashCommand: "obsidian.wiki.update",
  },
  obsidian_wiki_refresh_index: {
    label: "Wiki: Refresh Index",
    description: "Rebuild wiki/INDEX.md with links to all wiki pages",
    futureSlashCommand: "obsidian.wiki.refresh-index",
  },
  obsidian_wiki_search_cited: {
    label: "Wiki: Search with Citations",
    description: "Search wiki/ content and return results with source citations",
    futureSlashCommand: "obsidian.wiki.search-cited",
  },
  obsidian_wiki_save_answer: {
    label: "Wiki: Save Answer",
    description: "Save a Q&A answer as a note in wiki/answers/",
    futureSlashCommand: "obsidian.wiki.save-answer",
  },
  obsidian_wiki_lint: {
    label: "Wiki: Health Check",
    description: "Detect broken wikilinks, orphan pages, and missing index entries in wiki/",
    futureSlashCommand: "obsidian.wiki.lint",
  },
  obsidian_eval: {
    label: "Eval (opt-in)",
    description: "Execute JavaScript in the Obsidian app context. Requires evalEnabled in plugin config.",
    futureSlashCommand: "obsidian.eval",
  },

  // v3.0 — code graph
  obsidian_graph_index: {
    label: "Graph: Index Codebase",
    description: "Parse a project directory with tree-sitter, build a knowledge graph, and write one Obsidian note per symbol (function, class, module). Uses SHA-256 caching — only changed files are re-parsed.",
    futureSlashCommand: "obsidian.graph.index",
  },
  obsidian_graph_neighbors: {
    label: "Graph: Node Neighbors",
    description: "Return the direct neighbors of a graph node (by nodeId or symbol name), grouped by edge type (calls, imports, contains, inherits).",
    futureSlashCommand: "obsidian.graph.neighbors",
  },
  obsidian_graph_path: {
    label: "Graph: Shortest Path",
    description: "Find the shortest path between two symbols in the code graph. Accepts node IDs or symbol names.",
    futureSlashCommand: "obsidian.graph.path",
  },
  obsidian_graph_query: {
    label: "Graph: Query",
    description: "Search graph nodes by name, file, kind (function/class/module), or community ID. Returns results sorted by edge count (most connected first).",
    futureSlashCommand: "obsidian.graph.query",
  },
} as const

export type ToolId = keyof typeof TOOL_MANIFEST
