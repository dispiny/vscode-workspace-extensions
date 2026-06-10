import * as vscode from 'vscode'
import { basename } from 'path'
import { scanRepos } from './scan'

interface Workspace {
  path: string
  name: string
}

const WS_KEY = 'aurora.workspaces'

function nonce(): string {
  let t = ''
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) t += chars.charAt(Math.floor(Math.random() * chars.length))
  return t
}

/**
 * Messages mirror the old Electron preload bridge (`window.aurora.scanRepos`, etc.).
 * webview -> host:  ready | scan | addWorkspace | removeWorkspace | openRepo
 * host -> webview:  workspaces | scanResult | scanError | refresh
 */
class WorkspacesViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'auroraWorkspaces.view'
  private view?: vscode.WebviewView

  constructor(private readonly context: vscode.ExtensionContext) {}

  private getWorkspaces(): Workspace[] {
    return this.context.globalState.get<Workspace[]>(WS_KEY, [])
  }

  private async setWorkspaces(list: Workspace[]): Promise<void> {
    await this.context.globalState.update(WS_KEY, list)
    this.post({ type: 'workspaces', workspaces: list })
  }

  private post(msg: unknown): void {
    this.view?.webview.postMessage(msg)
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')]
    }
    view.webview.html = this.html(view.webview)

    view.webview.onDidReceiveMessage(async (msg: { type: string; [k: string]: unknown }) => {
      switch (msg.type) {
        case 'ready':
          this.post({ type: 'workspaces', workspaces: this.getWorkspaces() })
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
        case 'openRepo':
          await this.openRepo(String(msg.abs))
          break
      }
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

  private async openRepo(abs: string): Promise<void> {
    const newWindow = vscode.workspace
      .getConfiguration('auroraWorkspaces')
      .get<boolean>('openInNewWindow', true)
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(abs), {
      forceNewWindow: newWindow
    })
  }

  refresh(): void {
    this.post({ type: 'refresh' })
  }

  private html(webview: vscode.Webview): string {
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
<body>
  <div id="root"></div>
  <script nonce="${n}" src="${script}"></script>
</body>
</html>`
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new WorkspacesViewProvider(context)
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(WorkspacesViewProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand('auroraWorkspaces.addWorkspace', () => provider.addWorkspace()),
    vscode.commands.registerCommand('auroraWorkspaces.refresh', () => provider.refresh())
  )
}

export function deactivate(): void {}
