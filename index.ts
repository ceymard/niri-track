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
      console.log("workspace activated:", event.id)
    } else if (event.type === "WindowFocusChanged") {
      // console.log("window focused:", event.id)
      console.log("windows:", windows.get(event.id)?.title)
    }
  }
}

run()
  .catch(console.error)
  .then(() => {
    process.exit(0)
  })
