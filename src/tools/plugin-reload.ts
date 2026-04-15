import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type PluginReloadData = { id: string; reloaded: boolean }

export async function runPluginReloadTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { id: string }
}): Promise<ResultEnvelope<PluginReloadData | null>> {
  if (!args.input.id) {
    return errorResult("INVALID_ARGS", "id is required", "Provide a plugin id", "obsidian_plugin_reload", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "plugin:reload", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok ? { id: args.input.id, reloaded: true } : null,
  }
}
