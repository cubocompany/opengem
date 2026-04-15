import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type BacklinksData = { path: string; backlinks: string[] }

export async function runBacklinksTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { path: string; counts?: boolean; vault?: string }
}): Promise<ResultEnvelope<BacklinksData | null>> {
  if (!args.input.path) {
    return errorResult("INVALID_ARGS", "path is required", "Provide the note path", "obsidian_backlinks", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "backlinks", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { path: args.input.path, backlinks: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
