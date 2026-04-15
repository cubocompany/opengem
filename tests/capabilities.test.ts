import { expect, test } from "bun:test"
import { detectCli, detectApp } from "../src/lib/capabilities"

test("detectCli returns false when which fails", async () => {
  const result = await detectCli(async () => false)
  expect(result).toBe(false)
})

test("detectCli returns true when which succeeds", async () => {
  const result = await detectCli(async () => true)
  expect(result).toBe(true)
})

test("detectApp returns false when ping fails", async () => {
  const result = await detectApp(async () => false)
  expect(result).toBe(false)
})

test("detectApp returns true when ping succeeds", async () => {
  const result = await detectApp(async () => true)
  expect(result).toBe(true)
})
