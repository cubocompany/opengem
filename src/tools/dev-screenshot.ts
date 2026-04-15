import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { ResultEnvelope } from "../lib/types"

type DevScreenshotData = { path: string; vault: string }

export async function runDevScreenshotTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { path: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
}): Promise<ResultEnvelope<DevScreenshotData | null>> {
  if (!args.input.path) {
    return errorResult("INVALID_ARGS", "path is required", "Provide output path inside the vault", "obsidian_dev_screenshot", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({ action: "write", inputVault: args.input.vault ?? null, activeVault: args.activeVault, config })

  if (!vault) {
    return errorResult("VAULT_REQUIRED", "Write commands require a vault", "Pass vault or configure defaultVault", "obsidian_dev_screenshot", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const result = await executeObsidianCli(args.shell, "dev:screenshot", { path: args.input.path, vault }, {
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return { ...result, data: result.ok ? { path: args.input.path, vault } : null }
}
