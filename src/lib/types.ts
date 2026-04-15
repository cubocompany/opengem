export type SkillsMode = "external" | "bundled"
export type VaultAction = "read" | "write"

export type PluginConfig = {
  defaultVault: string | null
  skills: {
    mode: SkillsMode
    externalPath: string | null
    syncDirName: string
  }
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
