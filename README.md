# Obsidian OpenCode Plugin

OpenCode plugin that bundles Obsidian skills metadata and exposes MVP Obsidian CLI-backed tools.

## Requirements

- [OpenCode](https://opencode.ai) installed
- [Obsidian](https://obsidian.md) desktop app running
- [obsidian CLI](https://github.com/obsidianmd/obsidian-cli) installed and on PATH

## Install

### From npm (recommended)

Add the plugin to your `opencode.json`:

```json
{
  "plugin": ["obsidian-opencode-plugin"]
}
```

### Local development

Clone the repository and link it via `.opencode/plugins/`:

```bash
git clone https://github.com/your-org/obsidian-opencode-plugin
cd obsidian-opencode-plugin
bun install
```

Then add to your `opencode.json`:

```json
{
  "plugin": ["/absolute/path/to/obsidian-opencode-plugin/src/index.ts"]
}
```

## Configuration

Pass options in `opencode.json`:

```json
{
  "plugin": [
    ["obsidian-opencode-plugin", {
      "defaultVault": "My Vault"
    }]
  ]
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultVault` | `string` | `null` | Default vault for write operations |

## Skills

The plugin vendors five Obsidian skills into `~/.opencode/skills/obsidian-opencode-plugin-bundled/` (bundled mode) or reads from an existing checkout.

To sync bundled skills from upstream:

```bash
bun run sync:skills
```

To sync from a local checkout:

```bash
bun run sync:skills --source=/path/to/obsidian-skills
```

## Tools

| Tool | Description | Requires CLI | Requires App |
|---|---|---|---|
| `obsidian_env_doctor` | Environment diagnostics | no* | no |
| `obsidian_skills_check` | Validate discoverable skills | no | no |
| `obsidian_read` | Read a note by name or path | yes | yes |
| `obsidian_search` | Search vault content | yes | yes |
| `obsidian_create_note` | Create a new note | yes | yes |
| `obsidian_append_note` | Append text to a note | yes | yes |
| `obsidian_set_property` | Set a frontmatter property | yes | yes |

\* `obsidian_env_doctor` checks whether the CLI is available but does not require it to run.

### Vault resolution

- **Read operations** (`read`, `search`): explicit `vault` arg → `defaultVault` config → active app vault
- **Write operations** (`create`, `append`, `set_property`): explicit `vault` arg → `defaultVault` config → error

### Degraded mode

All tools remain registered when prerequisites are missing. A structured error envelope is returned instead:

```json
{
  "ok": false,
  "error": {
    "code": "CLI_NOT_FOUND",
    "kind": "capability",
    "message": "obsidian CLI is not installed or not on PATH"
  },
  "hint": "Ask OpenCode to use obsidian_env_doctor"
}
```

### Error codes

| Code | Cause |
|---|---|
| `CLI_NOT_FOUND` | `obsidian` binary not on PATH |
| `APP_NOT_RUNNING` | Obsidian desktop app not running |
| `VAULT_REQUIRED` | Write operation with no vault specified |
| `VAULT_NOT_FOUND` | Specified vault does not exist |
| `FILE_OR_PATH_REQUIRED` | Neither `file` nor `path` provided |
| `MUTUALLY_EXCLUSIVE_TARGET` | Both `file` and `path` provided |
| `PATH_OUTSIDE_VAULT` | Path traversal attempt rejected |
| `BUNDLED_SKILLS_OUT_OF_SYNC` | Skills missing from expected path |

## Development

```bash
bun install          # install dependencies
bun test             # run all tests
bun run check        # TypeScript type-check
bun run sync:skills  # sync skills from upstream GitHub
```

## Roadmap

- **v1** (current): runtime compatibility — env doctor, skills check, read, search, create, append, set-property
- **v1.5**: vault helpers, wikilink/frontmatter validation, backlinks, tags, dev tooling
- **v2**: LLM Wiki workflows — source ingestion, page updates, index refresh, answer-with-citations
