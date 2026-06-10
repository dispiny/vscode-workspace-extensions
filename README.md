# Aurora Workspaces (VS Code extension)

Aurora IDE의 **워크스페이스 탭**을 VS Code 확장(Webview 방식)으로 옮긴 것입니다.
부모 폴더(워크스페이스)를 등록하면 그 아래의 git 레포지토리를 깊이 5까지 스캔해 카드로 모아 보여주고,
카드를 클릭하면 해당 레포를 엽니다.

> 좌측 액티비티 바의 **Aurora** 아이콘에서 열립니다.

## 기능

- **레포 스캔 / 보기**: 등록한 워크스페이스마다 하위 `.git`을 찾아 레포 카드(브랜치·언어·변경 수·ahead/behind·마지막 커밋)로 표시.
- **레포 열기**:
  - 카드 **본문 클릭** → **현재 창**에서 열기
  - 카드 우측 상단 **⧉ 아이콘** → **새 창**에서 열기
  - 기본 동작은 설정 `auroraWorkspaces.openInNewWindow`로도 조정 가능
- **즐겨찾기**: 카드의 **★ 버튼**으로 즐겨찾기 토글. 즐겨찾기한 레포는 그룹 내 **맨 위로 정렬**되고,
  상단 **즐겨찾기** 필터 칩으로 모아 볼 수 있습니다. (창 전체에서 유지)
- **워크스페이스 접기/펴기**: 그룹 헤더의 **▸/▾**(또는 이름 클릭)으로 토글. 상태는 뷰를 다시 열어도 유지.
- **워크스페이스 이름 변경**: 그룹 헤더의 **✏️ 버튼** → 입력창에서 표시 이름 변경 (기본값은 폴더명).
- **변경사항 보기 (창 없이)**: 변경된 레포 카드의 **"N 변경" 배지** 클릭 → VS Code 창/에디터를 새로 열지 않고
  패널 안에서 HEAD 대비 diff(변경 파일 목록 + 색상 표시)를 바로 확인.
- **넓게 보기 (에디터 탭)**: 사이드바 헤더의 **확장해서 열기**(명령 **Aurora: Open in Editor**) →
  같은 UI를 에디터 영역 전체 폭의 탭으로 엽니다. 탭을 닫으면 원래 레이아웃으로 복귀하며,
  사이드바와 상태가 실시간 동기화됩니다.
  - VS Code는 사이드바 폭 자체를 확장이 조절하는 API를 제공하지 않아, 넓게 보려면 에디터 탭 방식을 씁니다.
- **자동 업데이트(자체)**: 시작 시 GitHub Releases에서 더 높은 버전을 확인해 알림 → 클릭하면 최신 `.vsix`를
  받아 설치하고 새로고침을 안내합니다. (마켓플레이스 미게시 사이드로드 확장을 최신으로 유지하는 경로)
  - rate limit이 있는 `api.github.com` 대신 **`github.com`의 릴리스 Atom 피드**를 사용해 공용 IP에서도 안정적.
  - 끄기: 설정 `auroraWorkspaces.checkForUpdates`(기본 켜짐) · 수동 확인: 명령 **Aurora: Check for Updates**

## 명령 (Command Palette)

| 명령 | 설명 |
|---|---|
| `Aurora: Add Workspace Folder` | 폴더 선택 대화상자로 워크스페이스 추가 |
| `Aurora: Refresh Repositories` | 전체 워크스페이스 재스캔 |
| `Aurora: Open in Editor` | UI를 넓은 에디터 탭으로 열기 |
| `Aurora: Check for Updates` | 새 버전 수동 확인/설치 |

## 설정 (Settings)

| 키 | 기본값 | 설명 |
|---|---|---|
| `auroraWorkspaces.openInNewWindow` | `true` | 레포 열기 기본 동작(새 창/현재 창). UI의 명시적 선택이 우선. |
| `auroraWorkspaces.scanDepth` | `5` | `.git`을 찾을 디렉터리 깊이. |
| `auroraWorkspaces.checkForUpdates` | `true` | 시작 시 새 버전 자동 확인. |

## 설치

GitHub Releases에서 `.vsix`를 받아 설치합니다.

```bash
gh release download --repo dispiny/vscode-workspace-extensions --pattern '*.vsix' --dir /tmp
code --install-extension /tmp/aurora-workspaces-*.vsix
```

설치 후 좌측 Aurora 아이콘 → **워크스페이스 추가**로 부모 폴더를 등록하세요.
한 번 설치하면 이후 새 릴리스는 확장이 자동으로 감지해 업데이트를 제안합니다.

## 개발 / 실행

```bash
npm install
npm run build      # 1회 빌드 (또는 npm run watch 로 감시 빌드)
```

VS Code에서 이 폴더를 열고 **F5**(Run Extension) → 새 Extension Development Host 창이 뜹니다.

빌드는 esbuild로 두 번들을 만듭니다:
- **확장 호스트**(`dist/extension.js`) — Node, `vscode`만 external, 나머지(`fast-glob`/`simple-git`) 번들
- **웹뷰**(`media/webview.js`) — 브라우저, React 앱 번들

수동 패키징:

```bash
npm run package    # @vscode/vsce 필요. 산출물: aurora-workspaces-<ver>.vsix
```

## 릴리스 (CI 자동)

`.github/workflows/release.yml`:
- **main에 push** → `npm ci` → `tsc --noEmit` → `npm run build` (항상)
- `package.json`의 **version이 올라간 경우에만** → vsix 패키징 + 동일 태그(`v<version>`)로 GitHub Release 생성

즉 새 릴리스를 내려면 버전을 올려서 push하면 됩니다:

```bash
npm version patch       # package.json + lock 버전 갱신
git push --follow-tags
```

## 구조 — 무엇이 그대로 옮겨졌나

| 파일 | 출처 (aurora-ide) | 비고 |
|---|---|---|
| `src/scan.ts` | `src/main/ipc/git.ts` | `fast-glob` + `simple-git` 스캔/diff 로직 이식 |
| `webview/main.tsx` | `src/renderer/src/components/RepositoriesView.tsx` | React UI 이식 (+ 즐겨찾기/접기/diff/에디터탭) |
| `webview/icons.tsx` | `src/renderer/src/icons.tsx` + `data.ts` | 사용하는 아이콘·`LANG_COLOR` 발췌 |
| `media/style.css` | `src/renderer/src/aurora.css` | repo 뷰 클래스 + 테마 변수 발췌 |
| `src/extension.ts` | `src/main/index.ts` + `preload/index.ts` | Electron IPC → Webview `postMessage` 브리지 |
| `src/update.ts` | (신규) | 자체 업데이트 체커 |

## 통신 (Electron IPC → Webview 메시지)

원래 `window.aurora.scanRepos(path)` (preload → `ipcMain.handle('git:scan')`)였던 부분이
webview ↔ 확장 호스트 간 `postMessage` 프로토콜로 바뀌었습니다.

- **webview → host**: `ready` · `scan` · `addWorkspace` · `removeWorkspace` · `renameWorkspace` ·
  `openRepo` · `repoDiff` · `openInEditor` · `toggleFavorite`
- **host → webview**: `workspaces` · `scanResult` · `scanError` · `refresh` · `repoDiff` · `favorites`

상태(워크스페이스 목록, 즐겨찾기)는 `context.globalState`에 저장되어 사이드바·에디터 탭·창 전체에서 공유됩니다.

## 원본과 달라진 점

- **레포 열기**: 원본은 내부 작업공간을 전환했지만, 여기서는 `vscode.openFolder`로 엽니다.
- **전체 창 글래스 셸**: VS Code는 사이드바/에디터 영역에 한정되므로 카드 UI만 옮겼습니다.

자세한 버전별 변경은 [CHANGELOG.md](./CHANGELOG.md) 참고.
