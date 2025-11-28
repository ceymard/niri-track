#!/usr/bin/env bun
import { niriEventStream, type NiriWindow, type Workspace } from "./niri"
import { swayidleEventStream } from "./swayidle"
import { readFileSync, readlinkSync } from "fs"
import merge from "fast-merge-async-iterators"

let windows = new Map<number, NiriWindow>()
let windows_in_workspace = new Map<number, Map<number, NiriWindow>>()
let focused_workspace_id: number = -1
let last_timestamp = Date.now()

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

function changed(name: string | null) {
  let name_has_changed = name !== current_name
  current_name = name

  if (name_has_changed) {
    const now = Date.now()
    const last = last_timestamp
    last_timestamp = now
    return { name, duration: now - last }
  }
  return null
}

export function name_change_from_window(
  window_id: number | null,
  workspace_id?: number
) {
  const window = windows.get(window_id!)
  if (window) {
    const replacements = test_replacements(window)
    if (replacements) {
      return changed(replacements)
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
        return changed(replacements)
      }
    }
  }

  return changed(null)
}

let timestamp_for_focus = Date.now()
let focused_window_id: number | null = null
function update_focus(window_id: number | null) {
  if (window_id === focused_window_id) {
    return null
  }
  focused_window_id = window_id
  const window = windows.get(window_id!)
  const last = timestamp_for_focus
  timestamp_for_focus = Date.now()
  let exe = ""
  let cmd: string[] = []
  if (window) {
    try {
      exe = readlinkSync(`/proc/${window.pid}/exe`)
      cmd = readFileSync(`/proc/${window.pid}/cmdline`, "utf-8")
        .slice(0, -1)
        .split("\0")
    } catch (error) {}
  }
  return { name: current_name, duration: timestamp_for_focus - last, exe, cmd }
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
        update_focus(focused_window_id)
        name_change_from_window(focused_window_id)
        break
      }
      case "WorkspacesChanged": {
        break
      }
      case "WorkspaceActivated": {
        focused_workspace_id = event.id
        let change = name_change_from_window(null, focused_workspace_id)
        if (change) {
          yield change
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
        let change = name_change_from_window(event.window.id)
        if (change) {
          yield change
        }
        break
      }
      case "WindowFocusChanged": {
        let foc = update_focus(event.id)
        if (foc) {
          yield foc
        }
        let change = name_change_from_window(focused_window_id)
        if (change) {
          yield change
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
        let now = Date.now()
        let last = last_timestamp
        last_timestamp = now
        yield {
          name: current_name,
          duration: now - last,
        }

        break
      case "Resume":
        last_timestamp = Date.now()
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
