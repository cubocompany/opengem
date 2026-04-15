import { expect, test } from "bun:test"
import { resolvePluginConfig, resolveVault } from "../src/lib/config"

test("resolvePluginConfig returns built-in defaults", () => {
  const config = resolvePluginConfig({})

  expect(config.defaultVault).toBeNull()
  expect(config.skills.mode).toBe("external")
  expect(config.skills.syncDirName).toBe("obsidian-opencode-plugin-bundled")
})

test("write operations require explicit or default vault", () => {
  const config = resolvePluginConfig({ defaultVault: "Main" })
  const resolved = resolveVault({
    action: "write",
    inputVault: null,
    activeVault: "Ignored",
    config,
  })

  expect(resolved).toBe("Main")
})

test("read operations may fall back to active vault", () => {
  const config = resolvePluginConfig({})
  const resolved = resolveVault({
    action: "read",
    inputVault: null,
    activeVault: "Daily Vault",
    config,
  })

  expect(resolved).toBe("Daily Vault")
})
