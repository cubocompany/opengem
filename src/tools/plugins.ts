import { executeObsidianCli } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type PluginsData = { plugins: string[] }

export async function runPluginsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
}): Promise<ResultEnvelope<PluginsData | null>> {
  const result = await executeObsidianCli(args.shell, "plugins", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { plugins: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
