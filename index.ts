#!/usr/bin/env bun
import { niriEventStream, type NiriWindow, type Workspace } from "./niri"
import { swayidleEventStream } from "./swayidle"
import merge from "fast-merge-async-iterators"

let windows = new Map<number, NiriWindow>()
let windows_in_workspace = new Map<number, Map<number, NiriWindow>>()
let focused_workspace_id: number = -1
let focused_window_id: number = -1

export const Replacements = [/^.+? - (.+?) - (?=cursor|code).*$/i]

function test_replacements(window: NiriWindow) {
  for (let replacement of Replacements) {
    const match = window.title.match(replacement)
    if (match) {
      return match[1]
    }
  }
  return null
}

let current_name = null as string | null
export function name_change_from_window(
  window_id: number | null,
  workspace_id?: number
) {
  let changed = false
  const window = windows.get(window_id!)
  if (window) {
    const replacements = test_replacements(window)
    if (replacements) {
      changed = current_name !== replacements
      current_name = replacements
      return changed
    }
    workspace_id = window.workspace_id
  }

  if (workspace_id) {
    for (let wd of windows_in_workspace.get(workspace_id)?.values() ?? []) {
      if (wd.id === window_id) {
        continue
      }
      const replacements = test_replacements(wd)
      if (replacements) {
        changed = current_name !== replacements
        current_name = replacements
        return changed
      }
    }
  }

  changed = current_name !== null
  current_name = null
  return changed
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

async function* changes_stream() {
  const mg = merge(swayidleEventStream(2), niriEventStream())

  for await (const event of mg) {
    switch (event.type) {
      case "WindowsChanged": {
        windows_in_workspace = new Map()
        windows = new Map()
        for (let win of event.windows) {
          if (win.is_focused) {
            focused_window_id = win.id
          }
          update_window(win)
        }
        if (name_change_from_window(focused_window_id)) {
          yield { type: "NameChange", name: current_name }
        }
        break
      }
      case "WorkspacesChanged": {
        break
      }
      case "WorkspaceActivated": {
        focused_workspace_id = event.id
        if (name_change_from_window(null, focused_workspace_id)) {
          yield { type: "NameChange", name: current_name }
        }
        break
      }
      case "WorkspaceActiveWindowChanged": {
        // const wrks = workspaces.get(event.workspace_id)
        // console.log("??")
        // if (wrks) {
        //   wrks.active_window_id = event.active_window_id
        // }
        break
      }
      case "WindowOpenedOrChanged": {
        update_window(event.window)
        if (name_change_from_window(event.window.id)) {
          yield { type: "NameChange", name: current_name }
        }
        break
      }
      case "WindowFocusChanged": {
        focused_window_id = event.id
        if (name_change_from_window(focused_window_id)) {
          yield { type: "NameChange", name: current_name }
        }
        break
      }
      case "ConfigLoaded":
        // console.log("config loaded:", event.failed)
        break
      case "WindowLayoutChanged":
        break
      case "KeyboardLayoutsChanged":
        break
      case "KeyboardLayoutSwitched":
        break
      case "OverviewOpenedOrClosed":
        break
      case "WindowClosed":
        remove_window(event.id)
        break
      case "Timeout":
        // When we get to a timeout, we yield a name with a duration

        break
      case "Resume":
        break
      default: {
        console.log("event:", event)
      }
    }
  }
}

async function run() {
  for await (const event of changes_stream()) {
    console.log("event:", event)
  }
}

run()
  .catch(console.error)
  .then(() => {
    process.exit(0)
  })
