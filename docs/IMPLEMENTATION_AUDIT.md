# StageFlow 구현 대조 점검

기준일: 2026-08-11  
기준: 누적 요구사항과 `main` 브랜치의 실제 코드·SQL 비교

## 완료

- 공연 단위 팀원·초대 링크 분리 및 초대 공연 ID 검증
- 장면 번호 `0` 입력, 정렬, 표시
- 대본 PDF 텍스트 추출과 전체 페이지 저해상도 OCR 보조
- 표 헤더 기반 자동정리, 신규 추가/병합 선택, 적용 대상 선택
- AI 분석 실패 시 규칙 기반 분석으로 전환
- 음악 파일명과 장면·넘버 제목 자동 매칭, 한 넘버의 복수 파일, 드래그 순서 변경
- Scene↔Song N:M 저장(`scene_songs`), 세부 장면은 선택 정보로 유지
- 배역 1Depth·2Depth, 배우, 페어별 캐스팅 편집
- 음악별 배우 안무 제외
- 페어 선택 후 런 참여 배우 추가 선택
- GO마다 장면 런타임 기록, 마지막 GO에서 런 종료와 개인 피드백 작성
- 런 화면에서 현재 장면의 큐·음악·배역·의상·소품과 다음 장면 준비 표시
- 하나의 출력 기기와 여러 제어 기기로 사용하는 공유 음악 플레이어
- 소품·대도구 한 항목을 여러 장면에 동시 등록
- 자료 자동정리 안의 공연별 Notion Data Source 설정과 미리보기

## 이번 점검에서 수정

- 자동정리 음악이 레거시 `soundtracks.scene_id`만 채우던 문제를 수정해 `scene_songs`도 저장
- Scene 0에 연결된 소품 카드에서 장면명이 숨는 조건 수정
- 소품·대도구 등록 시 여러 장면을 선택할 수 있는 모바일 선택 UI 추가
- 더보기에서 빠져 있던 `넘버·음악` 진입 메뉴 복구
- 런 시작 전 긴 장면 화면을 숨기고 페어·참여 배우·첫 장면 준비만 표시
- 런 중 중복 음악 플레이어와 중복 큐 영역 제거
- 문서 전체 클릭 가로채기에 의존하던 GO/이전 동작을 React 이벤트로 교체
- 이전 장면으로 돌아갈 때 직전 장면 기록을 되돌려 중복 런타임이 쌓이지 않도록 수정
- 마지막 장면의 중복 종료 버튼을 하나로 통합

## 부분 완료: 다음 구조 작업 필요

1. **배우·배역·페어 관계형 저장**
   - 화면 정책과 동작은 `배역 → 페어별 배우`로 구현되어 있다.
   - 현재 주 저장소는 공연 Storage의 `cast.json`이고, `people`, `characters`, `pairs`, `castings`는 마이그레이션 스키마만 준비된 상태다.
   - 다음 작업은 기존 JSON을 관계형 테이블로 이관하고 JSON은 읽기 호환으로만 남기는 것이다.

2. **런 참여자 관계형 저장**
   - 참여 배우 선택과 런 기록 JSON에는 반영된다.
   - `run_participants` 테이블 기록은 위 캐스팅 관계형 이전과 함께 연결해야 한다.

3. **음악별 의상**
   - `song_costumes` 스키마과 `장면 의상 > 음악 의상 > 이전 의상` 우선순위 원칙은 존재한다.
   - 현재 편집 화면과 런 계산은 장면 요약의 의상 데이터를 우선 사용하므로 음악별 의상 편집·조회 연결이 남아 있다.

4. **Notion 양방향 동기화**
   - 공연별 Data Source ID, 가져올 항목 선택, 미리보기·가져오기는 구현되어 있다.
   - StageFlow 수정 내용을 Notion으로 내보내는 양방향 동기화와 충돌 해결은 아직 없다.

5. **소품·큐의 완전한 관계형 연결**
   - 화면에서는 장면, IN/OUT 담당, 큐와 연결해 보여준다.
   - 담당 배우·배역은 아직 문자열 중심이므로 `actor_id`, `character_id`, `scene_id` 외래키 이전이 남아 있다.

6. **레거시 코드 제거**
   - 연습 일정·할 일·개인 연습 기록은 메뉴에서 노출되지 않고 이전 URL도 개요로 보낸다.
   - `RehearsalPanel`, `TasksPanel`, `SchedulePanel` 소스는 이전 데이터 읽기 호환을 위해 아직 남아 있다.

## 필수 Supabase 적용 순서

새 프로젝트 또는 누락된 프로젝트에서는 다음 SQL을 순서대로 적용한다.

1. `supabase/production_scoped_access.sql`
2. `supabase/stageflow_v4_clean_schema.sql`
3. `supabase/stageflow_v5_master_actor_flow.sql`
4. `supabase/stageflow_v6_soundtrack_notion.sql`
5. `supabase/stageflow_v7_performance_relations.sql`
6. `supabase/shared_playback.sql`
7. `supabase/increase_storage_limit.sql` (100MB 음악·자료를 받을 때)

`scene_songs`, `production_members`, `production_playback` 오류는 대부분 위 마이그레이션 일부가 빠졌을 때 발생한다.

AI·Notion을 사용할 때는 `analyze-production`, `sync-notion` Edge Function도 각각 배포되어 있어야 하며, 비밀키는 브라우저 환경변수가 아니라 Supabase Function Secrets에만 저장한다.

## 우선순위

1. `cast.json` → people/characters/pairs/castings 관계형 이전
2. 음악별 의상 편집과 런 우선순위 적용
3. 소품·큐 담당자 외래키 연결
4. Notion 내보내기 및 충돌 정책
5. 레거시 패널과 중복 CSS 제거
