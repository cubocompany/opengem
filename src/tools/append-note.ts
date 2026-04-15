import { executeObsidianCli, errorResult } from "../lib/cli"
import { resolvePluginConfig, resolveVault } from "../lib/config"
import { ensureSingleTarget } from "../lib/tool-inputs"
import type { CommandErrorCode, ResultEnvelope } from "../lib/types"

type AppendNoteData = {
  target: { file: string | null; path: string | null }
  appended: boolean
}

export async function runAppendNoteTool(args: {
  shell: (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  input: { file?: string; path?: string; content: string; vault?: string }
  defaultVault: string | null
  activeVault: string | null
}): Promise<ResultEnvelope<AppendNoteData | null>> {
  try {
    ensureSingleTarget(args.input)
  } catch (err) {
    const code = (err as Error).message as CommandErrorCode
    return errorResult(code, (err as Error).message, "Provide exactly one of file or path", "obsidian_append_note", args.input, ["cli", "app", "vault"], ["cli", "app", "vault"])
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
      "obsidian_append_note",
      args.input,
      ["cli", "app", "vault"],
      ["cli", "app", "vault"],
    )
  }

  const result = await executeObsidianCli(args.shell, "append", { ...args.input, vault }, {
    requiredCapabilities: ["cli", "app", "vault"],
    checkedCapabilities: ["cli", "app", "vault"],
  })

  return {
    ...result,
    data: result.ok
      ? { target: { file: args.input.file ?? null, path: args.input.path ?? null }, appended: true }
      : null,
  }
}
