import { spawn } from "child_process"
import { createInterface } from "readline"
import { spawnLineStream } from "./spawn-liner"

export interface Workspace {
  id: number
  idx: number
  name: string | null
  output: string
  is_urgent: boolean
  is_active: boolean
  is_focused: boolean
  active_window_id: number
}

export interface NiriWindow {
  id: number
  title: string
  app_id: string
  pid: number
  workspace_id: number
  is_focused: boolean
  is_floating: boolean
  is_urgent: boolean
  layout: {
    pos_in_scrolling_layout: [number, number]
    tile_size: [number, number]
    window_size: [number, number]
    tile_pos_in_workspace_view: [number, number] | null
    window_offset_in_tile: [number, number]
  }
}

export interface WorkspacesChanged {
  type: "WorkspacesChanged"
  workspaces: Workspace[]
}

export interface WindowsChanged {
  type: "WindowsChanged"
  windows: NiriWindow[]
}

export interface WorkspaceActiveWindowChanged {
  type: "WorkspaceActiveWindowChanged"
  workspace_id: number
  active_window_id: number
}

export interface WindowFocusChanged {
  type: "WindowFocusChanged"
  id: number
}

export interface WorkspaceActivated {
  type: "WorkspaceActivated"
  id: number
  focused: boolean
}

export type NiriEvent =
  | WorkspacesChanged
  | WindowsChanged
  | WorkspaceActiveWindowChanged
  | WindowFocusChanged
  | WorkspaceActivated

/**
 * Creates an async iterable for niri event-stream
 * Each iteration yields a parsed JSON object
 */
export async function* niriEventStream() {
  const niri = spawnLineStream("niri", ["msg", "-j", "event-stream"])

  for await (const line of niri) {
    if (line.trim()) {
      try {
        const event = JSON.parse(line) as any
        const type = Object.keys(event)[0]
        yield { type, ...event![type!] } as NiriEvent
      } catch (err) {
        console.error("Failed to parse JSON:", line, err)
      }
    }
  }
}
