import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type TagNotesData = { tag: string; notes: string[] }

export async function runTagNotesTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { name: string; vault?: string }
}): Promise<ResultEnvelope<TagNotesData | null>> {
  if (!args.input.name) {
    return errorResult("INVALID_ARGS", "name is required", "Provide a tag name", "obsidian_tag_notes", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "tag", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { tag: args.input.name, notes: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
