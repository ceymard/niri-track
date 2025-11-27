import { spawn } from "child_process"
import { createInterface } from "readline"

export async function* spawnLineStream(command: string, args: string[]) {
  const proc = spawn(command, args)
  const rl = createInterface({
    input: proc.stdout,
    crlfDelay: Infinity,
  })

  const cleanup = () => {
    process.off("exit", cleanup)
    process.off("SIGINT", cleanup)
    process.off("SIGTERM", cleanup)
    rl.off("close", cleanup)
    if (!proc.killed) {
      proc.kill()
    }
  }

  process.on("exit", cleanup)
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  try {
    for await (const line of rl) {
      if (line.trim()) {
        yield line
      }
    }
  } finally {
    cleanup()
  }
}
