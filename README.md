# Aurora Workspaces (VS Code extension)

Aurora IDE의 **워크스페이스 탭**을 VS Code extension(Webview 방식)으로 옮긴 것입니다.
부모 폴더를 등록하면 하위 git 레포지토리를 깊이 5까지 스캔해 카드로 모아 보여주고,
카드를 클릭하면 해당 레포를 엽니다.

## 기능

- **레포 열기**: 카드 클릭 → 현재 창에서 열기. 카드 우측 상단 ⧉ 버튼 → 새 창에서 열기.
- **워크스페이스 접기/펴기**: 그룹 헤더의 ▸/▾ (또는 이름 클릭)으로 토글. 상태는 뷰를 다시 열어도 유지됩니다.
- **워크스페이스 이름 변경**: 그룹 헤더의 ✏️ 버튼 → 입력창에서 이름 변경 (기본값은 폴더명).
- **변경사항 보기**: 변경된 레포 카드의 "N 변경" 배지 클릭 → VS Code 창을 새로 열지 않고
  패널 안에서 HEAD 대비 diff(파일 목록 + 색상 표시)를 바로 확인.
- **자동 업데이트(자체)**: 시작 시 GitHub Releases에서 더 높은 버전을 확인해 알림 →
  클릭하면 최신 `.vsix`를 받아 설치하고 새로고침 안내. 마켓플레이스 미게시 상태의
  사이드로드 확장을 최신으로 유지하는 경로입니다.
  - 끄기: 설정 `auroraWorkspaces.checkForUpdates`(기본 켜짐)
  - 수동 확인: 명령 팔레트 → **Aurora: Check for Updates**

## 구조 — 무엇이 그대로 옮겨졌나

| 파일 | 출처 (aurora-ide) | 비고 |
|---|---|---|
| `src/scan.ts` | `src/main/ipc/git.ts` | `fast-glob` + `simple-git` 스캔 로직 **거의 무수정 이식** |
| `webview/main.tsx` | `src/renderer/src/components/RepositoriesView.tsx` | React UI 이식. sidebar scroll-spy만 제거 |
| `webview/icons.tsx` | `src/renderer/src/icons.tsx` + `data.ts` | 사용하는 아이콘·`LANG_COLOR`만 발췌 |
| `media/style.css` | `src/renderer/src/aurora.css` | repo 뷰 관련 클래스 + 테마 변수 발췌 |
| `src/extension.ts` | `src/main/index.ts` + `preload/index.ts` | Electron IPC → Webview `postMessage` 브리지로 대체 |

## 통신 (Electron IPC → Webview 메시지)

원래 `window.aurora.scanRepos(path)` (preload → `ipcMain.handle('git:scan')`)였던 부분이
webview ↔ 확장 호스트 간 `postMessage` 프로토콜로 바뀌었습니다. 요청/응답 모양은 동일합니다.

- webview → host: `ready` / `scan` / `addWorkspace` / `removeWorkspace` / `openRepo`
- host → webview: `workspaces` / `scanResult` / `scanError` / `refresh`

## 원본과 달라진 점

- **레포 열기**: 원본은 내부 작업공간을 전환했지만, 여기서는 `vscode.openFolder`로 엽니다
  (`auroraWorkspaces.openInNewWindow` 설정으로 새 창/현재 창 선택).
- **워크스페이스 목록**: `context.globalState`에 저장되어 VS Code 창 전체에서 유지됩니다.
- **전체 창 글래스 셸**: VS Code는 사이드바 패널에 한정되므로 카드 UI만 옮겼습니다.

## 개발 / 실행

```bash
cd vscode-extension
npm install
npm run build          # 또는 npm run watch
```

그다음 VS Code에서 이 폴더를 열고 **F5** (Run Extension) → 새 Extension Development Host 창이 뜹니다.
좌측 액티비티 바의 Aurora 아이콘 → "워크스페이스 추가"로 부모 폴더를 등록하세요.

패키징:

```bash
npm run package        # vsce 필요: npm i -g @vscode/vsce
```
