import { spawnLineStream } from "./spawn-liner"

export type SwayidleEvent = {
  type: "timeout" | "resume"
  timestamp: number
}

/**
 * Monitors swayidle and calls the callback whenever a line is output
 * @param callback Function to call with each line of output
 * @returns Cleanup function to stop monitoring
 */
export async function* swayidleEventStream(idle: number) {
  const swayidle = spawnLineStream("swayidle", [
    "timeout",
    `${idle}`,
    "echo timeout:$(date +%s%3N)",
    "resume",
    "echo resume:$(date +%s%3N)",
  ])

  for await (const line of swayidle) {
    const [type, timestamp] = line.trim().split(":")
    const event = {
      type: type as "timeout" | "resume",
      timestamp: Number(timestamp),
    }
    yield event
  }
}
