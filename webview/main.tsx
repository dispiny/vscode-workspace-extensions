import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Icon, LANG_COLOR } from './icons'
import { send, onHostMessage, vscode, RepoInfo, Workspace, DiffFile } from './bridge'

interface WSState {
  scanning: boolean
  repos: RepoInfo[]
  error?: string
}
interface DiffState {
  repo: { abs: string; name: string }
  loading: boolean
  files: DiffFile[]
  diff: string
  truncated: boolean
  error?: string
}
interface UIState {
  collapsed?: Record<string, boolean>
}

// Which surface are we rendering in — set by the host in the HTML shell.
const IN_EDITOR = (window as unknown as { __AURORA_VIEW__?: string }).__AURORA_VIEW__ === 'editor'

function RepoCard({
  r,
  delay,
  onOpenCurrent,
  onOpenNew,
  onDiff
}: {
  r: RepoInfo
  delay: number
  onOpenCurrent: () => void
  onOpenNew: () => void
  onDiff: () => void
}): React.JSX.Element {
  const stop =
    (fn: () => void) =>
    (e: React.MouseEvent): void => {
      e.stopPropagation()
      fn()
    }
  return (
    <div className="repo-card repo-card-click" style={{ animationDelay: delay + 'ms' }} onClick={onOpenCurrent} title="클릭하면 현재 창에서 엽니다">
      <div className="repo-top">
        <span className="repo-ic" style={{ background: 'var(--hover)' }}>
          <Icon name="gitrepo" size={16} style={{ color: 'var(--accent)' }} />
        </span>
        <span className="repo-name">{r.name}</span>
        <button className="newwin-btn" title="새 창에서 열기" onClick={stop(onOpenNew)}>
          <Icon name="newWin" size={14} />
        </button>
      </div>
      <div className="repo-path">{r.abs}</div>
      <div className="repo-meta">
        <span className="branch-pill" title={r.branch}>
          <Icon name="branch" size={11} />
          <span>{r.branch}</span>
        </span>
        <span className="mi">
          <span className="lang-dot" style={{ background: LANG_COLOR[r.lang] || 'var(--text-3)' }} />
          {r.lang}
        </span>
        {r.dirty ? (
          <button className="mi dirty mi-btn" title="변경사항 보기" onClick={stop(onDiff)}>
            <Icon name="dot" size={10} />
            <b>{r.dirty}</b> 변경
          </button>
        ) : (
          <span className="mi clean"><Icon name="check" size={13} />정상</span>
        )}
        {r.ahead > 0 && <span className="mi"><Icon name="arrowUp" size={12} />{r.ahead}</span>}
        {r.behind > 0 && <span className="mi"><Icon name="arrowDn" size={12} />{r.behind}</span>}
      </div>
      <div className="repo-commit">
        <span className="hash">{r.hash || '—'}</span>
        <span className="cmsg">{r.msg || '커밋 없음'}</span>
        <span className="cwhen">{r.when}</span>
      </div>
    </div>
  )
}

function DiffOverlay({ st, onClose }: { st: DiffState; onClose: () => void }): React.JSX.Element {
  const lines = st.diff ? st.diff.split('\n') : []
  function lineClass(l: string): string {
    if (l.startsWith('+++') || l.startsWith('---')) return 'd-meta'
    if (l.startsWith('@@')) return 'd-hunk'
    if (l.startsWith('diff ') || l.startsWith('index ') || l.startsWith('new file') || l.startsWith('deleted file')) return 'd-meta'
    if (l.startsWith('+')) return 'd-add'
    if (l.startsWith('-')) return 'd-del'
    return ''
  }
  return (
    <div className="diff-overlay" onClick={onClose}>
      <div className="diff-panel" onClick={(e) => e.stopPropagation()}>
        <div className="diff-head">
          <Icon name="diff" size={15} style={{ color: 'var(--accent)' }} />
          <span className="diff-title">{st.repo.name}</span>
          <span className="diff-sub">변경사항 (HEAD 기준)</span>
          <button className="icon-btn" style={{ width: 28, height: 28, marginLeft: 'auto' }} title="닫기" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>
        {st.loading ? (
          <div className="scan-spin" style={{ padding: 20 }}>
            <span className="spinner" /> diff 계산 중…
          </div>
        ) : st.error ? (
          <div className="ws-note" style={{ padding: 20 }}>오류: {st.error}</div>
        ) : (
          <>
            {st.files.length > 0 && (
              <div className="diff-files">
                {st.files.map((f) => (
                  <div key={f.path} className="diff-file">
                    <span className={'d-stat s-' + (f.working || f.index).trim()}>{(f.index + f.working).trim() || '·'}</span>
                    <span className="d-fpath">{f.path}</span>
                  </div>
                ))}
              </div>
            )}
            {lines.length ? (
              <pre className="diff-pre">
                {lines.map((l, i) => (
                  <div key={i} className={lineClass(l)}>{l || ' '}</div>
                ))}
              </pre>
            ) : (
              <div className="ws-note" style={{ padding: 20 }}>
                추적된 변경 내용이 없습니다{st.files.length ? ' (새 파일만 있을 수 있음).' : '.'}
              </div>
            )}
            {st.truncated && <div className="ws-note" style={{ padding: '4px 16px 12px' }}>diff가 너무 커서 일부만 표시했습니다.</div>}
          </>
        )}
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [results, setResults] = useState<Record<string, WSState>>({})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    () => (vscode.getState<UIState>()?.collapsed) ?? {}
  )
  const [diff, setDiff] = useState<DiffState | null>(null)
  const diffAbs = useRef<string | null>(null)

  // Persist collapse state across webview reloads.
  useEffect(() => {
    vscode.setState<UIState>({ collapsed })
  }, [collapsed])

  // Wire up the host message bridge once.
  useEffect(() => {
    const off = onHostMessage((msg) => {
      switch (msg.type) {
        case 'workspaces':
          setWorkspaces(msg.workspaces)
          break
        case 'scanResult':
          setResults((r) => ({ ...r, [msg.path]: { scanning: false, repos: msg.repos } }))
          break
        case 'scanError':
          setResults((r) => ({ ...r, [msg.path]: { scanning: false, repos: [], error: '스캔 실패 — 경로를 확인하세요.' } }))
          break
        case 'refresh':
          setResults((r) => {
            const next = { ...r }
            for (const k of Object.keys(next)) next[k] = { ...next[k], scanning: true }
            return next
          })
          setWorkspaces((ws) => {
            ws.forEach((w) => send({ type: 'scan', path: w.path }))
            return ws
          })
          break
        case 'repoDiff':
          // Only apply if it's the diff we're currently looking at.
          if (diffAbs.current === msg.abs) {
            setDiff((d) =>
              d
                ? { ...d, loading: false, files: msg.files, diff: msg.diff, truncated: msg.truncated, error: msg.error }
                : d
            )
          }
          break
      }
    })
    send({ type: 'ready' })
    return off
  }, [])

  function scan(path: string): void {
    setResults((r) => ({ ...r, [path]: { scanning: true, repos: r[path]?.repos || [] } }))
    send({ type: 'scan', path })
  }

  function openDiff(abs: string, name: string): void {
    diffAbs.current = abs
    setDiff({ repo: { abs, name }, loading: true, files: [], diff: '', truncated: false })
    send({ type: 'repoDiff', abs })
  }

  function toggleCollapse(path: string): void {
    setCollapsed((c) => ({ ...c, [path]: !c[path] }))
  }

  // Scan any workspace we haven't scanned yet.
  useEffect(() => {
    workspaces.forEach((ws) => {
      if (!results[ws.path]) scan(ws.path)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces])

  function matches(r: RepoInfo): boolean {
    if (q && !(r.name + r.lang + r.branch).toLowerCase().includes(q.toLowerCase())) return false
    if (filter === 'dirty') return r.dirty > 0
    if (filter === 'ahead') return r.ahead > 0 || r.behind > 0
    if (filter === 'ci') return r.ci === 'err'
    return true
  }

  const totalRepos = workspaces.reduce((n, ws) => n + (results[ws.path]?.repos.length || 0), 0)
  const totalDirty = workspaces.reduce(
    (n, ws) => n + (results[ws.path]?.repos.filter((r) => r.dirty > 0).length || 0),
    0
  )

  return (
    <div className="repos-wrap">
      <div className="repos-head">
        <div className="path-bar">
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>
            <b style={{ color: 'var(--text-1)', fontWeight: 650 }}>{workspaces.length}개 워크스페이스</b> · 레포{' '}
            <b style={{ color: 'var(--text-1)' }}>{totalRepos}개</b>
            {totalDirty > 0 && (
              <span className="accent" style={{ color: 'var(--accent)', fontWeight: 650 }}>
                {' '}
                · 변경 {totalDirty}개
              </span>
            )}
          </div>
          {!IN_EDITOR && (
            <button className="btn-ghost" title="에디터 탭에서 넓게 열기" onClick={() => send({ type: 'openInEditor' })}>
              <Icon name="expand" size={14} />
              확장해서 열기
            </button>
          )}
          <button className="btn-ghost" onClick={() => workspaces.forEach((w) => scan(w.path))}>
            <Icon name="refresh" size={14} />
            전체 새로고침
          </button>
          <button className="scan-btn" onClick={() => send({ type: 'addWorkspace' })}>
            <Icon name="plus" size={14} />
            워크스페이스 추가
          </button>
        </div>
        <div className="repos-meta-row">
          <div className="repos-filters" style={{ marginLeft: 0 }}>
            {([['all', '전체'], ['dirty', '변경됨'], ['ahead', '동기화 필요'], ['ci', 'CI 실패']] as const).map(
              ([id, label]) => (
                <button key={id} className={'chip' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>
                  {label}
                </button>
              )
            )}
          </div>
          <div className="repo-search" style={{ marginLeft: 'auto' }}>
            <Icon name="search" size={13} style={{ color: 'var(--text-3)' }} />
            <input value={q} placeholder="필터…" onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="repo-scroll">
        {workspaces.length === 0 ? (
          <div className="repos-empty">
            <div>
              <div style={{ fontSize: 15, color: 'var(--text-2)', marginBottom: 8 }}>워크스페이스가 없습니다</div>
              <div style={{ marginBottom: 16 }}>프로젝트 그룹 경로를 추가하면 하위 git 레포를 모아서 보여줍니다.</div>
              <button className="scan-btn" style={{ display: 'inline-flex' }} onClick={() => send({ type: 'addWorkspace' })}>
                <Icon name="plus" size={14} />
                워크스페이스 추가
              </button>
            </div>
          </div>
        ) : (
          workspaces.map((ws) => {
            const st = results[ws.path]
            const repos = (st?.repos || []).filter(matches)
            const isCollapsed = !!collapsed[ws.path]
            return (
              <div key={ws.path} className={'ws-group' + (isCollapsed ? ' collapsed' : '')} data-ws={ws.path}>
                <div className="ws-group-head">
                  <button className="ws-toggle" title={isCollapsed ? '펼치기' : '접기'} onClick={() => toggleCollapse(ws.path)}>
                    <Icon name={isCollapsed ? 'chevR' : 'chevD'} size={15} />
                  </button>
                  <Icon name="folderOpen" size={16} style={{ color: 'var(--accent)' }} />
                  <span className="ws-name" onClick={() => toggleCollapse(ws.path)}>{ws.name}</span>
                  <span className="ws-path">{ws.path}</span>
                  <span className="ws-count">{st?.scanning ? '스캔 중…' : `${st?.repos.length ?? 0}개`}</span>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} title="이름 변경" onClick={() => send({ type: 'renameWorkspace', path: ws.path })}>
                    <Icon name="edit" size={13} />
                  </button>
                  <button className="icon-btn" style={{ width: 26, height: 26 }} title="새로고침" onClick={() => scan(ws.path)}>
                    <Icon name="refresh" size={14} />
                  </button>
                  <button
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    title="워크스페이스 제거"
                    onClick={() => send({ type: 'removeWorkspace', path: ws.path })}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                {isCollapsed ? null : st?.scanning ? (
                  <div className="scan-spin" style={{ padding: '8px 2px 16px' }}>
                    <span className="spinner" />
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{ws.path}</span> 에서 .git 검색 중…
                  </div>
                ) : st?.error ? (
                  <div className="ws-note">{st.error}</div>
                ) : repos.length ? (
                  <div className="repo-grid">
                    {repos.map((r, i) => (
                      <RepoCard
                        key={r.abs}
                        r={r}
                        delay={i * 30}
                        onOpenCurrent={() => send({ type: 'openRepo', abs: r.abs, name: r.name, newWindow: false })}
                        onOpenNew={() => send({ type: 'openRepo', abs: r.abs, name: r.name, newWindow: true })}
                        onDiff={() => openDiff(r.abs, r.name)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ws-note">
                    {(st?.repos.length ?? 0) > 0 ? '필터에 해당하는 레포지토리가 없습니다.' : 'git 레포지토리를 찾지 못했습니다.'}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {diff && <DiffOverlay st={diff} onClose={() => { diffAbs.current = null; setDiff(null) }} />}
    </div>
  )
}

// Mirror VS Code's theme kind onto data-theme so the ported Aurora CSS variables resolve.
function syncTheme(): void {
  const b = document.body.classList
  const theme = b.contains('vscode-light') ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
}
new MutationObserver(syncTheme).observe(document.body, { attributes: true, attributeFilter: ['class'] })
syncTheme()

createRoot(document.getElementById('root')!).render(<App />)
