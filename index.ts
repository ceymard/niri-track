#!/usr/bin/env bun
import { niriEventStream, type NiriWindow, type Workspace } from "./niri"
import { swayidleEventStream } from "./swayidle"
import merge from "fast-merge-async-iterators"

let windows = new Map<number, NiriWindow>()
let workspaces = new Map<number, Workspace>()
let windows_in_workspace = new Map<number, Map<number, NiriWindow>>()
let focused_workspace_id: number = -1
let focused_window_id: number = -1

export const Replacements = [
  /^.+? - (.+?) - (?=cursor|code).*$/i,
]

function test_replacements(window: NiriWindow) {
  for (let replacement of Replacements) {
    const match = window.title.match(replacement)
    if (match) {
      return match[1]
    }
  }
  return null
}

let last_name = null as string | null
export function evan_name_change_from_window(window_id: number) {
  let changed = false
  const window = windows.get(window_id)
  if (!window) {
    return null
  }
  const replacements = test_replacements(window)
  if (replacements) {
    changed = last_name !== replacements
    last_name = replacements
  }
  if (replacements == null) {
    for (let wd of windows_in_workspace.get(window.workspace_id)?.values() ?? []) {
      if (wd.id === window_id) {
        continue
      }
      const replacements = test_replacements(wd)
      if (replacements) {
        changed = last_name !== replacements
        last_name = replacements
      }
    }
  }
  return changed ? last_name : null
}

function update_window(win: NiriWindow) {
  const prev = windows.get(win.id)
  if (prev) {
    if (prev.workspace_id !== win.workspace_id) {
      windows_in_workspace.get(prev.workspace_id)?.delete(prev.id)
    }
  }
  
  let wwk = windows_in_workspace.get(win.workspace_id)
  if (wwk === undefined) {
    wwk = new Map()
    windows_in_workspace.set(win.workspace_id, wwk)
  }
  wwk.set(win.id, win)
  windows.set(win.id, win)
}

function remove_window(id: number) {
  const prev = windows.get(id)
  if (prev) {
    windows_in_workspace.get(prev.workspace_id)?.delete(prev.id)
  }
  windows.delete(id)
}

async function run() {
  const mg = merge(swayidleEventStream(2), niriEventStream())

  for await (const event of mg) {

    switch (event.type) {
      case "WindowsChanged":
        windows_in_workspace = new Map()
        windows = new Map()
        for (let win of event.windows) {
          if (win.is_focused) {
            focused_window_id = win.id
          }
          update_window(win)
        }
        const name = evan_name_change_from_window(focused_window_id)
        console.log("name:", name)
        break
      case "WorkspacesChanged":
        workspaces = new Map(
          event.workspaces.map((workspace) => {
            if (workspace.is_focused) {
              focused_workspace_id = workspace.id
            }
            return [workspace.id, workspace]
          })
        )
        break
      case "WorkspaceActivated":
        focused_workspace_id = event.id
        break
      case "WindowFocusChanged": {
        focused_window_id = event.id
        const window = windows.get(focused_window_id)
        const n2 = evan_name_change_from_window(focused_window_id)
        console.log("name:", n2)
        break 
      }
      case "WindowOpenedOrChanged":
        update_window(event.window)
        const n2 = evan_name_change_from_window(event.window.id)
        console.log("name:", n2)
        break
      case "WindowClosed":
        remove_window(event.id)
        break
      case "WorkspaceActiveWindowChanged":
        const wrks = workspaces.get(event.workspace_id)
        if (wrks) {
          wrks.active_window_id = event.active_window_id
        }
        break
      case "ConfigLoaded":
        console.log("config loaded:", event.failed)
        break
      case "WindowLayoutChanged":
        break
      case "KeyboardLayoutsChanged":
        break
      case "KeyboardLayoutSwitched":
        break
      case "OverviewOpenedOrClosed":
        break
      case "Timeout":
        // When we get to a timeout, we yield a name with a duration

        break
      case "Resume":
        
        break
      default:
        console.log("event:", event)
    }
  }
}

run()
  .catch(console.error)
  .then(() => {
    process.exit(0)
  })
