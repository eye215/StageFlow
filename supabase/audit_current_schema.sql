-- 현재 Supabase 구조 확인용: 데이터를 수정하지 않습니다.
-- 결과 CSV를 전달하면 legacy -> v4 실제 이전 SQL을 정확히 만들 수 있습니다.

select
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
order by c.table_name, c.ordinal_position;
