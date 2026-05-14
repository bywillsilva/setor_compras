import { createRequire } from "node:module"
import process from "node:process"
import { spawn } from "node:child_process"

const require = createRequire(import.meta.url)
const nextBin = require.resolve("next/dist/bin/next")

const host = process.env.HOST?.trim() || "0.0.0.0"
const port = process.env.PORT?.trim() || "3000"

const child = spawn(process.execPath, [nextBin, "start", "-H", host, "-p", port], {
  stdio: "inherit",
  env: process.env,
})

let shuttingDown = false

function forwardSignal(signal) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  if (!child.killed) {
    child.kill(signal)
    return
  }

  process.kill(process.pid, signal)
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})

child.on("error", (error) => {
  console.error("Falha ao iniciar o servidor Next.js.", error)
  process.exit(1)
})

process.on("SIGINT", () => forwardSignal("SIGINT"))
process.on("SIGTERM", () => forwardSignal("SIGTERM"))
