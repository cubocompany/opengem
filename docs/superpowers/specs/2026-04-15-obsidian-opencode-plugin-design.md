# Obsidian OpenCode Plugin Design

## Summary

Build an OpenCode-native plugin that wraps the existing `obsidian-skills` package with OpenCode commands, runtime helpers, and diagnostics, while keeping `skills/<name>/SKILL.md` as the canonical source of domain knowledge. The plugin should preserve direct skill compatibility, add practical command parity for Obsidian CLI workflows, and create a path toward a persistent “LLM Wiki” workflow inspired by Karpathy's Obsidian knowledge-base pattern.

## Goals

- Preserve compatibility with the existing `obsidian-skills` repository structure.
- Provide an OpenCode plugin that is installable and useful even when users do not manually configure skills paths.
- Expose high-value OpenCode commands and tools for Obsidian vault operations and plugin/theme development.
- Fail gracefully when Obsidian CLI or a running Obsidian instance is unavailable.
- Support a staged roadmap: runtime compatibility first, persistent knowledge workflows second.

## Non-goals

- Replacing OpenCode's native skill discovery system.
- Re-implementing the full semantics of Obsidian Markdown, Bases, or Canvas inside plugin code.
- Replacing the Obsidian CLI.
- Shipping a full LLM wiki system in the first version.

## Context

The upstream `kepano/obsidian-skills` repository already works in OpenCode as a skills package when cloned under `~/.opencode/skills/obsidian-skills`. However, that setup mainly provides promptable skills. It does not provide an OpenCode-native plugin experience with commands, runtime wrappers, installation checks, or structured diagnostics.

The new plugin should therefore treat the upstream skills as the stable content layer and add an OpenCode integration layer on top.

## Chosen approach

### Recommended option: wrapper plugin + canonical skills

Keep the `skills/` directory as the source of truth and add a dedicated OpenCode plugin that:

- bundles or references those skills,
- validates whether they are discoverable,
- exposes OpenCode commands/tools that wrap the `obsidian` CLI,
- adds setup and troubleshooting helpers,
- later expands into wiki maintenance workflows.

This approach was chosen over a plugin-only rewrite because it preserves portability across agent ecosystems and reduces coupling to unstable or underdocumented OpenCode skill/plugin internals.

## Architecture

### Layer 1: canonical skills

These remain content-first, portable, and tool-agnostic:

- `obsidian-markdown`
- `obsidian-bases`
- `json-canvas`
- `obsidian-cli`
- `defuddle`

Responsibilities:

- domain instructions,
- syntax guidance,
- file conventions,
- task routing hints,
- examples and best practices.

### Layer 2: OpenCode plugin

The plugin owns platform integration:

- command registration,
- runtime wrappers over `obsidian` CLI,
- setup/bootstrap helpers,
- environment diagnostics,
- output normalization,
- optional OpenCode hooks/tools where they add clear value.

Responsibilities are intentionally separate: knowledge stays in `SKILL.md`; executable platform behavior lives in the plugin.

## Distribution model

The project should support two compatible modes.

### Bundled mode

The plugin ships with a versioned copy of the relevant skills inside the plugin package and exposes a documented install/sync step that copies those skills into a standard OpenCode-discoverable path.

Use when:

- users want one-step install,
- reproducibility matters,
- the plugin should work with minimal manual setup.

### External mode

The plugin points to an existing skills checkout at `~/.opencode/skills/obsidian-skills` or a user-provided path.

Use when:

- contributors are developing against the upstream repo,
- users already manage their skills separately,
- faster iteration is preferred over packaging simplicity.

### Resolution for v1

For v1, the plugin should support **external mode as the canonical runtime path** and treat bundled mode as a packaging convenience that still materializes skills into a normal OpenCode skills directory. The plugin must not invent a parallel private discovery mechanism.

Precedence for v1:

1. explicit user-configured external path,
2. standard OpenCode path with synced bundled skills,
3. fail with install hint.

The plugin should also expose the skills package version it expects so users can detect drift between the plugin and an external checkout.

### Guiding rule

The plugin must not attempt to replace or emulate OpenCode’s internal skill discovery. It should only detect, validate, and improve the user experience around that discovery.

## OpenCode integration contract

The plugin should distinguish clearly between two integration types.

### OpenCode commands

User-facing commands for direct invocation and discovery.

Examples:

- `obsidian.skills.check`
- `obsidian.env.doctor`
- `obsidian.read`
- `obsidian.search`

### OpenCode tools

Structured operations intended for agent use. Tools should use stable JSON schemas and return structured data whenever possible.

Examples:

- `obsidian_read`
- `obsidian_search`
- `obsidian_create_note`
- `obsidian_append_note`
- `obsidian_set_property`

Hooks are optional and should not be part of the MVP unless a clear, documented OpenCode hook materially improves capability detection or logging.

Commands should remain registered even in degraded mode, but return a structured unavailable response instead of disappearing dynamically. This keeps discovery stable while still capability-gating execution.

### Plugin package shape for v1

The v1 plugin should use the documented OpenCode plugin model:

- a JavaScript/TypeScript module,
- exporting one plugin function,
- optionally importing `Plugin` and `tool` from `@opencode-ai/plugin`,
- registering user-facing commands via event/hook integration and agent-facing tools via the `tool` return object.

The initial project shape should assume:

- `src/index.ts` — plugin entrypoint
- `src/tools/*.ts` — OpenCode tool definitions
- `src/commands/*.ts` — command handlers or command dispatch helpers
- `src/lib/*.ts` — config, CLI execution, diagnostics, sync
- `skills/` — vendored canonical skills metadata

Publishing should target npm for the plugin package. Local development should also work through `.opencode/plugins/`.

## MVP command and tool contracts

The MVP is intentionally limited to commands already evidenced by the upstream `obsidian-cli` skill examples and docs references.

### `obsidian.read` / `obsidian_read`

Purpose: read a note by Obsidian-resolved name or exact path.

Input:

```json
{
  "file": "My Note",
  "path": "folder/note.md",
  "vault": "My Vault"
}
```

Rules:

- require exactly one of `file` or `path`,
- optional `vault`,
- maps to `obsidian read file="..."` or `obsidian read path="..."`.

Structured `data`:

```json
{
  "target": { "file": "My Note", "path": null, "vault": null },
  "content": "# Note content"
}
```

### `obsidian.search` / `obsidian_search`

Purpose: search vault content.

Input:

```json
{
  "query": "search term",
  "limit": 10,
  "vault": "My Vault"
}
```

Rules:

- `query` required,
- `limit` defaults to `10`,
- optional `vault`,
- maps to `obsidian search query="..." limit=10`.

Structured `data`:

```json
{
  "query": "search term",
  "results": []
}
```

### `obsidian.create` / `obsidian_create_note`

Purpose: create a note in a specific vault.

Input:

```json
{
  "name": "New Note",
  "content": "# Hello",
  "template": "Template",
  "vault": "My Vault",
  "silent": true,
  "overwrite": false
}
```

Rules:

- `name` and `content` required for MVP,
- `vault` resolved using write rules,
- maps to `obsidian create name="..." content="..."` plus optional flags.

Structured `data`:

```json
{
  "name": "New Note",
  "created": true,
  "opened": false
}
```

### `obsidian.append` / `obsidian_append_note`

Purpose: append text to an existing note.

Input:

```json
{
  "file": "My Note",
  "path": "folder/note.md",
  "content": "New line",
  "vault": "My Vault"
}
```

Rules:

- require `content`,
- require exactly one of `file` or `path`,
- `vault` resolved using write rules,
- maps to `obsidian append ...`.

Structured `data`:

```json
{
  "target": { "file": "My Note", "path": null },
  "appended": true
}
```

### `obsidian.property.set` / `obsidian_set_property`

Purpose: set a note property/frontmatter field.

Input:

```json
{
  "name": "status",
  "value": "done",
  "file": "My Note",
  "path": "folder/note.md",
  "vault": "My Vault"
}
```

Rules:

- require `name`, `value`, and one target selector,
- maps to `obsidian property:set name="status" value="done" file="My Note"`.

Structured `data`:

```json
{
  "property": "status",
  "value": "done",
  "updated": true
}
```

### `obsidian.skills.check`

Purpose: validate that required skills are discoverable.

Input:

```json
{
  "mode": "external"
}
```

Structured `data`:

```json
{
  "mode": "external",
  "skillsPath": "...",
  "found": ["obsidian-markdown", "obsidian-bases"],
  "missing": []
}
```

### `obsidian.env.doctor`

Purpose: run environment diagnostics.

Input:

```json
{}
```

Structured `data`:

```json
{
  "cliInstalled": true,
  "appRunning": true,
  "defaultVault": "My Vault",
  "skills": {
    "mode": "bundled",
    "inSync": true
  }
}
```

### Stable MVP error codes

MVP command contracts should use a shared error vocabulary:

- `INVALID_ARGS`
- `CLI_NOT_FOUND`
- `APP_NOT_RUNNING`
- `VAULT_REQUIRED`
- `VAULT_NOT_FOUND`
- `FILE_OR_PATH_REQUIRED`
- `MUTUALLY_EXCLUSIVE_TARGET`
- `PATH_OUTSIDE_VAULT`
- `COMMAND_NOT_ENABLED`
- `BUNDLED_SKILLS_OUT_OF_SYNC`

## Primary command surface

The plugin should provide an OpenCode-facing command layer that maps to practical Obsidian workflows.

### Skill and environment commands

- `obsidian.skills.check`
- `obsidian.skills.list`
- `obsidian.skills.install-hint`
- `obsidian.vault.check`
- `obsidian.env.doctor`

### Vault operation commands (v1)

- `obsidian.read`
- `obsidian.create`
- `obsidian.append`
- `obsidian.search`
- `obsidian.property.set`

### Vault operation commands (v1.5+)

- `obsidian.backlinks`
- `obsidian.tags`

### Development and debugging commands (v1.5+)

- `obsidian.plugin.reload`
- `obsidian.dev.errors`
- `obsidian.dev.console`
- `obsidian.dev.screenshot`
- `obsidian.dev.dom`
- `obsidian.dev.css`
- `obsidian.eval`
- `obsidian.dev.mobile`

### Optional convenience command (v1.5+)

- `obsidian.defuddle`

This command surface is designed for practical parity with the workflows encouraged by the upstream `obsidian-cli` skill, but the MVP intentionally limits itself to a smaller set of commands whose behavior and prerequisites are easier to verify.

## Runtime design

### Execution model

Each command goes through a wrapper layer that:

1. validates prerequisites,
2. constructs the corresponding `obsidian` CLI invocation,
3. escapes and quotes parameters safely,
4. executes the command,
5. normalizes stdout/stderr,
6. returns a structured result.

### Result contract

All runtime commands should return a consistent envelope:

```json
{
  "schemaVersion": "1.0",
  "ok": true,
  "command": "obsidian.search",
  "args": {
    "query": "test"
  },
  "requiredCapabilities": ["cli", "app"],
  "checkedCapabilities": ["cli", "app", "vault"],
  "data": {
    "results": []
  },
  "stdout": "...",
  "stderr": "",
  "exitCode": 0,
  "hint": null,
  "error": null
}
```

On failure, `ok` becomes `false` and the payload should include:

```json
{
  "schemaVersion": "1.0",
  "ok": false,
  "error": {
    "code": "CLI_NOT_FOUND",
    "kind": "capability",
    "message": "Obsidian CLI is not installed"
  },
  "hint": "Install the obsidian CLI and rerun obsidian.env.doctor"
}
```

The `data` field should be versioned and structured by command so agents do not need to parse raw `stdout` for common workflows.

### Internal modules

Suggested internal modules:

- `config` — bundled/external mode, skill paths, vault defaults
- `discovery` — locate skills and detect Obsidian CLI
- `commands` — OpenCode command definitions
- `cli` — argument building and process execution
- `diagnostics` — setup validation and human-friendly hints
- `parsers` — structured parsing of CLI responses where useful
- `wiki` — future LLM wiki workflows

## Capability matrix

| Command | Backend | Requires CLI | Requires app running | Requires vault | Writes data | Structured data | Target release |
|---|---|---:|---:|---:|---:|---:|---|
| `obsidian.skills.check` | plugin | no | no | no | no | yes | v1 |
| `obsidian.env.doctor` | plugin | no* | no | no | no | yes | v1 |
| `obsidian.read` | CLI | yes | yes | no** | no | yes | v1 |
| `obsidian.search` | CLI | yes | yes | no** | no | yes | v1 |
| `obsidian.create` | CLI | yes | yes | yes | yes | yes | v1 |
| `obsidian.append` | CLI | yes | yes | yes | yes | yes | v1 |
| `obsidian.property.set` | CLI | yes | yes | yes | yes | yes | v1 |
| `obsidian.backlinks` | CLI | yes | yes | no** | no | yes | v1.5 |
| `obsidian.tags` | CLI | yes | yes | no** | no | yes | v1.5 |
| `obsidian.plugin.reload` | provisional CLI/app tooling | yes | yes | no** | no | yes | v1.5 |
| `obsidian.dev.errors` | provisional CLI/app tooling | yes | yes | no** | no | yes | v1.5 |
| `obsidian.dev.console` | provisional CLI/app tooling | yes | yes | no** | no | yes | v1.5 |
| `obsidian.dev.screenshot` | provisional CLI/app tooling | yes | yes | no** | yes | yes | v1.5 |
| `obsidian.dev.dom` | provisional CLI/app tooling | yes | yes | no** | no | yes | candidate |
| `obsidian.dev.css` | provisional CLI/app tooling | yes | yes | no** | no | yes | candidate |
| `obsidian.eval` | provisional CLI/app tooling | yes | yes | no** | potentially | yes | v2/opt-in |
| `obsidian.dev.mobile` | provisional CLI/app tooling | yes | yes | no** | yes | yes | candidate |

\* `obsidian.env.doctor` does not require the CLI to run, but it checks whether the CLI is available.

\** Read-like commands may use the active vault when available; see vault resolution rules below.

## Error handling

The plugin should explicitly diagnose these cases:

- `obsidian` CLI not installed
- Obsidian app not running when required
- vault not found or not selected
- invalid file/path argument
- unsupported command/config combination
- quoting/encoding issues for spaces and non-ASCII paths
- skills present but not discoverable by OpenCode

Each error should produce:

- short summary,
- likely cause,
- diagnostic hint,
- relevant path/command context when safe to show.

## Security and safety boundaries

The plugin must explicitly enforce these guardrails:

- normalize all paths before execution,
- reject path traversal attempts such as `..` outside the configured vault root,
- restrict write operations to the selected/configured vault,
- redact sensitive absolute paths from logs when unnecessary,
- require explicit opt-in for any dangerous feature such as `eval`,
- avoid defaulting to destructive operations without clear user intent,
- keep diagnostics readable without leaking more environment detail than required.

For v1, `eval` should be excluded from the default enabled command set. It can return in v2 as an opt-in advanced capability.

## Vault resolution rules

Vault selection should be deterministic:

1. explicit vault argument,
2. plugin-configured default vault,
3. active app vault for read-only operations,
4. otherwise error.

For write operations such as `create`, `append`, and `property.set`, the plugin must require either an explicit vault argument or a configured default vault. It must not silently write to whichever vault happens to be active.

## Bundled skills sync policy

When bundled skills are synced into a normal OpenCode skills directory, the plugin must follow these rules:

1. sync to a canonical plugin-managed directory at `~/.opencode/skills/obsidian-opencode-plugin-bundled/`,
2. never overwrite locally modified skill files without explicit user opt-in,
3. warn on version drift between plugin-expected skills and external skills,
4. provide an explicit `obsidian.skills.sync` command instead of silently replacing files.

If an external path is configured, the plugin should prefer warning over mutation.

The sync lifecycle for v1 should be:

- plugin install or upgrade detects version drift,
- plugin warns but does not overwrite,
- user runs `obsidian.skills.sync` to materialize/update bundled skills,
- sync writes a manifest file with plugin version and bundled skills version.

## Degraded mode policy

All commands stay registered for discoverability. If a required capability is missing, execution returns `ok=false` with stable error codes such as:

- `CLI_NOT_FOUND`
- `APP_NOT_RUNNING`
- `VAULT_REQUIRED`
- `VAULT_NOT_FOUND`
- `PATH_OUTSIDE_VAULT`
- `COMMAND_NOT_ENABLED`
- `BUNDLED_SKILLS_OUT_OF_SYNC`

This policy keeps the UX predictable for both users and agents.

## Workflow design

### Normal usage flow

1. User installs the plugin.
2. Plugin detects skills mode: bundled or external.
3. Plugin checks whether Obsidian CLI is available.
4. Plugin checks whether a vault and running app are accessible when needed.
5. Commands are enabled according to capabilities.
6. If runtime dependencies are missing, the plugin remains partially useful and explains why.

### Degraded mode

If runtime integration is unavailable:

- skills should still be usable,
- non-runtime commands should still work,
- the plugin should show installation hints instead of failing opaquely.

## Testing strategy

### Unit tests

- argument building
- shell escaping and quoting
- structured result shaping
- error normalization
- command-to-CLI mapping
- path normalization and traversal rejection

### Integration tests

- mock `obsidian` binary success/failure cases
- vault detection behavior
- paths with spaces and Unicode
- missing binary / missing app / invalid file cases
- bundled mode vs external mode

### Manual verification

At minimum:

- `obsidian.search`
- `obsidian.read`
- `obsidian.create`
- `obsidian.plugin.reload`
- `obsidian.dev.errors`
- `obsidian.dev.screenshot`
- `obsidian.skills.check`

## Success criteria for v1

Version 1 is successful when:

- the skills remain usable in OpenCode,
- the plugin provides practical command wrappers for `read`, `search`, `create`, `append`, and `property.set`,
- missing prerequisites produce useful diagnostics,
- the OpenCode experience is meaningfully better than using raw skills/docs alone,
- the plugin works on Windows paths with spaces and Unicode,
- supported versions are documented for OpenCode, Obsidian, and Obsidian CLI.

## Karpathy-inspired LLM Wiki direction

The Karpathy gist introduces an important product direction beyond command parity: treat Obsidian as a persistent, cumulative knowledge workspace instead of a one-shot retrieval target.

The plugin should reserve a future workflow around three layers:

1. `raw/` — immutable imported sources
2. `wiki/` — maintained markdown knowledge pages
3. `schema/` — conventions, instructions, and metadata rules

This suggests that the plugin should eventually support:

- ingesting sources into a structured vault,
- updating related wiki pages incrementally,
- refreshing an index page,
- appending an audit log,
- answering questions with citations,
- saving useful answers back into the vault,
- checking wiki health for broken links, orphan pages, contradictions, and missing connections.

Ignoring this direction would likely reduce the plugin to a convenient CLI wrapper. Supporting it creates a path toward a compounding knowledge system where Obsidian becomes the visual interface and OpenCode becomes the operational agent.

## Roadmap

### v1: runtime compatibility

- bundled/external skills support
- command wrappers for `skills.check`, `env.doctor`, `read`, `search`, `create`, `append`, and `property.set`
- environment diagnostics
- stable output contract

### v1.5: Obsidian-first usability

- vault detection helpers
- bootstrap recommended vault structure
- wikilink/frontmatter helpers
- stronger `.md`, `.base`, `.canvas` validation
- `backlinks`, `tags`, and validated dev-tooling commands

### Candidate commands pending backend validation

The following commands are explicitly provisional and should not enter the committed roadmap until their real backend behavior is verified against the current Obsidian CLI/app tooling:

- `obsidian.dev.dom`
- `obsidian.dev.css`
- `obsidian.dev.mobile`
- any similar app-automation command not yet confirmed by implementation research

## CLI mapping assumptions for MVP

The MVP should only claim support for commands already evidenced in the upstream skill material:

- `obsidian read`
- `obsidian search`
- `obsidian create`
- `obsidian append`
- `obsidian property:set`

Anything else should be treated as provisional until verified directly against the current Obsidian CLI behavior, argument forms, and output characteristics during implementation.

### v2: LLM Wiki workflows

- source ingestion
- page update workflows
- index refresh
- audit logging
- answer-with-citations
- save-answer-back-to-vault
- wiki linting and contradiction detection
- opt-in advanced capabilities such as `eval`

## Risks

- OpenCode plugin APIs around skills may continue evolving.
- Bundling skills inside plugins may remain less stable than plain filesystem-based discovery.
- Obsidian CLI availability varies by user environment.
- Overloading v1 with wiki automation would delay delivery of the runtime layer users need first.

## Resolved implementation assumptions

- The project should start as a **single repository** containing both plugin code and vendored skills metadata, with external-path support for local development.
- v1 should limit itself to the minimal runtime command set described above.
- The plugin should support an explicit vault default in its own config and allow per-command override.
- v2 wiki workflows should expose both commands and tools: commands for human-triggered maintenance, tools for agent automation.

## Remaining open questions for implementation planning

- What exact OpenCode plugin package shape best supports publishing and local development?
- How should synced bundled skills be updated when the plugin version changes?
- Which v2 wiki operations should be atomic versus batch-oriented?

## Recommendation

Implement the plugin as a wrapper around canonical skills, prioritize runtime parity first, and design the codebase so wiki workflows can be added as a second phase without refactoring the integration layer.
