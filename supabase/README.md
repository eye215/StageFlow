# StageFlow Supabase

## 기준 구조

- `production_scoped_access.sql`: 공연별 멤버십·초대·RLS
- `stageflow_v4_clean_schema.sql`: 배우·배역·페어·장면 연결·자료·런·피드백의 최종 구조
- `shared_playback.sql`: 공연 참여자 공동 음악 제어와 단일 Audio Output Device 상태
- `secure_feedback_storage.sql`: 기존 Storage 피드백을 수신자·작성자에게만 공개
- `increase_storage_limit.sql`: 공연 음원·자료 파일당 업로드 한도를 100MB로 설정
- `audit_current_schema.sql`: 현재 DB 확인용 읽기 전용 쿼리

## Legacy 호환 파일

- `team_invites.sql`: workspace 단위였던 이전 초대 방식. 새 DB에서는 실행하지 않는다.
- `pairs_cast_schema.sql`: v4 이전 과도기 페어 구조. 새 DB에서는 실행하지 않는다.
- `fix_production_people_display_name.sql`: 과도기 테이블 오류 복구 전용이다.

## 적용 순서

라이브 DB에는 바로 초기화 SQL을 실행하지 않는다.

1. `audit_current_schema.sql` 결과 백업
2. 기존 JSON·테이블을 v4로 옮기는 데이터 마이그레이션 실행
3. 앱을 v4 읽기 우선 + legacy fallback으로 전환
4. 검증 후 legacy 쓰기 중단
5. 최종 백업 뒤 legacy 구조 제거

새 Supabase 프로젝트라면 아래 순서로 실행한다.

1. `production_scoped_access.sql`
2. `stageflow_v4_clean_schema.sql`
3. `stageflow_v5_master_actor_flow.sql`
4. `stageflow_v6_soundtrack_notion.sql`
5. `stageflow_v7_performance_relations.sql`
6. `shared_playback.sql`
7. `secure_feedback_storage.sql`
8. `increase_storage_limit.sql`

기존 라이브 DB가 Storage 기반 피드백을 사용 중이면 `secure_feedback_storage.sql`도 한 번 실행한다.
