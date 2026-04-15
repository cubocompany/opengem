import { executeObsidianCli } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { ResultEnvelope } from "../lib/types"

type SearchData = {
  query: string
  results: string
}

export async function runSearchTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { query: string; limit?: number; vault?: string }
  defaultVault: string | null
  activeVault: string | null
}): Promise<ResultEnvelope<SearchData | null>> {
  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({
    action: "read",
    inputVault: args.input.vault ?? null,
    activeVault: args.activeVault,
    config,
  })

  const cliArgs = { ...args.input, ...(vault ? { vault } : {}) }

  const result = await executeObsidianCli(args.shell, "search", cliArgs, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return {
    ...result,
    data: result.ok ? { query: args.input.query, results: result.stdout } : null,
  }
}
