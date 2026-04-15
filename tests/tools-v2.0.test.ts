import { expect, test } from "bun:test"
import { runWikiIngestTool } from "../src/tools/wiki-ingest"
import { runWikiUpdateTool } from "../src/tools/wiki-update"
import { runWikiRefreshIndexTool } from "../src/tools/wiki-refresh-index"
import { runWikiSearchCitedTool } from "../src/tools/wiki-search-cited"
import { runWikiSaveAnswerTool } from "../src/tools/wiki-save-answer"
import { runWikiLintTool } from "../src/tools/wiki-lint"
import { runEvalTool } from "../src/tools/eval"
import { resolveWikiPaths } from "../src/lib/wiki"

const okShell = (stdout = "") => async () => ({ exitCode: 0, stdout, stderr: "" })
const wikiPaths = resolveWikiPaths({ vault: "Main" })

// --- wiki-ingest ---

test("runWikiIngestTool stores raw and wiki files", async () => {
  const calls: string[][] = []
  const shell = async (cmd: string[]) => { calls.push(cmd); return { exitCode: 0, stdout: "", stderr: "" } }
  const result = await runWikiIngestTool({
    shell,
    input: { sourceName: "article.md", sourceContent: "# Raw", wikiContent: "# Wiki", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(true)
  expect(result.data!.rawPath).toBe("raw/article.md")
  expect(result.data!.wikiPath).toBe("wiki/article.md")
  expect(result.data!.vault).toBe("Main")
  expect(calls).toHaveLength(2)
})

test("runWikiIngestTool requires vault for write", async () => {
  const result = await runWikiIngestTool({
    shell: okShell(),
    input: { sourceName: "a.md", sourceContent: "x", wikiContent: "y" },
    defaultVault: null,
    activeVault: "Daily",
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runWikiIngestTool stops on raw write failure", async () => {
  let callCount = 0
  const shell = async () => {
    callCount++
    return callCount === 1
      ? { exitCode: 1, stdout: "", stderr: "conflict" }
      : { exitCode: 0, stdout: "", stderr: "" }
  }
  const result = await runWikiIngestTool({
    shell,
    input: { sourceName: "a.md", sourceContent: "x", wikiContent: "y", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(callCount).toBe(1)
})

// --- wiki-update ---

test("runWikiUpdateTool writes to wiki/ directory with overwrite", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }
  const result = await runWikiUpdateTool({
    shell,
    input: { pageName: "TypeScript.md", content: "# TypeScript\n...", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(true)
  expect(result.data!.path).toBe("wiki/TypeScript.md")
  expect(result.data!.updated).toBe(true)
  expect(captured.join(" ")).toContain("overwrite")
})

test("runWikiUpdateTool requires pageName", async () => {
  const result = await runWikiUpdateTool({
    shell: okShell(),
    input: { pageName: "", content: "x", vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

test("runWikiUpdateTool requires vault", async () => {
  const result = await runWikiUpdateTool({
    shell: okShell(),
    input: { pageName: "A.md", content: "x" },
    defaultVault: null,
    activeVault: "Daily",
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

// --- wiki-refresh-index ---

test("runWikiRefreshIndexTool builds and writes index from search results", async () => {
  const calls: string[][] = []
  const pages = "wiki/a.md\nwiki/b.md\nwiki/c.md"
  const shell = async (cmd: string[]) => {
    calls.push(cmd)
    return { exitCode: 0, stdout: calls.length === 1 ? pages : "", stderr: "" }
  }
  const result = await runWikiRefreshIndexTool({
    shell,
    input: { vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(true)
  expect(result.data!.pageCount).toBe(3)
  expect(result.data!.indexPath).toBe("wiki/INDEX.md")
  expect(result.data!.vault).toBe("Main")
  expect(calls).toHaveLength(2)
})

test("runWikiRefreshIndexTool requires vault", async () => {
  const result = await runWikiRefreshIndexTool({
    shell: okShell(),
    input: {},
    defaultVault: null,
    activeVault: "Daily",
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runWikiRefreshIndexTool propagates search failure", async () => {
  const shell = async () => ({ exitCode: 1, stdout: "", stderr: "cli error" })
  const result = await runWikiRefreshIndexTool({
    shell,
    input: { vault: "Main" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(false)
})

// --- wiki-search-cited ---

test("runWikiSearchCitedTool scopes query to wiki/ path", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "wiki/a.md", stderr: "" } }
  const result = await runWikiSearchCitedTool({
    shell,
    input: { query: "TypeScript" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(true)
  expect(result.data!.query).toBe("TypeScript")
  expect(result.data!.results).toContain("wiki/a.md")
  expect(captured.join(" ")).toContain("path=wiki")
  expect(captured.join(" ")).toContain("TypeScript")
})

test("runWikiSearchCitedTool requires query", async () => {
  const result = await runWikiSearchCitedTool({
    shell: okShell(),
    input: { query: "" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

test("runWikiSearchCitedTool passes limit when provided", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }
  await runWikiSearchCitedTool({
    shell,
    input: { query: "notes", limit: 10 },
    defaultVault: null,
    activeVault: null,
    wikiPaths,
  })
  expect(captured.join(" ")).toContain("limit=10")
})

// --- wiki-save-answer ---

test("runWikiSaveAnswerTool slugifies question into path", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }
  const result = await runWikiSaveAnswerTool({
    shell,
    input: { question: "What is TypeScript?", answer: "A typed superset of JavaScript." },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(true)
  expect(result.data!.path).toContain("wiki/answers/what-is-typescript")
  expect(result.data!.vault).toBe("Main")
})

test("runWikiSaveAnswerTool requires question", async () => {
  const result = await runWikiSaveAnswerTool({
    shell: okShell(),
    input: { question: "", answer: "x" },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

test("runWikiSaveAnswerTool requires vault", async () => {
  const result = await runWikiSaveAnswerTool({
    shell: okShell(),
    input: { question: "Why?", answer: "Because." },
    defaultVault: null,
    activeVault: "Daily",
    wikiPaths,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("VAULT_REQUIRED")
})

test("runWikiSaveAnswerTool includes tags in frontmatter when provided", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "", stderr: "" } }
  await runWikiSaveAnswerTool({
    shell,
    input: { question: "What?", answer: "This.", tags: ["typescript", "faq"] },
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
  })
  const contentArg = captured.find(a => a.startsWith("content=")) ?? ""
  expect(contentArg).toContain("typescript")
})

// --- wiki-lint ---

test("runWikiLintTool always returns ok:true with report data", async () => {
  const pages = ["wiki/a.md", "wiki/b.md"]
  const shell = async () => ({ exitCode: 0, stdout: pages.join("\n"), stderr: "" })
  const result = await runWikiLintTool({
    shell,
    input: {},
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
    readLinks: async () => ({}),
    readIndex: async () => "- [[a]]\n- [[b]]",
  })
  expect(result.ok).toBe(true)
  expect(result.data.pageCount).toBe(2)
  expect(result.data.brokenLinks).toHaveLength(0)
})

test("runWikiLintTool detects broken links via readLinks", async () => {
  const pages = ["wiki/a.md"]
  const shell = async () => ({ exitCode: 0, stdout: pages.join("\n"), stderr: "" })
  const result = await runWikiLintTool({
    shell,
    input: {},
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
    readLinks: async () => ({ "a": ["[[missing]]"] }),
    readIndex: async () => "- [[a]]",
  })
  expect(result.ok).toBe(true)
  expect(result.data.brokenLinks).toHaveLength(1)
  expect(result.data.brokenLinks[0].link).toBe("[[missing]]")
})

test("runWikiLintTool detects orphan pages not in index", async () => {
  const pages = ["wiki/a.md", "wiki/b.md"]
  const shell = async () => ({ exitCode: 0, stdout: pages.join("\n"), stderr: "" })
  const result = await runWikiLintTool({
    shell,
    input: {},
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
    readLinks: async () => ({}),
    readIndex: async () => "- [[a]]",
  })
  expect(result.ok).toBe(true)
  expect(result.data.orphanPages).toContain("wiki/b.md")
})

test("runWikiLintTool detects missing index entries pointing to nonexistent pages", async () => {
  const pages = ["wiki/a.md"]
  const shell = async () => ({ exitCode: 0, stdout: pages.join("\n"), stderr: "" })
  const result = await runWikiLintTool({
    shell,
    input: {},
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
    readLinks: async () => ({}),
    readIndex: async () => "- [[a]]\n- [[ghost]]",
  })
  expect(result.ok).toBe(true)
  expect(result.data.missingIndexEntries).toContain("ghost")
})

test("runWikiLintTool sets hint when issues are found", async () => {
  const pages = ["wiki/a.md"]
  const shell = async () => ({ exitCode: 0, stdout: pages.join("\n"), stderr: "" })
  const result = await runWikiLintTool({
    shell,
    input: {},
    defaultVault: "Main",
    activeVault: null,
    wikiPaths,
    readLinks: async () => ({ "a": ["[[broken]]"] }),
    readIndex: async () => "- [[a]]",
  })
  expect(result.hint).not.toBeNull()
})

// --- eval ---

test("runEvalTool executes code and returns stdout", async () => {
  const result = await runEvalTool({
    shell: okShell("42"),
    input: { code: "1 + 1" },
    evalEnabled: true,
  })
  expect(result.ok).toBe(true)
  expect(result.data!.result).toBe("42")
})

test("runEvalTool is disabled by default", async () => {
  const result = await runEvalTool({
    shell: okShell(""),
    input: { code: "1 + 1" },
    evalEnabled: false,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("EVAL_DISABLED")
})

test("runEvalTool requires code", async () => {
  const result = await runEvalTool({
    shell: okShell(""),
    input: { code: "" },
    evalEnabled: true,
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("INVALID_ARGS")
})

test("runEvalTool passes code to obsidian eval command", async () => {
  let captured: string[] = []
  const shell = async (cmd: string[]) => { captured = cmd; return { exitCode: 0, stdout: "ok", stderr: "" } }
  await runEvalTool({ shell, input: { code: "app.vault.getName()" }, evalEnabled: true })
  expect(captured.join(" ")).toContain("eval")
  expect(captured.join(" ")).toContain("app.vault.getName()")
})
