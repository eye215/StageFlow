# StageFlow

뮤지컬·공연 준비와 운영을 한곳에서 관리하는 모바일 우선 웹앱입니다.

## 현재 구현

- Supabase 이메일 매직링크 로그인
- 팀 작업공간 생성
- 공연 생성·조회·삭제
- 공연별 장면 생성·조회·삭제
- 공연 준비도 표시
- iPhone 대응 반응형 UI

## 실행

```bash
npm install
npm run dev
```

## Supabase

현재 프로젝트는 StageFlow Supabase 스키마의 다음 항목을 사용합니다.

- `workspace_members`
- `workspaces`
- `productions`
- `scenes`
- `create_workspace(workspace_name)` RPC

Supabase Authentication의 Redirect URL에는 로컬 및 실제 배포 주소를 추가해야 합니다.
