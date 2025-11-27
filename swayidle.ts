import { spawnLineStream } from "./spawn-liner"

export type SwayidleEvent = {
  type: "Timeout" | "Resume"
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
    "echo Timeout:$(date +%s%3N)",
    "resume",
    "echo Resume:$(date +%s%3N)",
  ])

  for await (const line of swayidle) {
    const [type, timestamp] = line.trim().split(":")
    const event = {
      type: type as "Timeout" | "Resume",
      timestamp: Number(timestamp),
    } as SwayidleEvent
    yield event
  }
}
