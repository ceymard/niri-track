#!/usr/bin/env bun
import { niriEventStream, type NiriWindow, type Workspace } from "./niri"
import { swayidleEventStream } from "./swayidle"
import merge from "fast-merge-async-iterators"

let windows = new Map<number, NiriWindow>()
let workspaces = new Map<number, Workspace>()
let focused_workspace_id: number = -1
let focused_window_id: number = -1

async function run() {
  const mg = merge(swayidleEventStream(2), niriEventStream())

  for await (const event of mg) {
    // console.log("event:", event)
    if (event.type === "WindowsChanged") {
      windows = new Map(
        event.windows.map((window) => {
          if (window.is_focused) {
            focused_window_id = window.id
          }
          console.log("window:", window.id, window.title)
          return [window.id, window]
        })
      )
    } else if (event.type === "WorkspacesChanged") {
      workspaces = new Map(
        event.workspaces.map((workspace) => {
          if (workspace.is_focused) {
            focused_workspace_id = workspace.id
          }
          return [workspace.id, workspace]
        })
      )
    } else if (event.type === "WorkspaceActivated") {
      focused_workspace_id = event.id
    } else if (event.type === "WindowFocusChanged") {
      focused_window_id = event.id
    } else if (event.type === "WindowOpenedOrChanged") {
      windows.set(event.window.id, event.window)
    } else if (event.type === "WindowClosed") {
      windows.delete(event.id)
    } else if (event.type === "WorkspaceActiveWindowChanged") {
      const wrks = workspaces.get(event.workspace_id)
      if (wrks) {
        wrks.active_window_id = event.active_window_id
      }
    } else if (event.type === "timeout") {

    } else if (event.type === "resume") {

    } else {
      console.log("event:", event)
    }
  }
}

run()
  .catch(console.error)
  .then(() => {
    process.exit(0)
  })
