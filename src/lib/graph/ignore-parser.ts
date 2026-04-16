import ignore from "ignore"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Loads .opengemignore from the root directory (if present) and returns
 * a function that returns true if a relative path should be ignored.
 *
 * Syntax: identical to .gitignore (powered by the `ignore` package).
 */
export function loadIgnoreRules(rootDir: string): (relPath: string) => boolean {
  const ignorePath = join(rootDir, ".opengemignore")
  const ig = ignore()

  // Always skip these regardless of .opengemignore
  ig.add([
    "node_modules/",
    ".git/",
    "dist/",
    "build/",
    ".cache/",
    "__pycache__/",
    ".venv/",
    "venv/",
    "coverage/",
    ".opengem/",
  ])

  if (existsSync(ignorePath)) {
    const content = readFileSync(ignorePath, "utf8")
    ig.add(content)
  }

  return (relPath: string) => ig.ignores(relPath)
}
