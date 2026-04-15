export type Shell = (cmd: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>

/**
 * Production shell adapter using Bun.spawn.
 * Passes argv elements directly — no shell interpretation, safe for spaces and
 * non-ASCII characters in file names and vault names.
 * Returns exitCode 127 and the error message when the binary is not found.
 */
export function makeBunSpawnShell(): Shell {
  return async (cmd: string[]) => {
    try {
      const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" })
      const stdout = await new Response(proc.stdout).text()
      const stderr = await new Response(proc.stderr).text()
      const exitCode = await proc.exited
      return { exitCode, stdout, stderr }
    } catch (err) {
      return { exitCode: 127, stdout: "", stderr: String(err) }
    }
  }
}
