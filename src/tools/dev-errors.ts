import { executeObsidianCli } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevErrorsData = { errors: string[] }

export async function runDevErrorsTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { vault?: string }
}): Promise<ResultEnvelope<DevErrorsData | null>> {
  const result = await executeObsidianCli(args.shell, "dev:errors", args.input, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })

  return {
    ...result,
    data: result.ok
      ? { errors: result.stdout.split("\n").map(l => l.trim()).filter(Boolean) }
      : null,
  }
}
