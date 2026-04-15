import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevDomData = { selector: string; output: string }

export async function runDevDomTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { selector: string; mode?: "text" | "all" | "total"; attr?: string; css?: string }
}): Promise<ResultEnvelope<DevDomData | null>> {
  if (!args.input.selector) {
    return errorResult("INVALID_ARGS", "selector is required", "Provide a CSS selector", "obsidian_dev_dom", args.input, ["cli", "app"], ["cli", "app"])
  }

  const { selector, mode, attr, css } = args.input
  const cliArgs: Record<string, unknown> = { selector }
  if (mode && ["text", "all", "total"].includes(mode)) cliArgs[mode] = true
  if (attr) cliArgs["attr"] = attr
  if (css) cliArgs["css"] = css

  const result = await executeObsidianCli(args.shell, "dev:dom", cliArgs, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return { ...result, data: result.ok ? { selector, output: result.stdout } : null }
}
