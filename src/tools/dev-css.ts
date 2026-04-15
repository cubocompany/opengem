import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevCssData = { selector: string; prop?: string; output: string }

export async function runDevCssTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { selector: string; prop?: string }
}): Promise<ResultEnvelope<DevCssData | null>> {
  if (!args.input.selector) {
    return errorResult("INVALID_ARGS", "selector is required", "Provide a CSS selector", "obsidian_dev_css", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "dev:css", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return { ...result, data: result.ok ? { selector: args.input.selector, prop: args.input.prop, output: result.stdout } : null }
}
