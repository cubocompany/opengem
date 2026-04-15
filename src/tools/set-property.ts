import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { ensureSingleTarget } from "../lib/tool-inputs"
import type { CommandErrorCode, ResultEnvelope } from "../lib/types"

type SetPropertyData = {
  property: string
  value: string
  updated: boolean
}

export async function runSetPropertyTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { name: string; value: string; file?: string; path?: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
}): Promise<ResultEnvelope<SetPropertyData | null>> {
  try {
    ensureSingleTarget(args.input)
  } catch (err) {
    const code = (err as Error).message as CommandErrorCode
    return errorResult(code, (err as Error).message, "Provide exactly one of file or path", "obsidian_set_property", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
  }

  const config = resolvePluginConfig({ defaultVault: args.defaultVault })
  const vault = resolveVault({
    action: "write",
    inputVault: args.input.vault ?? null,
    activeVault: args.activeVault,
    config,
  })

  if (!vault) {
    return errorResult(
      "VAULT_REQUIRED",
      "Write commands require a vault",
      "Pass vault or configure defaultVault",
      "obsidian_set_property",
      args.input,
      ["cli", "app", "vault"],
      ["cli", "app", "vault"],
    )
  }

  const result = await executeObsidianCli(args.shell, "property:set", { ...args.input, vault }, {
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return {
    ...result,
    data: result.ok
      ? { property: args.input.name, value: args.input.value, updated: true }
      : null,
  }
}
