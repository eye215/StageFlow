-- StageFlow 공연 음원·대본·영상 업로드 한도: 파일당 100MB
-- 현재 프로젝트 요금제의 최대 허용량이 더 낮으면 그 상한이 우선합니다.

update storage.buckets
set file_size_limit = 104857600
where id = 'stageflow-files';

select id, name, file_size_limit
from storage.buckets
where id = 'stageflow-files';
