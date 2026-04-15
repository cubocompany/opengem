import { executeObsidianCli, errorResult } from "../lib/cli"
import { ensureSingleTarget } from "../lib/tool-inputs"
import type { CommandErrorCode, ResultEnvelope } from "../lib/types"

type ReadData = {
  target: { file: string | null; path: string | null; vault: string | null }
  content: string
}

export async function runReadTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { file?: string; path?: string; vault?: string }
}): Promise<ResultEnvelope<ReadData | null>> {
  try {
    ensureSingleTarget(args.input)
  } catch (err) {
    const code = (err as Error).message as CommandErrorCode
    return errorResult(code, (err as Error).message, "Provide exactly one of file or path", "obsidian_read", args.input, ["cli", "app"], ["cli", "app"])
  }

  const result = await executeObsidianCli(args.shell, "read", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return {
    ...result,
    data: {
      target: {
        file: args.input.file ?? null,
        path: args.input.path ?? null,
        vault: args.input.vault ?? null,
      },
      content: result.stdout,
    },
  }
}
