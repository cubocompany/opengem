import { executeObsidianCli } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type TagsData = { tags: string[] }

export async function runTagsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { path?: string; counts?: boolean; sort?: string; vault?: string }
}): Promise<ResultEnvelope<TagsData | null>> {
  const result = await executeObsidianCli(args.shell, "tags", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { tags: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
