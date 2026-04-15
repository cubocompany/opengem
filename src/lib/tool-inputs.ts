export function ensureSingleTarget(input: { file?: string; path?: string }): void {
  if (!input.file && !input.path) throw new Error("FILE_OR_PATH_REQUIRED")
  if (input.file && input.path) throw new Error("MUTUALLY_EXCLUSIVE_TARGET")
}
