// Thin wrapper over the VS Code webview messaging API — replaces Electron's
// `window.aurora.*` preload bridge. Same request/response shape, message-based.

export interface RepoInfo {
  name: string
  path: string
  abs: string
  branch: string
  dirty: number
  ahead: number
  behind: number
  lang: string
  ci: 'ok' | 'run' | 'err' | 'idle'
  hash: string
  msg: string
  who: string
  when: string
}
export interface Workspace {
  path: string
  name: string
}
export interface DiffFile {
  path: string
  index: string
  working: string
}

interface VsCodeApi {
  postMessage(msg: unknown): void
  getState<T>(): T | undefined
  setState<T>(state: T): void
}
declare function acquireVsCodeApi(): VsCodeApi

export const vscode = acquireVsCodeApi()

export type HostMessage =
  | { type: 'workspaces'; workspaces: Workspace[] }
  | { type: 'scanResult'; path: string; repos: RepoInfo[] }
  | { type: 'scanError'; path: string; error: string }
  | { type: 'refresh' }
  | { type: 'repoDiff'; abs: string; files: DiffFile[]; diff: string; truncated: boolean; error?: string }
  | { type: 'favorites'; favorites: string[] }

export function send(msg: Record<string, unknown> & { type: string }): void {
  vscode.postMessage(msg)
}

export function onHostMessage(handler: (msg: HostMessage) => void): () => void {
  const listener = (e: MessageEvent): void => handler(e.data as HostMessage)
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
