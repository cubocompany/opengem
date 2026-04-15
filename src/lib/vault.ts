type Shell = (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>

export type VaultInfo = { name: string; path: string }

/**
 * Detect the active vault by calling `obsidian vault`.
 * Returns null if the CLI is unavailable or no vault is active.
 */
export async function detectActiveVault(shell: Shell): Promise<VaultInfo | null> {
  const result = await shell(["obsidian", "vault"])
  if (result.exitCode !== 0 || !result.stdout.trim()) return null

  const lines = result.stdout.trim().split("\n")
  // Output is TSV: name\tbase de conhecimento  path\tD:\obsidian\...  etc.
  const name = lines.find(l => l.startsWith("name\t"))?.replace("name\t", "").trim()
  const path = lines.find(l => l.startsWith("path\t"))?.replace("path\t", "").trim()

  if (!name) return null
  return { name, path: path ?? "" }
}

/**
 * List all known vaults by calling `obsidian vaults`.
 * Returns empty array if CLI unavailable.
 */
export async function listVaults(shell: Shell): Promise<VaultInfo[]> {
  const result = await shell(["obsidian", "vaults"])
  if (result.exitCode !== 0 || !result.stdout.trim()) return []

  return result.stdout
    .trim()
    .split("\n")
    .flatMap(line => {
      const parts = line.split("\t")
      // Each vault is one TSV row: name\tpath\tfiles\tfolders\tsize
      const name = parts[0]?.trim()
      const path = parts[1]?.trim()
      return name ? [{ name, path: path ?? "" }] : []
    })
}
