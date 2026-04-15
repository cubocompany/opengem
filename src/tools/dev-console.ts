import { executeObsidianCli, errorResult } from "../lib/cli"
import type { ResultEnvelope } from "../lib/types"

type DevConsoleData = { action: string; output?: string }

export async function runDevConsoleTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { action: "start" | "stop" | "get"; limit?: number }
}): Promise<ResultEnvelope<DevConsoleData | null>> {
  const { action, limit } = args.input

  if (action !== "start" && action !== "stop" && action !== "get") {
    return errorResult("INVALID_ARGS", "action must be start, stop, or get", "Use start, stop, or get", "obsidian_dev_console", args.input, ["cli", "app"], ["cli", "app"])
  }

  if (action === "get") {
    const cliArgs = limit !== undefined ? { limit } : {}
    const result = await executeObsidianCli(args.shell, "dev:console", cliArgs, {
      requiredCapabilities: ["cli", "app"],
      checkedCapabilities: ["cli", "app"],
    })
    return { ...result, data: result.ok ? { action: "get", output: result.stdout } : null }
  }

  // start/stop → dev:debug on/off (positional arg, not key=value)
  const onOff = action === "start" ? "on" : "off"
  const shell = args.shell
  const result = await executeObsidianCli(
    async (cmd) => shell([...cmd, onOff]),
    "dev:debug",
    {},
    { requiredCapabilities: ["cli", "app"], checkedCapabilities: ["cli", "app"] },
  )
  return { ...result, data: result.ok ? { action } : null }
}
