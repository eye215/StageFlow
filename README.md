# StageFlow

뮤지컬 공연의 준비와 실전 진행을 한곳에서 관리하는 모바일 우선 웹앱입니다.

## 제품 문서

- [제품·기능 명세서](docs/PRODUCT_SPEC.md)
- [데이터베이스 구조](docs/DATABASE_STRUCTURE.md)

## 현재 구현

- Supabase 이메일·비밀번호 로그인
- 팀 작업공간 생성
- 공연 생성·조회·삭제
- 공연별 장면 생성·조회·삭제
- 공연 준비도와 D-day 표시
- 페어 선택 기반 런 모드와 장면별 GO 기록
- PDF·엑셀·표 자동정리
- 배우·복수 배역·등장 장면 연결
- 음악별 배우 안무 참여·제외 설정
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

## 관계형 데이터 마이그레이션

공연별 접근권한과 v4·v5 스키마를 적용한 뒤 `supabase/stageflow_v7_performance_relations.sql`을 실행합니다. 이 마이그레이션은 기존 데이터를 삭제하지 않고 다음 관계를 추가합니다.

- `Scene ↔ Song`: `scene_songs` N:M
- `Actor + Character + Pair`: `castings`
- `Casting ↔ Song`: `casting_song_settings`의 음악별 안무 제외
- `Song ↔ Costume`: `song_costumes`
- 공연별 외부 링크와 Run 참여자·오디오 출력 소유자
