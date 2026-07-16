# StageFlow

뮤지컬 공연의 준비와 실전 진행을 한곳에서 관리하는 모바일 우선 웹앱입니다.

## 제품 문서

- [제품·기능 명세서](docs/PRODUCT_SPEC.md)

## 현재 구현

- Supabase 이메일·비밀번호 로그인
- 팀 작업공간 생성
- 공연 생성·조회·삭제
- 공연별 장면 생성·조회·삭제
- 공연 준비도와 D-day 표시
- 장면 단위 공연 모드와 GO 진행
- PDF·엑셀·표 자동정리
- 배우·복수 배역·등장 장면 연결
- 의상·소품·음악·큐 관리
- 팀원 초대 및 배우 선택
- 리허설·공연 런타임과 실시간 준비 상태
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
