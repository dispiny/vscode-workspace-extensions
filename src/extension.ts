import * as vscode from 'vscode'
import { basename } from 'path'
import { scanRepos, repoDiff } from './scan'
import { checkForUpdates } from './update'

interface Workspace {
  path: string
  name: string
}

const WS_KEY = 'aurora.workspaces'
const FAV_KEY = 'aurora.favorites'

function nonce(): string {
  let t = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) t += chars.charAt(Math.floor(Math.random() * chars.length))
  return t
}

/**
 * Manages the Aurora UI, which can render in two places that share one message
 * protocol and one source of truth (globalState):
 *   - the sidebar WebviewView
 *   - a full-width editor WebviewPanel ("확장해서 열기")
 *
 * Messages mirror the old Electron preload bridge (`window.aurora.scanRepos`, etc.).
 * webview -> host:  ready | scan | addWorkspace | removeWorkspace | renameWorkspace | openRepo | repoDiff | openInEditor | toggleFavorite
 * host -> webview:  workspaces | scanResult | scanError | refresh | repoDiff | favorites
 */
class WorkspacesProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'auroraWorkspaces.view'
  private webviews = new Set<vscode.Webview>()
  private panel?: vscode.WebviewPanel

  constructor(private readonly context: vscode.ExtensionContext) {}

  private getWorkspaces(): Workspace[] {
    return this.context.globalState.get<Workspace[]>(WS_KEY, [])
  }

  private async setWorkspaces(list: Workspace[]): Promise<void> {
    await this.context.globalState.update(WS_KEY, list)
    this.post({ type: 'workspaces', workspaces: list }) // broadcast to all attached views
  }

  private getFavorites(): string[] {
    return this.context.globalState.get<string[]>(FAV_KEY, [])
  }

  private async toggleFavorite(abs: string): Promise<void> {
    const favs = this.getFavorites()
    const next = favs.includes(abs) ? favs.filter((f) => f !== abs) : [...favs, abs]
    await this.context.globalState.update(FAV_KEY, next)
    this.post({ type: 'favorites', favorites: next })
  }

  // Broadcast to every attached webview so the sidebar and the editor tab stay in sync.
  private post(msg: unknown): void {
    for (const w of this.webviews) w.postMessage(msg)
  }

  private webviewOptions(): vscode.WebviewOptions {
    return {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    }
  }

  // Attach a webview (sidebar or panel) and wire the shared message handler.
  private attach(webview: vscode.Webview): void {
    this.webviews.add(webview)
    webview.onDidReceiveMessage((msg: { type: string; [k: string]: unknown }) => this.handle(msg))
  }

  private async handle(msg: { type: string; [k: string]: unknown }): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.post({ type: 'workspaces', workspaces: this.getWorkspaces() })
        this.post({ type: 'favorites', favorites: this.getFavorites() })
        break
      case 'toggleFavorite':
        await this.toggleFavorite(String(msg.abs))
        break
      case 'scan':
        await this.scan(String(msg.path))
        break
      case 'addWorkspace':
        await this.addWorkspace()
        break
      case 'removeWorkspace':
        await this.setWorkspaces(this.getWorkspaces().filter((w) => w.path !== msg.path))
        break
      case 'renameWorkspace':
        await this.renameWorkspace(String(msg.path))
        break
      case 'openRepo':
        await this.openRepo(String(msg.abs), msg.newWindow as boolean | undefined)
        break
      case 'repoDiff':
        await this.sendDiff(String(msg.abs))
        break
      case 'openInEditor':
        this.openInEditor()
        break
    }
  }

  // --- WebviewView (sidebar) ---
  resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = this.webviewOptions()
    view.webview.html = this.html(view.webview, 'sidebar')
    this.attach(view.webview)
    view.onDidDispose(() => this.webviews.delete(view.webview))
  }

  // --- WebviewPanel (editor tab) ---
  openInEditor(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active)
      return
    }
    const panel = vscode.window.createWebviewPanel(
      'auroraWorkspaces.panel',
      'Aurora Workspaces',
      vscode.ViewColumn.Active,
      { ...this.webviewOptions(), retainContextWhenHidden: true }
    )
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'aurora.svg')
    panel.webview.html = this.html(panel.webview, 'editor')
    this.attach(panel.webview)
    this.panel = panel
    panel.onDidDispose(() => {
      this.webviews.delete(panel.webview)
      this.panel = undefined
    })
  }

  private async scan(path: string): Promise<void> {
    const depth = vscode.workspace.getConfiguration('auroraWorkspaces').get<number>('scanDepth', 5)
    try {
      const repos = await scanRepos(path, depth)
      this.post({ type: 'scanResult', path, repos })
    } catch (e) {
      this.post({ type: 'scanError', path, error: String((e as Error)?.message || e) })
    }
  }

  async addWorkspace(): Promise<void> {
    const picks = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: true,
      openLabel: 'Add as workspace'
    })
    if (!picks?.length) return
    const list = this.getWorkspaces()
    for (const uri of picks) {
      const path = uri.fsPath
      if (list.some((w) => w.path === path)) continue
      list.push({ path, name: basename(path) })
    }
    await this.setWorkspaces(list)
  }

  private async renameWorkspace(path: string): Promise<void> {
    const list = this.getWorkspaces()
    const ws = list.find((w) => w.path === path)
    if (!ws) return
    const name = await vscode.window.showInputBox({
      title: '워크스페이스 이름 변경',
      prompt: path,
      value: ws.name,
      validateInput: (v) => (v.trim() ? null : '이름을 입력하세요.')
    })
    if (name === undefined) return // cancelled
    const trimmed = name.trim()
    if (!trimmed || trimmed === ws.name) return
    await this.setWorkspaces(list.map((w) => (w.path === path ? { ...w, name: trimmed } : w)))
  }

  private async sendDiff(abs: string): Promise<void> {
    try {
      const result = await repoDiff(abs)
      this.post({ type: 'repoDiff', abs, ...result })
    } catch (e) {
      this.post({ type: 'repoDiff', abs, files: [], diff: '', truncated: false, error: String((e as Error)?.message || e) })
    }
  }

  private async openRepo(abs: string, newWindow?: boolean): Promise<void> {
    // An explicit choice from the UI wins; otherwise fall back to the config default.
    const useNewWindow =
      newWindow ??
      vscode.workspace.getConfiguration('auroraWorkspaces').get<boolean>('openInNewWindow', true)
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(abs), {
      forceNewWindow: useNewWindow
    })
  }

  refresh(): void {
    this.post({ type: 'refresh' })
  }

  private html(webview: vscode.Webview, view: 'sidebar' | 'editor'): string {
    const ext = this.context.extensionUri
    const script = webview.asWebviewUri(vscode.Uri.joinPath(ext, 'media', 'webview.js'))
    const style = webview.asWebviewUri(vscode.Uri.joinPath(ext, 'media', 'style.css'))
    const n = nonce()
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${n}'`,
      `font-src ${webview.cspSource}`
    ].join('; ')
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${style}" rel="stylesheet" />
  <title>Aurora Workspaces</title>
</head>
<body data-view="${view}">
  <div id="root"></div>
  <script nonce="${n}">window.__AURORA_VIEW__ = ${JSON.stringify(view)};</script>
  <script nonce="${n}" src="${script}"></script>
</body>
</html>`
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new WorkspacesProvider(context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WorkspacesProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('auroraWorkspaces.addWorkspace', () => provider.addWorkspace()),
    vscode.commands.registerCommand('auroraWorkspaces.refresh', () => provider.refresh()),
    vscode.commands.registerCommand('auroraWorkspaces.openInEditor', () => provider.openInEditor()),
    vscode.commands.registerCommand('auroraWorkspaces.checkForUpdates', () => checkForUpdates(context, true))
  )
  // Non-blocking automatic update check on startup.
  void checkForUpdates(context)
}

export function deactivate(): void {}
