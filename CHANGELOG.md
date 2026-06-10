# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/)를
느슨하게 따르며, 버전은 [SemVer](https://semver.org/)를 따릅니다.

## [0.5.0]
### Added
- **즐겨찾기**: 카드의 ★ 버튼으로 토글. 즐겨찾기 레포는 그룹 내 맨 위로 정렬되고, "즐겨찾기" 필터 칩 추가.
  (`context.globalState`에 저장, 사이드바·에디터 탭 동기화)

## [0.4.3]
### Fixed
- 브랜치명이 길면 repo 이름이 잘리던 문제 — repo 이름이 첫 줄 전체 폭을 사용하도록 변경,
  브랜치 pill을 메타 줄로 이동.

## [0.4.2]
### Changed
- 레포 열기 UX 정리: **카드 클릭 = 현재 창**, **우측 상단 작은 ⧉ 아이콘 = 새 창**.
  기존의 큰 버튼 두 개(현재 창/새 창) 제거.

## [0.4.1]
### Fixed
- 자동 업데이트 확인이 `api.github.com` rate limit(공용 IP 60회/시간)에 막혀 "릴리스를 찾을 수 없습니다"가
  뜨던 문제 — rate limit이 없는 `github.com` 릴리스 Atom 피드 + 결정적 다운로드 URL 방식으로 변경.

## [0.4.0]
### Added
- **넓게 보기(에디터 탭)**: 같은 UI를 에디터 영역 전체 폭의 WebviewPanel로 여는 기능.
  사이드바와 상태 실시간 동기화, 탭 닫으면 원복.

## [0.3.0]
### Added
- **자체 자동 업데이트 체커**: 시작 시 GitHub Releases에서 새 버전 확인 → 알림 → `.vsix` 다운로드/설치.
  설정 `auroraWorkspaces.checkForUpdates`, 명령 `Aurora: Check for Updates`.

## [0.2.0]
### Added
- **현재 창/새 창에서 열기** 선택
- **워크스페이스 접기/펴기** (상태 유지)
- **워크스페이스 이름 변경**
- **인라인 git diff 뷰어**: VS Code 창을 새로 열지 않고 HEAD 대비 변경 내용 확인.

## [0.1.0]
### Added
- 최초 릴리스. 부모 폴더 스캔 → 하위 git 레포 카드 표시, 클릭 시 레포 열기.
- esbuild 기반 빌드(확장 호스트 + 웹뷰), push 시 자동 빌드/릴리스하는 GitHub Actions 파이프라인.
