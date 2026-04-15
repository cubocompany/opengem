export async function detectCli(which: () => Promise<boolean>): Promise<boolean> {
  return which()
}

export async function detectApp(ping: () => Promise<boolean>): Promise<boolean> {
  return ping()
}
