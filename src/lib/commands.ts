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
} as const

export type ToolId = keyof typeof TOOL_MANIFEST
