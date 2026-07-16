# StageFlow 데이터베이스 구조

## 현재 사용 구조

### Supabase 관계형 테이블

- `workspaces`: 공연팀 작업공간
- `workspace_members`: 작업공간 사용자와 권한
- `productions`: 공연 기본정보
- `scenes`: 공연별 장면. 현재 배역·소품·큐 일부가 `summary` 텍스트에도 포함됨
- `workspace_invites`: 공연팀 초대 링크

### Supabase Storage (`stageflow-files`)

- `{workspace}/{production}/data/cast.json`: 배우·배역·등장 장면
- `{workspace}/{production}/data/props.json`: 소품·대도구
- `{workspace}/{production}/data/readiness.json`: 공연 회차 준비 상태
- `{workspace}/{production}/data/show-cursor.json`: GO 진행 위치
- `{workspace}/{production}/data/show-log.json`: 공연 이벤트 기록
- `{workspace}/{production}/data/run-log.json`: 런 기록
- `{workspace}/{production}/imports/`: PDF·엑셀·자동정리 원본
- `{workspace}/{production}/music/{scene_no}/`: 장면별 음악
- `{workspace}/{production}/materials/{category}/`: 대본·악보·영상·이미지·기타

현재 `cast.json`, `props.json`, 장면 `summary`가 혼합돼 있어 검색·동시수정·페어 관리가 어렵다. 신규 관계형 테이블을 먼저 추가하고 앱을 순차 이전한다.

## 신규 페어·배우·배역 구조

```text
productions
 ├─ production_pairs (A페어, B페어, 언더스터디)
 ├─ production_people (실제 배우 이름, 로그인 계정)
 ├─ production_roles (1Depth/2Depth 계층)
 └─ pair_cast_assignments
      ├─ pair_id
      ├─ person_id
      ├─ role_depth1_id
      └─ role_depth2_id
           └─ scene_cast_assignments → scenes
```

### 예시

| 페어 | 배우 이름 | 1Depth 배역 | 2Depth 배역 |
|---|---|---|---|
| A페어 | 김다더 | 앙상블 | 경찰 |
| A페어 | 김다더 | 앙상블 | 시민 |
| B페어 | 박앤더 | 앙상블 | 경찰 |
| A페어 | 이영수 | 앤더슨 | 기본 |

`pair_cast_assignments`는 동일 배우의 복수 배역을 허용한다. `scene_cast_assignments`는 해당 페어·배역이 어느 장면에 메인·등장·백·대기로 참여하는지 연결한다.

## 적용 순서

1. Supabase SQL Editor에서 `supabase/pairs_cast_schema.sql` 실행
2. 배우 탭을 신규 테이블과 병행 읽기로 변경
3. 기존 `cast.json`을 신규 테이블로 일회성 이전
4. 페어 선택 UI와 장면 등장 연결을 신규 테이블 기준으로 변경
5. 검증 후 `cast.json` 쓰기 중단(백업 읽기는 유지)

이번 SQL은 기존 테이블이나 JSON을 삭제하지 않는 추가 마이그레이션이다.
