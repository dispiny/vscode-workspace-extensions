import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Icon, LANG_COLOR } from './icons'
import { send, onHostMessage, RepoInfo, Workspace } from './bridge'

interface WSState {
  scanning: boolean
  repos: RepoInfo[]
  error?: string
}

function RepoCard({ r, delay, onOpen }: { r: RepoInfo; delay: number; onOpen: () => void }): React.JSX.Element {
  return (
    <div
      className="repo-card repo-card-click"
      style={{ animationDelay: delay + 'ms' }}
      onClick={onOpen}
      title="클릭하면 이 레포를 엽니다"
    >
      <div className="repo-top">
        <span className="repo-ic" style={{ background: 'var(--hover)' }}>
          <Icon name="gitrepo" size={17} style={{ color: 'var(--accent)' }} />
        </span>
        <span className="repo-name">{r.name}</span>
        <span className="branch-pill">
          <Icon name="branch" size={11} />
          <span>{r.branch}</span>
        </span>
      </div>
      <div className="repo-path">{r.abs}</div>
      <div className="repo-meta">
        <span className="mi">
          <span className="lang-dot" style={{ background: LANG_COLOR[r.lang] || 'var(--text-3)' }} />
          {r.lang}
        </span>
        {r.dirty ? (
          <span className="mi dirty"><Icon name="dot" size={10} /><b>{r.dirty}</b> 변경</span>
        ) : (
          <span className="mi clean"><Icon name="check" size={13} />정상</span>
        )}
        {r.ahead > 0 && <span className="mi"><Icon name="arrowUp" size={12} />{r.ahead}</span>}
        {r.behind > 0 && <span className="mi"><Icon name="arrowDn" size={12} />{r.behind}</span>}
        <span className="mi open-hint" style={{ marginLeft: 'auto' }}>열기 <Icon name="chevR" size={12} /></span>
      </div>
      <div className="repo-commit">
        <span className="hash">{r.hash || '—'}</span>
        <span className="cmsg">{r.msg || '커밋 없음'}</span>
        <span className="cwhen">{r.when}</span>
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [results, setResults] = useState<Record<string, WSState>>({})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

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
          // re-scan everything
          setWorkspaces((ws) => {
            ws.forEach((w) => send({ type: 'scan', path: w.path }))
            return ws
          })
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
            return (
              <div key={ws.path} className="ws-group" data-ws={ws.path}>
                <div className="ws-group-head">
                  <Icon name="folderOpen" size={16} style={{ color: 'var(--accent)' }} />
                  <span className="ws-name">{ws.name}</span>
                  <span className="ws-path">{ws.path}</span>
                  <span className="ws-count">{st?.scanning ? '스캔 중…' : `${st?.repos.length ?? 0}개`}</span>
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
                {st?.scanning ? (
                  <div className="scan-spin" style={{ padding: '8px 2px 16px' }}>
                    <span className="spinner" />
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{ws.path}</span> 에서 .git 검색 중…
                  </div>
                ) : st?.error ? (
                  <div className="ws-note">{st.error}</div>
                ) : repos.length ? (
                  <div className="repo-grid">
                    {repos.map((r, i) => (
                      <RepoCard key={r.abs} r={r} delay={i * 30} onOpen={() => send({ type: 'openRepo', abs: r.abs, name: r.name })} />
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
