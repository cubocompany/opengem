import { expect, test } from "bun:test"
import { resolveWikiPaths, buildIndexMarkdown, detectBrokenLinks } from "../src/lib/wiki"

// --- resolveWikiPaths ---

test("resolveWikiPaths returns default dirs when not specified", () => {
  const paths = resolveWikiPaths({ vault: "Main" })
  expect(paths.vault).toBe("Main")
  expect(paths.raw).toBe("raw")
  expect(paths.wiki).toBe("wiki")
  expect(paths.schema).toBe("schema")
  expect(paths.answers).toBe("wiki/answers")
  expect(paths.index).toBe("wiki/INDEX.md")
})

test("resolveWikiPaths uses custom dirs when provided", () => {
  const paths = resolveWikiPaths({ vault: "Main", rawDir: "sources", wikiDir: "knowledge", schemaDir: "conventions" })
  expect(paths.raw).toBe("sources")
  expect(paths.wiki).toBe("knowledge")
  expect(paths.schema).toBe("conventions")
  expect(paths.answers).toBe("knowledge/answers")
  expect(paths.index).toBe("knowledge/INDEX.md")
})

// --- buildIndexMarkdown ---

test("buildIndexMarkdown produces sorted wikilinks", () => {
  const pages = ["wiki/zebra.md", "wiki/apple.md", "wiki/mango.md"]
  const md = buildIndexMarkdown(pages)
  const lines = md.split("\n").filter(l => l.startsWith("- "))
  expect(lines[0]).toBe("- [[apple]]")
  expect(lines[1]).toBe("- [[mango]]")
  expect(lines[2]).toBe("- [[zebra]]")
})

test("buildIndexMarkdown strips wiki/ prefix and .md extension", () => {
  const md = buildIndexMarkdown(["wiki/my-page.md"])
  expect(md).toContain("[[my-page]]")
  expect(md).not.toContain("wiki/")
  expect(md).not.toContain(".md")
})

test("buildIndexMarkdown includes header and generated timestamp", () => {
  const md = buildIndexMarkdown(["wiki/a.md"])
  expect(md).toContain("# Wiki Index")
  expect(md).toContain("generated:")
})

test("buildIndexMarkdown handles empty page list", () => {
  const md = buildIndexMarkdown([])
  expect(md).toContain("# Wiki Index")
  expect(md.split("\n").filter(l => l.startsWith("- "))).toHaveLength(0)
})

// --- detectBrokenLinks ---

test("detectBrokenLinks returns empty array when all links resolve", () => {
  const pages = ["wiki/a.md", "wiki/b.md"]
  const links = { "a": ["[[b]]"] }
  const broken = detectBrokenLinks(pages, links)
  expect(broken).toHaveLength(0)
})

test("detectBrokenLinks finds link that has no matching page", () => {
  const pages = ["wiki/a.md"]
  const links = { "a": ["[[missing-page]]"] }
  const broken = detectBrokenLinks(pages, links)
  expect(broken).toHaveLength(1)
  expect(broken[0].source).toBe("a")
  expect(broken[0].link).toBe("[[missing-page]]")
})

test("detectBrokenLinks handles pipe aliases in wikilinks", () => {
  const pages = ["wiki/real-page.md"]
  const links = { "a": ["[[real-page|Display Name]]"] }
  const broken = detectBrokenLinks(pages, links)
  expect(broken).toHaveLength(0)
})

test("detectBrokenLinks returns multiple broken links across sources", () => {
  const pages = ["wiki/a.md"]
  const links = { "a": ["[[gone]]", "[[also-gone]]"], "b": ["[[gone]]"] }
  const broken = detectBrokenLinks(pages, links)
  expect(broken).toHaveLength(3)
})

test("detectBrokenLinks returns empty array on empty links map", () => {
  const pages = ["wiki/a.md", "wiki/b.md"]
  const broken = detectBrokenLinks(pages, {})
  expect(broken).toHaveLength(0)
})
