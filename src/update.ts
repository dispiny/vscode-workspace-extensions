import * as vscode from 'vscode'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const SKIP_KEY = 'aurora.skippedVersion'

interface GhAsset {
  name: string
  browser_download_url: string
}
interface GhRelease {
  tag_name: string
  html_url: string
  assets: GhAsset[]
}

// Parse "owner/repo" out of the package.json repository url.
function repoSlug(context: vscode.ExtensionContext): string | null {
  const url: string | undefined = context.extension.packageJSON?.repository?.url
  const m = url?.match(/github\.com[/:]([^/]+\/[^/.]+)/)
  return m ? m[1] : null
}

// Numeric semver-ish compare; returns true when `remote` > `local`.
function isNewer(remote: string, local: string): boolean {
  const r = remote.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const l = local.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] || 0
    const b = l[i] || 0
    if (a !== b) return a > b
  }
  return false
}

async function fetchLatest(slug: string): Promise<GhRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
    headers: { 'User-Agent': 'aurora-workspaces', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) return null
  return (await res.json()) as GhRelease
}

async function downloadAndInstall(asset: GhAsset, version: string): Promise<void> {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Aurora Workspaces v${version} 업데이트 중…` },
    async () => {
      const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'aurora-workspaces' } })
      if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`)
      const buf = Buffer.from(await res.arrayBuffer())
      const tmp = join(tmpdir(), asset.name)
      await fs.writeFile(tmp, buf)
      // Built-in command: installs an extension from a local .vsix file.
      await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(tmp))
    }
  )
  const choice = await vscode.window.showInformationMessage(
    `Aurora Workspaces v${version} 설치 완료. 적용하려면 창을 새로고침하세요.`,
    '새로고침'
  )
  if (choice === '새로고침') {
    await vscode.commands.executeCommand('workbench.action.reloadWindow')
  }
}

/**
 * Check GitHub Releases for a newer build of this extension and, on confirmation,
 * download + install the published .vsix. This is a self-update path for the
 * side-loaded extension (which VS Code does not auto-update on its own).
 */
export async function checkForUpdates(context: vscode.ExtensionContext, manual = false): Promise<void> {
  if (!manual && !vscode.workspace.getConfiguration('auroraWorkspaces').get<boolean>('checkForUpdates', true)) {
    return
  }
  const slug = repoSlug(context)
  if (!slug) {
    if (manual) vscode.window.showWarningMessage('업데이트 확인 불가: repository 정보를 찾을 수 없습니다.')
    return
  }
  const current: string = context.extension.packageJSON.version
  let release: GhRelease | null = null
  try {
    release = await fetchLatest(slug)
  } catch (e) {
    if (manual) vscode.window.showWarningMessage(`업데이트 확인 실패: ${String((e as Error)?.message || e)}`)
    return
  }
  if (!release) {
    if (manual) vscode.window.showInformationMessage('릴리스를 찾을 수 없습니다.')
    return
  }

  const latest = release.tag_name.replace(/^v/, '')
  if (!isNewer(latest, current)) {
    if (manual) vscode.window.showInformationMessage(`이미 최신 버전입니다 (v${current}).`)
    return
  }

  // Respect a previously skipped version (only for automatic checks).
  if (!manual && context.globalState.get<string>(SKIP_KEY) === latest) return

  const vsix = release.assets.find((a) => a.name.endsWith('.vsix'))
  if (!vsix) {
    if (manual) vscode.window.showWarningMessage(`v${latest} 릴리스에 .vsix 파일이 없습니다.`)
    return
  }

  const UPDATE = '업데이트'
  const SKIP = '이 버전 건너뛰기'
  const choice = await vscode.window.showInformationMessage(
    `Aurora Workspaces 새 버전 v${latest} 이 있습니다 (현재 v${current}).`,
    UPDATE,
    '나중에',
    SKIP
  )
  if (choice === UPDATE) {
    try {
      await downloadAndInstall(vsix, latest)
    } catch (e) {
      vscode.window.showErrorMessage(`업데이트 실패: ${String((e as Error)?.message || e)}`)
    }
  } else if (choice === SKIP) {
    await context.globalState.update(SKIP_KEY, latest)
  }
}
