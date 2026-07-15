# StageFlow

뮤지컬 공연의 준비와 실전 진행을 한곳에서 관리하는 모바일 우선 웹앱입니다.

## 현재 구현

- Supabase 이메일 매직링크 로그인
- 팀 작업공간 생성
- 공연 생성·조회·삭제
- 공연별 장면 생성·조회·삭제
- 공연 준비도와 D-day 표시
- 장면 단위 공연 모드와 GO 진행
- iPhone 안전 영역을 포함한 반응형 UI

## 실행

```bash
npm install
npm run dev
```

루트에 `.env` 파일을 만들고 다음 값을 설정합니다.

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

앱은 Supabase의 `workspaces`, `workspace_members`, `productions`, `scenes` 테이블과 `create_workspace(workspace_name)` RPC를 사용합니다.
