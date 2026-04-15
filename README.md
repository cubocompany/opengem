# OpenGem

> OpenCode plugin for Obsidian — turn your vault into a compounding knowledge base powered by AI.

OpenGem connects [OpenCode](https://opencode.ai) to your [Obsidian](https://obsidian.md) vault via the official Obsidian CLI. You can read and write notes, build a structured wiki, ingest articles, query with citations, and more — all from natural language inside OpenCode.

## Requirements

- [OpenCode](https://opencode.ai) installed and on PATH
- [Obsidian](https://obsidian.md) desktop app installed and running
- [Obsidian CLI](https://obsidian.md/cli) installed and on PATH (`obsidian --version` should work)

## Install

```bash
npx @cubocompany/opengem init
```

The setup wizard will:
- Check that the Obsidian CLI and app are available
- Let you pick your vault
- Write the config to `~/.opencode/opencode.json` (or your project folder)
- Initialize the wiki folder structure inside your vault

That's it — no JSON editing required.

## Wiki structure

`opengem init` creates the following inside your vault:

```
wiki/
  INDEX.md       ← auto-generated index of all wiki pages
  LOG.md         ← append-only log of every ingest and query
schema/
  SCHEMA.md      ← conventions for wiki pages (edit to customize)
raw/
  .keep          ← original sources go here, untouched
```

Safe to re-run — existing files are skipped unless you pass `force: true` inside OpenCode.

## Usage

Once initialized, just talk to OpenCode naturally:

| What you say | What happens |
|---|---|
| "Add this article to my wiki: https://..." | Fetches, ingests to `raw/` and `wiki/` |
| "What do I know about X?" | Searches wiki, answers with citations, saves to `wiki/answers/` |
| "Update my wiki page on Y" | Rewrites the page with new information |
| "Check my wiki for issues" | Runs lint — broken links, missing metadata |
| "Refresh my wiki index" | Rebuilds `wiki/INDEX.md` |

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultVault` | `string` | auto-detected | Target vault for all operations |

Vault resolution order:
1. Explicit `vault` arg on the tool call
2. `defaultVault` in config
3. Active vault detected via `obsidian vault`
4. If only one vault exists, uses it automatically

## Tools

### Wiki workflows
| Tool | Description |
|---|---|
| `obsidian_wiki_init` | Set up wiki folder structure (run once) |
| `obsidian_wiki_ingest` | Save a source to `raw/` and create a `wiki/` page |
| `obsidian_wiki_update` | Rewrite a wiki page with new content |
| `obsidian_wiki_search_cited` | Search wiki and return results with citations |
| `obsidian_wiki_save_answer` | Save an answer to `wiki/answers/` |
| `obsidian_wiki_refresh_index` | Regenerate `wiki/INDEX.md` |
| `obsidian_wiki_lint` | Check for broken links and missing metadata |

### Vault operations
| Tool | Description |
|---|---|
| `obsidian_read` | Read a note by name or path |
| `obsidian_search` | Search vault content |
| `obsidian_create_note` | Create a new note |
| `obsidian_append_note` | Append text to a note |
| `obsidian_set_property` | Set a frontmatter property |
| `obsidian_backlinks` | List backlinks to a note |
| `obsidian_tags` | List all tags in the vault |
| `obsidian_tag_notes` | List notes with a specific tag |

### Developer tools
| Tool | Description |
|---|---|
| `obsidian_eval` | Execute JavaScript in Obsidian |
| `obsidian_dev_errors` | Show captured errors |
| `obsidian_dev_console` | Show captured console messages |
| `obsidian_dev_screenshot` | Take a screenshot |
| `obsidian_dev_dom` | Query DOM elements |
| `obsidian_dev_css` | Inspect CSS |
| `obsidian_plugins` | List installed plugins |
| `obsidian_plugin_reload` | Reload a plugin |

### Diagnostics
| Tool | Description |
|---|---|
| `obsidian_env_doctor` | Check CLI, app, vault, and skills status |

## Manual config (optional)

If you prefer to configure manually instead of running `init`, add to your `opencode.json`:

```json
{
  "plugin": [
    ["@cubocompany/opengem", {
      "defaultVault": "My Vault"
    }]
  ]
}
```

## Development

```bash
git clone https://github.com/cubocompany/opengem
cd opengem
bun install
bun test          # 121 tests
bun run check     # TypeScript type-check
bun run build     # builds dist/index.js (plugin) and dist/cli.js (init CLI)
```

## License

MIT
