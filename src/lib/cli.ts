import type { CommandErrorCode, ResultEnvelope } from "./types"

export function buildObsidianArgs(command: string, args: Record<string, unknown>): string[] {
  if (args.file && args.path) throw new Error("MUTUALLY_EXCLUSIVE_TARGET")

  const flags = Object.entries(args)
    .filter(([, value]) => value !== undefined && value !== null)
    .flatMap(([key, value]) => {
      if (typeof value === "boolean") return value ? [key] : []
      return [`${key}=${String(value)}`]
    })

  return [command, ...flags]
}

export function errorResult(
  code: CommandErrorCode,
  message: string,
  hint: string,
  command = "",
  args: Record<string, unknown> = {},
  requiredCapabilities: string[] = [],
  checkedCapabilities: string[] = [],
): ResultEnvelope<null> {
  return {
    schemaVersion: "1.0",
    ok: false,
    command,
    args,
    requiredCapabilities,
    checkedCapabilities,
    data: null,
    stdout: "",
    stderr: "",
    exitCode: 1,
    hint,
    error: { code, kind: "capability", message },
  }
}

export async function executeObsidianCli(
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>,
  command: string,
  args: Record<string, unknown>,
  meta: {
    requiredCapabilities: string[]
    checkedCapabilities: string[]
    mapError?: (result: { exitCode: number; stderr: string }) => { code: string; kind: string; message: string }
  },
): Promise<ResultEnvelope<null>> {
  const built = buildObsidianArgs(command, args)
  const result = await shell(["obsidian", ...built])

  const mappedError =
    result.exitCode === 0
      ? null
      : (meta.mapError?.({ exitCode: result.exitCode, stderr: result.stderr })
        ?? (result.exitCode === 127
          ? { code: "CLI_NOT_FOUND", kind: "capability", message: "obsidian CLI is not installed or not on PATH" }
          : { code: "COMMAND_NOT_ENABLED", kind: "runtime", message: result.stderr || "CLI command failed" }))

  return {
    schemaVersion: "1.0",
    ok: result.exitCode === 0,
    command: `obsidian_${command.replace(":", "_")}`,
    args,
    requiredCapabilities: meta.requiredCapabilities,
    checkedCapabilities: meta.checkedCapabilities,
    data: null,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    hint: result.exitCode === 0 ? null : "Ask OpenCode to use obsidian_env_doctor",
    error: mappedError as ResultEnvelope<null>["error"],
  }
}
