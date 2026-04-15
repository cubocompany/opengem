import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { makeBunSpawnShell } from "./lib/shell"
import { TOOL_MANIFEST } from "./lib/commands"
import { runReadTool } from "./tools/read"
import { runSearchTool } from "./tools/search"
import { runCreateNoteTool } from "./tools/create-note"
import { runAppendNoteTool } from "./tools/append-note"
import { runSetPropertyTool } from "./tools/set-property"
import { runSkillsCheck } from "./tools/skills-check"
import { runEnvDoctor } from "./tools/env-doctor"
import { detectCli, detectApp } from "./lib/capabilities"
import { detectSkillsState } from "./lib/skills"
import { resolvePluginConfig } from "./lib/config"
import { homedir } from "node:os"

const { obsidian_read, obsidian_search, obsidian_create_note, obsidian_append_note, obsidian_set_property, obsidian_skills_check, obsidian_env_doctor } = TOOL_MANIFEST


export const ObsidianPlugin: Plugin = async (_input, options) => {
  const shell = makeBunSpawnShell()
  const config = resolvePluginConfig({
    defaultVault: (options?.defaultVault as string | undefined) ?? null,
  })

  return {
    tool: {
      obsidian_read: tool({
        description: obsidian_read.description,
        args: {
          file: tool.schema.string().optional().describe("Note title or Obsidian file name (without path)"),
          path: tool.schema.string().optional().describe("Exact path relative to vault root"),
          vault: tool.schema.string().optional().describe("Vault name (optional for read operations)"),
        },
        async execute(args) {
          const result = await runReadTool({
            shell,
            input: args,
          })
          return JSON.stringify(result)
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
          const result = await runSearchTool({
            shell,
            input: args,
            defaultVault: config.defaultVault,
            activeVault: null,
          })
          return JSON.stringify(result)
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
          const result = await runCreateNoteTool({
            shell,
            input: args,
            defaultVault: config.defaultVault,
            activeVault: null,
          })
          return JSON.stringify(result)
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
          const result = await runAppendNoteTool({
            shell,
            input: args,
            defaultVault: config.defaultVault,
            activeVault: null,
          })
          return JSON.stringify(result)
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
          const result = await runSetPropertyTool({
            shell,
            input: args,
            defaultVault: config.defaultVault,
            activeVault: null,
          })
          return JSON.stringify(result)
        },
      }),

      obsidian_skills_check: tool({
        description: obsidian_skills_check.description,
        args: {
          mode: tool.schema.enum(["external", "bundled"]).optional().describe("Skills mode to check"),
        },
        async execute(args) {
          const skillsState = await detectSkillsState({
            mode: config.skills.mode,
            explicitPath: config.skills.externalPath,
            homeDir: homedir(),
            syncDirName: config.skills.syncDirName,
          })
          const result = await runSkillsCheck({
            mode: args.mode ?? skillsState.mode,
            skillsPath: skillsState.path,
            requiredSkills: ["obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle"],
          })
          return JSON.stringify(result)
        },
      }),

      obsidian_env_doctor: tool({
        description: obsidian_env_doctor.description,
        args: {},
        async execute() {
          const result = await runEnvDoctor({
            detectCli: () => detectCli(async () => {
              const r = await makeBunSpawnShell()(["obsidian", "--version"])
              return r.exitCode === 0
            }),
            detectApp: () => detectApp(async () => {
              const r = await makeBunSpawnShell()(["obsidian", "status"])
              return r.exitCode === 0
            }),
            detectSkills: async () => {
              const state = await detectSkillsState({
                mode: config.skills.mode,
                explicitPath: config.skills.externalPath,
                homeDir: homedir(),
                syncDirName: config.skills.syncDirName,
              })
              const check = await runSkillsCheck({
                mode: state.mode,
                skillsPath: state.path,
                requiredSkills: ["obsidian-markdown", "obsidian-bases", "json-canvas", "obsidian-cli", "defuddle"],
              })
              return { mode: state.mode, path: state.path, inSync: check.ok }
            },
            defaultVault: config.defaultVault,
          })
          return JSON.stringify(result)
        },
      }),
    },
  }
}

export default ObsidianPlugin
