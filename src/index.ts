import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { makeBunSpawnShell } from "./lib/shell"
import { TOOL_MANIFEST } from "./lib/commands"
import { resolvePluginConfig } from "./lib/config"
import { detectCli, detectApp } from "./lib/capabilities"
import { detectSkillsState } from "./lib/skills"
import { resolveWikiPaths } from "./lib/wiki"
import { homedir } from "node:os"

// v1 tools
import { runReadTool } from "./tools/read"
import { runSearchTool } from "./tools/search"
import { runCreateNoteTool } from "./tools/create-note"
import { runAppendNoteTool } from "./tools/append-note"
import { runSetPropertyTool } from "./tools/set-property"
import { runSkillsCheck } from "./tools/skills-check"
import { runEnvDoctor } from "./tools/env-doctor"

// v1.5 tools
import { runBacklinksTool } from "./tools/backlinks"
import { runTagsTool } from "./tools/tags"
import { runTagNotesTool } from "./tools/tag-notes"
import { runPluginsTool } from "./tools/plugins"
import { runPluginReloadTool } from "./tools/plugin-reload"
import { runDevErrorsTool } from "./tools/dev-errors"
import { runDevConsoleTool } from "./tools/dev-console"
import { runDevScreenshotTool } from "./tools/dev-screenshot"
import { runDevDomTool } from "./tools/dev-dom"
import { runDevCssTool } from "./tools/dev-css"

// v2.0 tools
import { runWikiInitTool } from "./tools/wiki-init"
import { runWikiIngestTool } from "./tools/wiki-ingest"
import { runWikiUpdateTool } from "./tools/wiki-update"
import { runWikiRefreshIndexTool } from "./tools/wiki-refresh-index"
import { runWikiSearchCitedTool } from "./tools/wiki-search-cited"
import { runWikiSaveAnswerTool } from "./tools/wiki-save-answer"
import { runWikiLintTool } from "./tools/wiki-lint"
import { runEvalTool } from "./tools/eval"

// v3.0 tools
import { runGraphIndexTool } from "./tools/graph-index"
import { runGraphNeighborsTool } from "./tools/graph-neighbors"
import { runGraphPathTool } from "./tools/graph-path"
import { runGraphQueryTool } from "./tools/graph-query"

const {
  obsidian_read, obsidian_search, obsidian_create_note, obsidian_append_note,
  obsidian_set_property, obsidian_skills_check, obsidian_env_doctor,
  obsidian_backlinks, obsidian_tags, obsidian_tag_notes, obsidian_plugins,
  obsidian_plugin_reload, obsidian_dev_errors, obsidian_dev_console,
  obsidian_dev_screenshot, obsidian_dev_dom, obsidian_dev_css,
  obsidian_wiki_init, obsidian_wiki_ingest, obsidian_wiki_update, obsidian_wiki_refresh_index,
  obsidian_wiki_search_cited, obsidian_wiki_save_answer, obsidian_wiki_lint,
  obsidian_eval,
  obsidian_graph_index, obsidian_graph_neighbors, obsidian_graph_path, obsidian_graph_query,
} = TOOL_MANIFEST

export const OpenGemPlugin: Plugin = async (_input, options) => {
  const shell = makeBunSpawnShell()
  const config = resolvePluginConfig({
    defaultVault: (options?.defaultVault as string | undefined) ?? null,
    wiki: {
      rawDir: (options?.wikiRawDir as string | undefined) ?? "raw",
      wikiDir: (options?.wikiDir as string | undefined) ?? "wiki",
      schemaDir: (options?.wikiSchemaDir as string | undefined) ?? "schema",
    },
    graph: {
      graphDir: (options?.graphDir as string | undefined) ?? "graph",
    },
    evalEnabled: (options?.evalEnabled as boolean | undefined) ?? false,
  })
  const wikiPaths = resolveWikiPaths({
    vault: config.defaultVault ?? "",
    rawDir: config.wiki.rawDir,
    wikiDir: config.wiki.wikiDir,
    schemaDir: config.wiki.schemaDir,
  })

  return {
    tool: {
      // ── v1 ──────────────────────────────────────────────────────────────
      obsidian_read: tool({
        description: obsidian_read.description,
        args: {
          file: tool.schema.string().optional().describe("Note title or Obsidian file name (without path)"),
          path: tool.schema.string().optional().describe("Exact path relative to vault root"),
          vault: tool.schema.string().optional().describe("Vault name (optional for read operations)"),
        },
        async execute(args) {
          return JSON.stringify(await runReadTool({ shell, input: args }))
        },
      }),

      obsidian_search: tool({
        description: obsidian_search.description,
        args: {
          query: tool.schema.string().describe("Search query"),
          limit: tool.schema.number().optional().describe("Maximum number of results (default 10)"),
          vault: tool.schema.string().optional().describe("Vault name (optional, falls back to active vault)"),
        },
        async execute(args) {
          return JSON.stringify(await runSearchTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null }))
        },
      }),

      obsidian_create_note: tool({
        description: obsidian_create_note.description,
        args: {
          name: tool.schema.string().describe("Note title"),
          content: tool.schema.string().describe("Note content in Markdown"),
          vault: tool.schema.string().optional().describe("Vault name (required if defaultVault is not configured)"),
          template: tool.schema.string().optional().describe("Template name to use"),
          silent: tool.schema.boolean().optional().describe("Skip opening the note after creation"),
          overwrite: tool.schema.boolean().optional().describe("Overwrite if note already exists"),
        },
        async execute(args) {
          return JSON.stringify(await runCreateNoteTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null }))
        },
      }),

      obsidian_append_note: tool({
        description: obsidian_append_note.description,
        args: {
          content: tool.schema.string().describe("Text to append"),
          file: tool.schema.string().optional().describe("Note title or Obsidian file name"),
          path: tool.schema.string().optional().describe("Exact path relative to vault root"),
          vault: tool.schema.string().optional().describe("Vault name (required for write operations)"),
        },
        async execute(args) {
          return JSON.stringify(await runAppendNoteTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null }))
        },
      }),

      obsidian_set_property: tool({
        description: obsidian_set_property.description,
        args: {
          name: tool.schema.string().describe("Property (frontmatter field) name"),
          value: tool.schema.string().describe("Value to set"),
          file: tool.schema.string().optional().describe("Note title or Obsidian file name"),
          path: tool.schema.string().optional().describe("Exact path relative to vault root"),
          vault: tool.schema.string().optional().describe("Vault name (required for write operations)"),
        },
        async execute(args) {
          return JSON.stringify(await runSetPropertyTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null }))
        },
      }),

      obsidian_skills_check: tool({
        description: obsidian_skills_check.description,
        args: {
          mode: tool.schema.enum(["external", "bundled"]).optional().describe("Skills mode to check"),
        },
        async execute(args) {
          const skillsState = await detectSkillsState({ mode: config.skills.mode, explicitPath: config.skills.externalPath, homeDir: homedir(), syncDirName: config.skills.syncDirName })
          return JSON.stringify(await runSkillsCheck({ mode: args.mode ?? skillsState.mode, skillsPath: skillsState.path, requiredSkills: ["obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle"] }))
        },
      }),

      obsidian_env_doctor: tool({
        description: obsidian_env_doctor.description,
        args: {},
        async execute() {
          return JSON.stringify(await runEnvDoctor({
            detectCli: () => detectCli(async () => (await makeBunSpawnShell()(["obsidian", "--version"])).exitCode === 0),
            detectApp: () => detectApp(async () => (await makeBunSpawnShell()(["obsidian", "vault"])).exitCode === 0),
            detectSkills: async () => {
              const state = await detectSkillsState({ mode: config.skills.mode, explicitPath: config.skills.externalPath, homeDir: homedir(), syncDirName: config.skills.syncDirName })
              const check = await runSkillsCheck({ mode: state.mode, skillsPath: state.path, requiredSkills: ["obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle"] })
              return { mode: state.mode, path: state.path, inSync: check.ok }
            },
            defaultVault: config.defaultVault,
          }))
        },
      }),

      // ── v1.5 ────────────────────────────────────────────────────────────
      obsidian_backlinks: tool({
        description: obsidian_backlinks.description,
        args: {
          path: tool.schema.string().describe("Note path relative to vault root"),
          counts: tool.schema.boolean().optional().describe("Include link counts"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runBacklinksTool({ shell, input: args }))
        },
      }),

      obsidian_tags: tool({
        description: obsidian_tags.description,
        args: {
          path: tool.schema.string().optional().describe("Scope tags to a single note path"),
          counts: tool.schema.boolean().optional().describe("Include usage counts"),
          sort: tool.schema.string().optional().describe("Sort order: count or name"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runTagsTool({ shell, input: args }))
        },
      }),

      obsidian_tag_notes: tool({
        description: obsidian_tag_notes.description,
        args: {
          name: tool.schema.string().describe("Tag name (without leading #)"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runTagNotesTool({ shell, input: args }))
        },
      }),

      obsidian_plugins: tool({
        description: obsidian_plugins.description,
        args: { vault: tool.schema.string().optional() },
        async execute(args) {
          return JSON.stringify(await runPluginsTool({ shell, input: args }))
        },
      }),

      obsidian_plugin_reload: tool({
        description: obsidian_plugin_reload.description,
        args: {
          id: tool.schema.string().describe("Plugin ID as shown in community plugin settings"),
        },
        async execute(args) {
          return JSON.stringify(await runPluginReloadTool({ shell, input: args }))
        },
      }),

      obsidian_dev_errors: tool({
        description: obsidian_dev_errors.description,
        args: { vault: tool.schema.string().optional() },
        async execute(args) {
          return JSON.stringify(await runDevErrorsTool({ shell, input: args }))
        },
      }),

      obsidian_dev_console: tool({
        description: obsidian_dev_console.description,
        args: {
          action: tool.schema.enum(["start", "stop", "get"]).describe("start/stop capture or get output"),
          limit: tool.schema.number().optional().describe("Max lines to return (get action only)"),
        },
        async execute(args) {
          return JSON.stringify(await runDevConsoleTool({ shell, input: args }))
        },
      }),

      obsidian_dev_screenshot: tool({
        description: obsidian_dev_screenshot.description,
        args: {
          path: tool.schema.string().describe("Output path inside the vault (e.g. shots/home.png)"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runDevScreenshotTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null }))
        },
      }),

      obsidian_dev_dom: tool({
        description: obsidian_dev_dom.description,
        args: {
          selector: tool.schema.string().describe("CSS selector to target"),
          mode: tool.schema.enum(["text", "all", "total"]).optional(),
          attr: tool.schema.string().optional().describe("Attribute name to read"),
          css: tool.schema.string().optional().describe("CSS property to read"),
        },
        async execute(args) {
          return JSON.stringify(await runDevDomTool({ shell, input: args }))
        },
      }),

      obsidian_dev_css: tool({
        description: obsidian_dev_css.description,
        args: {
          selector: tool.schema.string().describe("CSS selector"),
          prop: tool.schema.string().optional().describe("Specific CSS property name"),
        },
        async execute(args) {
          return JSON.stringify(await runDevCssTool({ shell, input: args }))
        },
      }),

      // ── v2.0 ────────────────────────────────────────────────────────────
      obsidian_wiki_init: tool({
        description: obsidian_wiki_init.description,
        args: {
          vault: tool.schema.string().optional().describe("Target vault (required if defaultVault is not configured)"),
          force: tool.schema.boolean().optional().describe("Overwrite SCHEMA.md and INDEX.md if they already exist"),
        },
        async execute(args) {
          return JSON.stringify(await runWikiInitTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_wiki_ingest: tool({
        description: obsidian_wiki_ingest.description,
        args: {
          sourceName: tool.schema.string().describe("Source document name (becomes raw/<name> and wiki/<name>)"),
          sourceContent: tool.schema.string().describe("Raw source content (immutable)"),
          wikiContent: tool.schema.string().describe("Wiki summary/knowledge content"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runWikiIngestTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_wiki_update: tool({
        description: obsidian_wiki_update.description,
        args: {
          pageName: tool.schema.string().describe("Wiki page name (stored under wiki/)"),
          content: tool.schema.string().describe("Full page content in Markdown"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runWikiUpdateTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_wiki_refresh_index: tool({
        description: obsidian_wiki_refresh_index.description,
        args: { vault: tool.schema.string().optional() },
        async execute(args) {
          return JSON.stringify(await runWikiRefreshIndexTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_wiki_search_cited: tool({
        description: obsidian_wiki_search_cited.description,
        args: {
          query: tool.schema.string().describe("Search query scoped to wiki/"),
          limit: tool.schema.number().optional(),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runWikiSearchCitedTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_wiki_save_answer: tool({
        description: obsidian_wiki_save_answer.description,
        args: {
          question: tool.schema.string().describe("The question being answered"),
          answer: tool.schema.string().describe("The answer content in Markdown"),
          tags: tool.schema.array(tool.schema.string()).optional().describe("Optional tags for the answer note"),
          vault: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runWikiSaveAnswerTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_wiki_lint: tool({
        description: obsidian_wiki_lint.description,
        args: { vault: tool.schema.string().optional() },
        async execute(args) {
          return JSON.stringify(await runWikiLintTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, wikiPaths }))
        },
      }),

      obsidian_eval: tool({
        description: obsidian_eval.description,
        args: {
          code: tool.schema.string().describe("JavaScript code to execute in the Obsidian app context"),
        },
        async execute(args) {
          return JSON.stringify(await runEvalTool({ shell, input: args, evalEnabled: config.evalEnabled }))
        },
      }),

      // ── v3.0 — code graph ─────────────────────────────────────────────────
      obsidian_graph_index: tool({
        description: obsidian_graph_index.description,
        args: {
          rootDir: tool.schema.string().describe("Absolute path to the project directory to index"),
          vault: tool.schema.string().optional().describe("Vault name (defaults to configured defaultVault)"),
          vaultPath: tool.schema.string().optional().describe("Absolute filesystem path to the vault (required for state persistence)"),
          graphDir: tool.schema.string().optional().describe("Vault-relative folder for graph notes (default: graph)"),
          languages: tool.schema.array(tool.schema.string()).optional().describe("Languages to index: typescript, javascript, python (default: all)"),
          force: tool.schema.boolean().optional().describe("Re-parse all files ignoring cache"),
        },
        async execute(args) {
          return JSON.stringify(await runGraphIndexTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, vaultPath: null }))
        },
      }),

      obsidian_graph_neighbors: tool({
        description: obsidian_graph_neighbors.description,
        args: {
          nodeId: tool.schema.string().optional().describe("Exact node ID (e.g. src/lib/cli.ts#executeObsidianCli)"),
          name: tool.schema.string().optional().describe("Symbol name (fuzzy lookup)"),
          vault: tool.schema.string().optional(),
          vaultPath: tool.schema.string().optional().describe("Absolute filesystem path to the vault"),
          graphDir: tool.schema.string().optional(),
          edgeKinds: tool.schema.array(tool.schema.string()).optional().describe("Filter by edge type: calls, imports, contains, inherits, defines"),
        },
        async execute(args) {
          return JSON.stringify(await runGraphNeighborsTool({ shell, input: args as Parameters<typeof runGraphNeighborsTool>[0]["input"], defaultVault: config.defaultVault, activeVault: null, vaultPath: null }))
        },
      }),

      obsidian_graph_path: tool({
        description: obsidian_graph_path.description,
        args: {
          source: tool.schema.string().describe("Source node ID or symbol name"),
          target: tool.schema.string().describe("Target node ID or symbol name"),
          vault: tool.schema.string().optional(),
          vaultPath: tool.schema.string().optional().describe("Absolute filesystem path to the vault"),
          graphDir: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runGraphPathTool({ shell, input: args, defaultVault: config.defaultVault, activeVault: null, vaultPath: null }))
        },
      }),

      obsidian_graph_query: tool({
        description: obsidian_graph_query.description,
        args: {
          query: tool.schema.string().describe("Text to match against symbol name or file path"),
          kind: tool.schema.string().optional().describe("Filter by node kind: function, class, module, method, variable"),
          community: tool.schema.number().optional().describe("Filter by community ID"),
          file: tool.schema.string().optional().describe("Filter to nodes in a specific file (substring match)"),
          limit: tool.schema.number().optional().describe("Maximum results (default 20)"),
          vault: tool.schema.string().optional(),
          vaultPath: tool.schema.string().optional().describe("Absolute filesystem path to the vault"),
          graphDir: tool.schema.string().optional(),
        },
        async execute(args) {
          return JSON.stringify(await runGraphQueryTool({ shell, input: args as Parameters<typeof runGraphQueryTool>[0]["input"], defaultVault: config.defaultVault, activeVault: null, vaultPath: null }))
        },
      }),
    },
  }
}

export default OpenGemPlugin
