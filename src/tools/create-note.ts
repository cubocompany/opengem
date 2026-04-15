import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import type { ResultEnvelope } from "../lib/types"

type CreateNoteData = {
  name: string
  created: boolean
  opened: boolean
}

export async function runCreateNoteTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { name: string; content: string; vault?: string; template?: string; silent?: boolean; overwrite?: boolean }
  defaultVault: string | null
  activeVault: string | null
}): Promise<ResultEnvelope<CreateNoteData | null>> {
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
      "obsidian_create_note",
      args.input,
      ["cli", "app", "vault"],
      ["cli", "app", "vault"],
    )
  }

  const result = await executeObsidianCli(args.shell, "create", { ...args.input, vault }, {
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return {
    ...result,
    data: result.ok
      ? { name: args.input.name, created: true, opened: !args.input.silent }
      : null,
  }
}
