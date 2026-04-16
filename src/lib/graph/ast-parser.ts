import { Parser, Language } from "web-tree-sitter"
import { join } from "node:path"

type SupportedLanguage = "javascript" | "typescript" | "python"

const parserCache = new Map<SupportedLanguage, Parser>()
let initPromise: Promise<void> | null = null

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init({
      locateFile: () => join(import.meta.dirname, "../../../node_modules/web-tree-sitter/web-tree-sitter.wasm"),
    })
  }
  return initPromise
}

const wasmPaths: Record<SupportedLanguage, string> = {
  javascript: join(import.meta.dirname, "../../../node_modules/tree-sitter-wasms/out/tree-sitter-javascript.wasm"),
  typescript: join(import.meta.dirname, "../../../node_modules/tree-sitter-wasms/out/tree-sitter-typescript.wasm"),
  python: join(import.meta.dirname, "../../../node_modules/tree-sitter-wasms/out/tree-sitter-python.wasm"),
}

export async function getParser(language: SupportedLanguage): Promise<Parser> {
  if (parserCache.has(language)) return parserCache.get(language)!

  await ensureInit()

  const wasmBuffer = await Bun.file(wasmPaths[language]).arrayBuffer()
  const lang = await Language.load(new Uint8Array(wasmBuffer))
  const parser = new Parser()
  parser.setLanguage(lang)
  parserCache.set(language, parser)
  return parser
}

export function detectLanguage(file: string): SupportedLanguage | null {
  const ext = file.split(".").pop()?.toLowerCase()
  if (ext === "ts" || ext === "tsx") return "typescript"
  if (ext === "js" || ext === "mjs" || ext === "cjs") return "javascript"
  if (ext === "py") return "python"
  return null
}
