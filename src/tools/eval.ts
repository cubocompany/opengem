import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type EvalData = { result: string }

export async function runEvalTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { code: string }
  evalEnabled: boolean
}): Promise<ResultEnvelope<EvalData | null>> {
  if (!args.evalEnabled) {
    return errorResult("EVAL_DISABLED", "obsidian_eval is disabled", "Set evalEnabled: true in plugin options to opt in", "obsidian_eval", args.input, ["cli", "app"], [])
  }

  if (!args.input.code) {
    return errorResult("INVALID_ARGS", "code is required", "Provide JavaScript code to evaluate", "obsidian_eval", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "eval", { code: args.input.code }, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return { ...result, data: result.ok ? { result: result.stdout } : null }
}
