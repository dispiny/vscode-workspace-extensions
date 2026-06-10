// Ported from aurora-ide src/main/ipc/git.ts — pure Node, no Electron.
// Runs in the VS Code extension host (Node.js), so fast-glob + simple-git work unchanged.
import { promises as fs } from 'fs'
import { basename, dirname, join, relative } from 'path'
import fg from 'fast-glob'
import { simpleGit } from 'simple-git'

export interface RepoInfo {
  name: string
  path: string // relative to scanned root
  abs: string // absolute repo directory
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

async function detectLang(repoDir: string): Promise<string> {
  const checks: Array<[string, string]> = [
    ['go.mod', 'Go'],
    ['Cargo.toml', 'Rust'],
    ['Chart.yaml', 'Helm'],
    ['package.json', 'TypeScript'],
    ['requirements.txt', 'Python'],
    ['pyproject.toml', 'Python']
  ]
  for (const [file, lang] of checks) {
    try {
      await fs.access(join(repoDir, file))
      return lang
    } catch {
      /* not present */
    }
  }
  const hint: Record<string, string> = {
    '.tf': 'Terraform', '.go': 'Go', '.ts': 'TypeScript', '.py': 'Python',
    '.rs': 'Rust', '.sh': 'Shell', '.yaml': 'YAML', '.yml': 'YAML', '.md': 'Markdown'
  }
  try {
    const files = await fs.readdir(repoDir)
    const counts: Record<string, number> = {}
    for (const f of files) {
      const dot = f.lastIndexOf('.')
      if (dot < 0) continue
      const ext = f.slice(dot)
      if (hint[ext]) counts[ext] = (counts[ext] || 0) + 1
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    if (top) return hint[top[0]]
  } catch {
    /* ignore */
  }
  return '—'
}

async function readRepo(gitDir: string, root: string): Promise<RepoInfo | null> {
  const repoDir = dirname(gitDir)
  try {
    const git = simpleGit(repoDir)
    const status = await git.status()
    let hash = '', msg = '', who = '', when = ''
    try {
      const log = await git.log({ maxCount: 1 })
      const last = log.latest
      if (last) {
        hash = last.hash.slice(0, 7)
        msg = last.message
        who = last.author_name
        when = relativeTime(last.date)
      }
    } catch {
      /* empty repo */
    }
    const rel = relative(root, repoDir) || basename(repoDir)
    return {
      name: basename(repoDir),
      path: rel,
      abs: repoDir,
      branch: status.current || 'HEAD',
      dirty: status.files.length,
      ahead: status.ahead,
      behind: status.behind,
      lang: await detectLang(repoDir),
      ci: 'idle',
      hash,
      msg,
      who,
      when
    }
  } catch {
    return null
  }
}

export async function scanRepos(root: string, depth = 5): Promise<RepoInfo[]> {
  const gitDirs = await fg('**/.git', {
    cwd: root,
    onlyDirectories: true,
    dot: true,
    deep: depth,
    followSymbolicLinks: false,
    suppressErrors: true,
    absolute: true,
    ignore: ['**/node_modules/**']
  })
  const repos = await Promise.all(gitDirs.map((g) => readRepo(g, root)))
  return repos
    .filter((r): r is RepoInfo => r !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}
