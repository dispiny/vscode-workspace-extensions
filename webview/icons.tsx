// Subset of aurora-ide src/renderer/src/icons.tsx — only the icons the repo view uses.
import React from 'react'

export const IPATHS: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  branch:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 3-3 3.5-6 4.5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 4v4h-4"/>',
  gitrepo:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="2"/><path d="M12 15v2M12 11v-1"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
  chevR: '<path d="m9 6 6 6-6 6"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  newWin: '<path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  expand: '<path d="M3 9V3h6"/><path d="M21 15v6h-6"/><path d="M3 3l7 7"/><path d="M21 21l-7-7"/>',
  star: '<path d="M12 17.3l-5.4 3.3 1.5-6.2L3.2 10.2l6.3-.5L12 4l2.5 5.7 6.3.5-4.9 4.2 1.5 6.2z"/>',
  starOn: '<path fill="currentColor" stroke="none" d="M12 17.3l-5.4 3.3 1.5-6.2L3.2 10.2l6.3-.5L12 4l2.5 5.7 6.3.5-4.9 4.2 1.5 6.2z"/>',
  diff: '<path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  folderOpen:
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2H3z"/><path d="M3 9h18l-2 9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/>'
}

export function Icon({
  name,
  size = 18,
  style
}: {
  name: string
  size?: number
  style?: React.CSSProperties
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: IPATHS[name] || '' }}
    />
  )
}

export const LANG_COLOR: Record<string, string> = {
  Terraform: '#7b42bc', Go: '#00add8', TypeScript: '#3178c6', Rust: '#dea584',
  Helm: '#0f1689', YAML: '#cb171e', Shell: '#89e051', Markdown: '#6a737d', Python: '#3572a5'
}
