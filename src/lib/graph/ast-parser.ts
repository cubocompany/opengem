import { Parser, Language } from "web-tree-sitter"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { readFileSync } from "node:fs"
import { LANGUAGE_CONFIGS, extensionToLanguage } from "./language-configs"

// ── Core language types ───────────────────────────────────────────────────────

/** Languages with dedicated extractors (JS/TS/JSX/TSX/Python) */
export type DedicatedLanguage = "javascript" | "typescript" | "tsx" | "python"

/** All languages supported by the generic extractor */
export type GenericLanguage = keyof typeof LANGUAGE_CONFIGS

/** Union of all supported languages */
export type SupportedLanguage = DedicatedLanguage | GenericLanguage

const DEDICATED: readonly DedicatedLanguage[] = ["javascript", "typescript", "tsx", "python"]

// ── WASM path map ─────────────────────────────────────────────────────────────

// createRequire resolves package paths correctly regardless of bundle nesting depth.
const _require = createRequire(import.meta.url)
const WASM_DIR = join(dirname(_require.resolve("@repomix/tree-sitter-wasms/package.json")), "out")

const WASM_NAME: Record<string, string> = {
  // Dedicated
  javascript: "javascript",
  typescript: "typescript",
  tsx:        "tsx",
  python:     "python",
  // Generic — key must match LANGUAGE_CONFIGS key and the wasm filename
  go:         "go",
  rust:       "rust",
  java:       "java",
  c:          "c",
  cpp:        "cpp",
  ruby:       "ruby",
  kotlin:     "kotlin",
  swift:      "swift",
  lua:        "lua",
  scala:      "scala",
  php:        "php",
  csharp:     "c_sharp",
}

// ── Parser singleton ──────────────────────────────────────────────────────────

const parserCache = new Map<string, Parser>()
let initPromise: Promise<void> | null = null

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: () => join(dirname(_require.resolve("web-tree-sitter")), "web-tree-sitter.wasm"),
    })
  }
  return initPromise
}

export async function getParser(language: string): Promise<Parser> {
  if (parserCache.has(language)) return parserCache.get(language)!

  await ensureInit()

  const wasmName = WASM_NAME[language]
  if (!wasmName) throw new Error(`No WASM mapping for language: ${language}`)

  const wasmPath = join(WASM_DIR, `tree-sitter-${wasmName}.wasm`)
  const wasmBuffer = readFileSync(wasmPath)
  const lang = await Language.load(wasmBuffer)
  const parser = new Parser()
  parser.setLanguage(lang)
  parserCache.set(language, parser)
  return parser
}

// ── Language detection ────────────────────────────────────────────────────────

/** Returns the language key or null if unsupported */
export function detectLanguage(file: string): SupportedLanguage | null {
  const ext = "." + (file.split(".").pop()?.toLowerCase() ?? "")

  // Dedicated extractors first (overlap prevention)
  if (ext === ".ts") return "typescript"
  if (ext === ".tsx") return "tsx"
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "javascript"
  if (ext === ".py") return "python"

  // Generic extractor languages
  return extensionToLanguage(ext) as GenericLanguage | null
}

/** True if this language uses the dedicated extractor */
export function isDedicated(lang: SupportedLanguage): lang is DedicatedLanguage {
  return (DEDICATED as readonly string[]).includes(lang)
}

// ── Document language detection ───────────────────────────────────────────────

export type DocLanguage = "markdown" | "pdf"

/** Returns doc language for non-code files, or null if not a supported doc type */
export function detectDocLanguage(file: string): DocLanguage | null {
  const ext = "." + (file.split(".").pop()?.toLowerCase() ?? "")
  if (ext === ".md" || ext === ".mdx") return "markdown"
  if (ext === ".pdf") return "pdf"
  return null
}
