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
