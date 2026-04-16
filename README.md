# OpenGem

> OpenCode plugin for Obsidian — wiki knowledge base + code knowledge graph, all from natural language.

OpenGem connects [OpenCode](https://opencode.ai) to your [Obsidian](https://obsidian.md) vault and your codebase. It gives AI assistants (and you) a persistent, queryable memory — both for **written knowledge** (wiki pages, articles, PDFs) and **code structure** (functions, classes, call graphs, imports across 15+ languages).

---

## Requirements

- [OpenCode](https://opencode.ai) installed and on PATH
- [Obsidian](https://obsidian.md) desktop app installed and running
- [Obsidian CLI](https://obsidian.md/cli) installed and on PATH (`obsidian --version` should work)
- [Bun](https://bun.sh) (for the CLI and MCP server)

---

## Quick Start

```bash
npx @cubocompany/opengem init
```

The setup wizard checks prerequisites, lets you pick your vault, writes config to `opencode.json`, and initializes the wiki folder structure — no JSON editing required.

Then, inside any project:

```bash
opengem graph          # index the current directory
opengem watch          # keep the graph live as you code
```

---

## Code Knowledge Graph

OpenGem can parse your source code into a **navigable knowledge graph** — functions, classes, modules, and their relationships (calls, imports, contains). The graph is stored locally at `.opengem/graph-state.json` and updated incrementally.

### Supported languages

| Category | Languages |
|---|---|
| Dedicated extractors | TypeScript, JavaScript, Python |
| Generic extractors | Go, Rust, Java, C, C++, Ruby, Kotlin, Swift, Lua, Scala, PHP, C# |
| Documents | Markdown (`.md`/`.mdx`), PDF |

Markdown headings become `section` nodes; wikilinks and relative links become `imports` edges. PDFs are parsed page-by-page with heading detection.

### CLI commands

```bash
opengem graph [dir]          # index a directory (default: current dir)
opengem watch [dir]          # watch for changes and re-index incrementally
opengem query <search>       # search nodes by name or file
opengem explain <symbol>     # show all connections for a symbol
opengem path <from> <to>     # find the shortest path between two symbols
```

**Examples:**

```bash
# Index just the src/ folder
opengem graph ./src

# Find everything related to "buildGraph"
opengem query buildGraph

# Who calls parseFile, and what does it call?
opengem explain parseFile

# How does the CLI reach the community detection algorithm?
opengem path main detectCommunities
```

**Sample output — `opengem explain buildGraph`:**

```
  buildGraph  (function)  lib/graph/graph-builder.ts:41

  Incoming (3):
    ← calls      cmdGraph       (cli.ts)
    ← calls      runGraphIndexTool  (tools/graph-index.ts)
    ← contains   lib/graph/graph-builder.ts

  Outgoing (8):
    → calls      collectFiles   (lib/graph/graph-builder.ts)
    → calls      getParser      (lib/graph/ast-parser.ts)
    → calls      extractGeneric (lib/graph/ast-generic.ts)
    → calls      detectCommunities  (lib/graph/graph-community.ts)
    ...
```

### Watch mode

```bash
opengem watch ./src
```

Re-indexes only the files that changed (400 ms debounce). On deletion, forces a full re-index to remove stale nodes. Press `Ctrl+C` to stop.

### Git hook

Keep the graph in sync automatically after every commit:

```bash
opengem hooks install     # adds post-commit hook
opengem hooks uninstall   # removes it
```

---

## MCP Server

OpenGem ships a standalone **MCP server** (`opengem-mcp`) that exposes the knowledge graph to any MCP-compatible AI client — Claude Desktop, Cursor, or any other tool that supports the Model Context Protocol.

```bash
npx opengem-mcp
```

### Tools

| Tool | Description |
|---|---|
| `graph_index` | Index a directory into `.opengem/graph-state.json` |
| `graph_query` | Search nodes by name or file path |
| `graph_explain` | Show all connections for a symbol |
| `graph_path` | Find the shortest path between two symbols |

### Setup

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "opengem": {
      "command": "npx",
      "args": ["opengem-mcp"]
    }
  }
}
```

**OpenCode** (`opencode.json` or `~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "opengem": {
      "type": "stdio",
      "command": "npx",
      "args": ["opengem-mcp"]
    }
  }
}
```

Run `opengem mcp` to see the full setup instructions.

---

## AI Tool Integration

Configure OpenGem in all your AI tools at once:

```bash
opengem install            # configure everything (claude + cursor + opencode)
opengem install claude     # add graph instructions to CLAUDE.md
opengem install cursor     # write .cursor/rules
opengem install opencode   # register plugin in opencode.json
```

`install claude` appends a section to your project's `CLAUDE.md` that tells Claude Code how to use the graph CLI for precise codebase lookups — reducing hallucination and broad file searches.

---

## OpenCode Slash Commands

When loaded as an OpenCode plugin, OpenGem registers slash commands directly in the chat UI:

| Command | Action |
|---|---|
| `/og-graph-index` | Index this project's code into your Obsidian graph |
| `/og-find <name>` | Search the code graph for a symbol or file |
| `/og-explain <symbol>` | Explain the connections of a symbol |
| `/og-path <from> <to>` | Find the path between two symbols |
| `/og-wiki-add <url>` | Add an article to your wiki |
| `/og-wiki-search <query>` | Search your wiki |

---

## Wiki

OpenGem builds a structured wiki inside your Obsidian vault where AI can store and retrieve knowledge across sessions.

### Structure

`opengem init` creates:

```
wiki/
  INDEX.md       ← auto-generated index of all wiki pages
  LOG.md         ← append-only log of every ingest and query
schema/
  SCHEMA.md      ← conventions for wiki pages (edit to customize)
raw/
  .keep          ← original sources go here, untouched
```

### Natural language usage

| What you say | What happens |
|---|---|
| "Add this article to my wiki: https://..." | Fetches, ingests to `raw/` and `wiki/` |
| "What do I know about X?" | Searches wiki, answers with citations |
| "Update my wiki page on Y" | Rewrites the page with new information |
| "Check my wiki for issues" | Runs lint — broken links, missing metadata |
| "Refresh my wiki index" | Rebuilds `wiki/INDEX.md` |

---

## OpenCode Tools Reference

### Code graph

| Tool | Description |
|---|---|
| `obsidian_graph_index` | Index a codebase into the Obsidian graph (creates notes per node) |
| `obsidian_graph_query` | Search graph nodes by name, kind, or community |
| `obsidian_graph_neighbors` | List incoming/outgoing edges for a node |
| `obsidian_graph_path` | Find the shortest path between two nodes |

### Wiki

| Tool | Description |
|---|---|
| `obsidian_wiki_init` | Set up wiki folder structure |
| `obsidian_wiki_ingest` | Save a source to `raw/` and create a `wiki/` page |
| `obsidian_wiki_update` | Rewrite a wiki page |
| `obsidian_wiki_search_cited` | Search wiki with citations |
| `obsidian_wiki_save_answer` | Save an answer to `wiki/answers/` |
| `obsidian_wiki_refresh_index` | Regenerate `wiki/INDEX.md` |
| `obsidian_wiki_lint` | Check for broken links and missing metadata |

### Vault

| Tool | Description |
|---|---|
| `obsidian_read` | Read a note |
| `obsidian_search` | Search vault content |
| `obsidian_create_note` | Create a new note |
| `obsidian_append_note` | Append text to a note |
| `obsidian_set_property` | Set a frontmatter property |
| `obsidian_backlinks` | List backlinks to a note |
| `obsidian_tags` | List all tags |
| `obsidian_tag_notes` | List notes with a specific tag |

### Developer & diagnostics

| Tool | Description |
|---|---|
| `obsidian_env_doctor` | Check CLI, app, vault, and skills status |
| `obsidian_eval` | Execute JavaScript in Obsidian |
| `obsidian_dev_errors` | Show captured errors |
| `obsidian_dev_console` | Show captured console messages |
| `obsidian_dev_screenshot` | Take a screenshot |
| `obsidian_dev_dom` | Query DOM elements |
| `obsidian_dev_css` | Inspect CSS |
| `obsidian_plugins` | List installed plugins |
| `obsidian_plugin_reload` | Reload a plugin |

---

## Configuration

Add to `opencode.json` (project) or `~/.config/opencode/opencode.json` (global):

```json
{
  "plugin": [
    ["@cubocompany/opengem", {
      "defaultVault": "My Vault"
    }]
  ]
}
```

Or run `opengem install opencode` to have it written for you.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultVault` | `string` | auto-detected | Target vault for all operations |

Vault resolution order: explicit `vault` arg → `defaultVault` in config → active vault from `obsidian vault` → single vault auto-select.

---

## Development

```bash
git clone https://github.com/cubocompany/opengem
cd opengem
bun install
bun run check     # TypeScript type-check
bun run build     # builds dist/index.js (plugin), dist/cli.js, dist/mcp.js
bun test
```

### Project structure

```
src/
  index.ts              ← OpenCode server plugin (tools + slash commands + context injection)
  cli.ts                ← opengem CLI (graph, watch, query, explain, path, hooks, install, mcp)
  mcp.ts                ← opengem-mcp MCP server
  tui.ts                ← OpenCode TUI plugin
  lib/
    graph/
      ast-parser.ts     ← language detection + tree-sitter parser cache
      ast-js.ts         ← JS/TS dedicated extractor
      ast-py.ts         ← Python dedicated extractor
      ast-generic.ts    ← config-driven extractor for 12 languages
      ast-md.ts         ← Markdown extractor (headings, wikilinks)
      ast-pdf.ts        ← PDF extractor (unpdf/pdfjs)
      language-configs.ts ← per-language node type and name strategy configs
      graph-builder.ts  ← incremental build pipeline (all languages)
      graph-store.ts    ← state persistence + graphology construction
      graph-community.ts ← Louvain community detection
      graph-paths.ts    ← node ID ↔ Obsidian note name conversion
      note-renderer.ts  ← renders graph nodes as Obsidian markdown notes
    wiki.ts / config.ts / cli.ts / types.ts
  tools/                ← individual tool implementations
```

---

## License

MIT
