/**
 * Verified obsidian CLI contract (from upstream obsidian-cli skill + docs):
 *
 * Commands and argument forms:
 *   obsidian read file="My Note"
 *   obsidian read path="folder/note.md"
 *   obsidian search query="term" limit=10
 *   obsidian create name="New Note" content="# Hello"
 *   obsidian append file="My Note" content="new line"
 *   obsidian property:set name="status" value="done" file="My Note"
 *
 * Argument encoding: key=value (no shell quoting — the obsidian CLI parses
 * its own argv; spaces inside values are passed as a single argv element).
 *
 * Failure signals: non-zero exit code + stderr message.
 */

import { expect, test } from "bun:test"
import { buildObsidianArgs, errorResult, executeObsidianCli } from "../src/lib/cli"
import type { ResultEnvelope } from "../src/lib/types"

// --- argv builder ---

test("buildObsidianArgs maps read by file", () => {
  expect(buildObsidianArgs("read", { file: "My Note" })).toEqual([
    "read",
    "file=My Note",
  ])
})

test("buildObsidianArgs maps read by path", () => {
  expect(buildObsidianArgs("read", { path: "folder/note.md" })).toEqual([
    "read",
    "path=folder/note.md",
  ])
})

test("buildObsidianArgs maps search with limit", () => {
  expect(buildObsidianArgs("search", { query: "term", limit: 10 })).toEqual([
    "search",
    "query=term",
    "limit=10",
  ])
})

test("buildObsidianArgs maps property:set", () => {
  expect(
    buildObsidianArgs("property:set", { name: "status", value: "done", file: "My Note" }),
  ).toEqual(["property:set", "name=status", "value=done", "file=My Note"])
})

test("buildObsidianArgs omits null and undefined values", () => {
  expect(buildObsidianArgs("create", { name: "Note", vault: null, template: undefined })).toEqual([
    "create",
    "name=Note",
  ])
})

test("buildObsidianArgs includes boolean flag when true", () => {
  expect(buildObsidianArgs("create", { name: "Note", silent: true })).toEqual([
    "create",
    "name=Note",
    "silent",
  ])
})

test("buildObsidianArgs omits boolean flag when false", () => {
  expect(buildObsidianArgs("create", { name: "Note", silent: false })).toEqual([
    "create",
    "name=Note",
  ])
})

test("buildObsidianArgs rejects file and path together", () => {
  expect(() =>
    buildObsidianArgs("read", { file: "A", path: "a.md" }),
  ).toThrow("MUTUALLY_EXCLUSIVE_TARGET")
})

// --- errorResult ---

test("errorResult produces ok=false envelope", () => {
  const result = errorResult("CLI_NOT_FOUND", "Obsidian CLI not installed", "Install the obsidian CLI")
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("CLI_NOT_FOUND")
  expect(result.hint).toBe("Install the obsidian CLI")
  expect(result.schemaVersion).toBe("1.0")
})

test("errorResult sets INVALID_ARGS code", () => {
  const result = errorResult("INVALID_ARGS", "Missing required field", "Provide file or path")
  expect(result.error?.code).toBe("INVALID_ARGS")
  expect(result.error?.kind).toBe("capability")
})

test("errorResult sets APP_NOT_RUNNING code", () => {
  const result = errorResult("APP_NOT_RUNNING", "Obsidian is not running", "Start Obsidian")
  expect(result.error?.code).toBe("APP_NOT_RUNNING")
})

// --- executeObsidianCli ---

test("executeObsidianCli returns ok=true on exit code 0", async () => {
  const shell = async () => ({ exitCode: 0, stdout: "# Hello", stderr: "" })
  const result = await executeObsidianCli(shell, "read", { file: "My Note" }, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })
  expect(result.ok).toBe(true)
  expect(result.stdout).toBe("# Hello")
  expect(result.exitCode).toBe(0)
})

test("executeObsidianCli returns ok=false on non-zero exit", async () => {
  const shell = async () => ({ exitCode: 1, stdout: "", stderr: "not found" })
  const result = await executeObsidianCli(shell, "read", { file: "Missing" }, {
    requiredCapabilities: ["cli", "app"],
    checkedCapabilities: ["cli", "app"],
  })
  expect(result.ok).toBe(false)
  expect(result.stderr).toBe("not found")
})

test("executeObsidianCli uses custom error mapper", async () => {
  const shell = async () => ({ exitCode: 127, stdout: "", stderr: "command not found" })
  const result = await executeObsidianCli(shell, "read", { file: "Note" }, {
    requiredCapabilities: ["cli"],
    checkedCapabilities: ["cli"],
    mapError: () => ({ code: "CLI_NOT_FOUND", kind: "capability", message: "CLI not installed" }),
  })
  expect(result.ok).toBe(false)
  expect(result.error?.code).toBe("CLI_NOT_FOUND")
})

test("executeObsidianCli passes schemaVersion and command name", async () => {
  const shell = async () => ({ exitCode: 0, stdout: "", stderr: "" })
  const result = await executeObsidianCli(shell, "search", { query: "test" }, {
    requiredCapabilities: [],
    checkedCapabilities: [],
  })
  expect(result.schemaVersion).toBe("1.0")
  expect(result.command).toBe("obsidian_search")
})
