# StageFlow Supabase

## 기준 구조

- `production_scoped_access.sql`: 공연별 멤버십·초대·RLS
- `stageflow_v4_clean_schema.sql`: 배우·배역·페어·장면 연결·자료·런·피드백의 최종 구조
- `shared_playback.sql`: 공연 참여자 공동 음악 재생·정지·곡 변경 실시간 상태
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

새 Supabase 프로젝트라면 `production_scoped_access.sql` 다음 `stageflow_v4_clean_schema.sql` 순서로 실행한다.
