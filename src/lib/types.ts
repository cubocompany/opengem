export type SkillsMode = "external" | "bundled"
export type VaultAction = "read" | "write"

export type WikiConfig = {
  rawDir: string
  wikiDir: string
  schemaDir: string
}

export type PluginConfig = {
  defaultVault: string | null
  skills: {
    mode: SkillsMode
    externalPath: string | null
    syncDirName: string
  }
  wiki: WikiConfig
  evalEnabled: boolean
}

export type CommandErrorCode =
  | "INVALID_ARGS"
  | "CLI_NOT_FOUND"
  | "APP_NOT_RUNNING"
  | "VAULT_REQUIRED"
  | "VAULT_NOT_FOUND"
  | "FILE_OR_PATH_REQUIRED"
  | "MUTUALLY_EXCLUSIVE_TARGET"
  | "PATH_OUTSIDE_VAULT"
  | "COMMAND_NOT_ENABLED"
  | "BUNDLED_SKILLS_OUT_OF_SYNC"
  | "WIKI_PATH_CONFLICT"
  | "EVAL_DISABLED"

export type ResultEnvelope<TData = unknown> = {
  schemaVersion: "1.0"
  ok: boolean
  command: string
  args: Record<string, unknown>
  requiredCapabilities: string[]
  checkedCapabilities: string[]
  data: TData
  stdout: string
  stderr: string
  exitCode: number
  hint: string | null
  error: null | { code: CommandErrorCode; kind: string; message: string }
}
