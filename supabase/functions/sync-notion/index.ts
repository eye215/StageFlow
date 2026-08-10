import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const notionToken = () => String(Deno.env.get('NOTION_TOKEN') || '')
  .trim()
  .replace(/^NOTION_TOKEN\s*=\s*/i, '')
  .replace(/^['"]|['"]$/g, '')
  .replace(/[^\x21-\x7E]/g, '')

const notionHeaders = () => {
  const token = notionToken()
  if (!/^(?:ntn_|secret_)[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error('NOTION_TOKEN 형식이 올바르지 않아요. Secret 값에는 토큰만 다시 붙여넣어 주세요.')
  }
  const headers = new Headers()
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Notion-Version', '2026-03-11')
  headers.set('Content-Type', 'application/json')
  return headers
}

const propertyText = (property: any) => {
  if (!property) return ''
  if (property.type === 'number') return property.number == null ? '' : String(property.number)
  if (property.type === 'select') return property.select?.name || ''
  if (property.type === 'multi_select') return (property.multi_select || []).map((item: any) => item.name).join(' / ')
  if (property.type === 'checkbox') return property.checkbox ? 'O' : 'X'
  const values = property.title || property.rich_text || property.people || []
  return values.map((value: any) => value.plain_text || value.name || '').join('').trim()
}

const pick = (properties: Record<string, any>, names: string[]) => {
  for (const name of names) {
    const value = propertyText(properties[name])
    if (value) return value
  }
  return ''
}

const numeric = (value: string) => Number(String(value || '').match(/\d{1,3}/)?.[0] || 0)

const normalizeSourceId = (value: string) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    const queryId = url.searchParams.get('data_source_id') || url.searchParams.get('database_id')
    if (queryId) return queryId.trim()
    return decodeURIComponent(url.pathname).match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0] || raw
  } catch {
    return raw.replace(/^data_source_id\s*[:=]\s*/i, '').trim()
  }
}

const mergeText = (left = '', right = '') => {
  const values = [left, right]
    .flatMap((value) => String(value || '').split(/\s*[|/,]\s*/))
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Map(values.map((value) => [value.toLowerCase().replace(/\s/g, ''), value])).values()].join(' / ')
}

const notionFailure = async (response: Response, action: string) => {
  let message = ''
  try {
    const payload = await response.json()
    message = payload?.message || payload?.code || ''
  } catch {
    message = await response.text().catch(() => '')
  }
  if (response.status === 401) return new Error('Notion 토큰이 올바르지 않아요. Edge Function의 NOTION_TOKEN을 다시 확인해 주세요.')
  if (response.status === 403) return new Error('Notion 연결에 콘텐츠 읽기 권한이 없어요. Integration에 Read content 권한을 켜 주세요.')
  if (response.status === 404) return new Error('Notion 데이터베이스를 찾지 못했어요. 원본 데이터베이스의 연결 추가에서 이 Integration을 공유해 주세요.')
  if (response.status === 429) return new Error('Notion 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.')
  return new Error(`${action} 실패 (${response.status})${message ? `: ${message}` : ''}`)
}

const queryDataSource = (sourceId: string, cursor?: string) => fetch(`https://api.notion.com/v1/data_sources/${sourceId}/query`, {
  method: 'POST',
  headers: notionHeaders(),
  body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
})

const resolveDataSource = async (inputId: string) => {
  const direct = await queryDataSource(inputId)
  if (direct.ok) return { id: inputId, name: '', firstPage: await direct.json() }
  if (direct.status !== 404) throw await notionFailure(direct, 'Notion 데이터 조회')

  const database = await fetch(`https://api.notion.com/v1/databases/${inputId}`, { headers: notionHeaders() })
  if (!database.ok) throw await notionFailure(database, 'Notion 데이터베이스 확인')
  const payload = await database.json()
  const source = payload?.data_sources?.[0]
  if (!source?.id) throw new Error('이 Notion 데이터베이스에 연결 가능한 Data Source가 없어요.')
  const firstPage = await queryDataSource(source.id)
  if (!firstPage.ok) throw await notionFailure(firstPage, 'Notion Data Source 조회')
  return { id: source.id, name: source.name || '', firstPage: await firstPage.json() }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = '요청 확인'
  try {
    if (!notionToken()) throw new Error('NOTION_TOKEN이 설정되지 않았어요.')
    const auth = String(request.headers.get('Authorization') || '').replace(/[^\x21-\x7E]/g, '')
    stage = '공연 권한 확인'
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    )
    const { productionId, dataSourceId, targets: requestedTargets } = await request.json()
    if (!productionId) throw new Error('공연 ID가 필요합니다.')
    const targets = { scenes: true, cast: true, props: true, costumes: true, cues: true, soundtracks: true, ...(requestedTargets || {}) }
    const { data: production, error: productionError } = await supabase
      .from('productions')
      .select('id, notion_data_source_id')
      .eq('id', productionId)
      .single()
    if (productionError) throw productionError
    const requestedSourceId = normalizeSourceId(dataSourceId || production.notion_data_source_id || '')
    if (!requestedSourceId) throw new Error('Notion Data Source ID가 필요합니다.')

    stage = 'Notion Data Source 연결'
    const resolved = await resolveDataSource(requestedSourceId)
    const sourceId = resolved.id
    const pages: any[] = []
    let payload = resolved.firstPage
    while (payload) {
      pages.push(...(payload.results || []))
      if (!payload.has_more || !payload.next_cursor) break
      const response = await queryDataSource(sourceId, payload.next_cursor)
      if (!response.ok) throw await notionFailure(response, 'Notion 다음 페이지 조회')
      payload = await response.json()
    }

    const sceneNumberKeys = ['씬번호', '장면 번호', 'Scene No', 'Scene', 'SCENE']
    const rows = new Map<number, any>()
    for (const page of pages) {
      const properties = page.properties || {}
      const sceneNo = numeric(pick(properties, sceneNumberKeys))
      if (!sceneNo) continue
      const current = rows.get(sceneNo) || {
        number: sceneNo, title: `SCENE ${sceneNo}`, main: '', ensemble: '', backstage: '', music: '', movement: '', status: '',
        props: [], costumes: [], cues: [], details: [], soundtracks: [], characters: [],
      }
      const title = pick(properties, ['장면명', '씬 제목', 'Scene Title', 'Title'])
      if (targets.scenes && title) current.title = title
      if (targets.cast) {
        current.main = mergeText(current.main, pick(properties, ['메인 배역', '주요 배역', 'Main Cast', 'Main']))
        current.ensemble = mergeText(current.ensemble, pick(properties, ['등장 앙상블', '앙상블', 'Ensemble']))
        current.backstage = mergeText(current.backstage, pick(properties, ['백 앙상블', '대기 인원', 'Back Ensemble', 'Backstage']))
      }
      if (targets.scenes) {
        current.music = mergeText(current.music, pick(properties, ['넘버', '음악', 'Music', 'Number']))
        current.movement = mergeText(current.movement, pick(properties, ['동선', '안무', 'Movement']))
        current.status = mergeText(current.status, pick(properties, ['현황', '상태', 'Status', '진도']))
      }
      if (targets.props) {
        const name = pick(properties, ['소품명', '대도구명', '준비물', 'Prop', 'Item'])
        if (name) current.props.push({
          kind: pick(properties, ['구분', '종류', 'Kind']) || '소품', name,
          inBy: pick(properties, ['In', 'IN', '반입']), outBy: pick(properties, ['Out', 'OUT', '반출']),
          note: pick(properties, ['비고', '메모', 'Note']),
        })
      }
      if (targets.costumes) {
        const name = pick(properties, ['의상명', '의상', 'Costume', 'Look'])
        if (name) current.costumes.push({
          character: pick(properties, ['의상 배역', '배역', 'Role', 'Character']), name,
          changeNote: pick(properties, ['체인지', '퀵체인지', 'Change Note']),
        })
      }
      if (targets.cues) {
        const label = pick(properties, ['큐 이름', '큐', 'Cue', 'Cue Label'])
        if (label) current.cues.push({
          type: pick(properties, ['큐 종류', '큐 구분', 'Cue Type']) || '무대', label,
          trigger: pick(properties, ['대사 큐', '트리거', 'Trigger', 'GO 사인']),
        })
      }
      if (targets.soundtracks) {
        const soundtrackTitle = pick(properties, ['사운드트랙', 'Soundtrack', '트랙명', 'Track'])
        if (soundtrackTitle) current.soundtracks.push({
          code: pick(properties, ['사운드트랙 코드', 'Soundtrack Code', 'Code']) || `SONG.${sceneNo}`,
          title: soundtrackTitle, notionPageId: page.id, notionLastEditedAt: page.last_edited_time,
        })
      }
      rows.set(sceneNo, current)
    }

    const normalizedRows = [...rows.values()].sort((a, b) => a.number - b.number)
    stage = 'StageFlow 데이터 연결'
    if (targets.soundtracks && normalizedRows.length) {
      const { data: scenes } = await supabase.from('scenes').select('id, scene_no').eq('production_id', productionId)
      const sceneIds = new Map((scenes || []).map((scene: any) => [Number(scene.scene_no), scene.id]))
      const records = normalizedRows
        .flatMap((row) => row.soundtracks.map((track: any, index: number) => ({
          production_id: productionId, scene_id: sceneIds.get(row.number), scene_detail_id: null,
          code: track.code, title: track.title, sort_order: index,
          notion_page_id: track.notionPageId, notion_last_edited_at: track.notionLastEditedAt,
        })))
        .filter((record) => record.scene_id)
      if (records.length) {
        const { error } = await supabase.from('soundtracks').upsert(records, { onConflict: 'production_id,code,title' })
        if (error) throw error
      }
    }

    const skipped = pages.filter((page) => !numeric(pick(page.properties || {}, sceneNumberKeys))).length
    const { error: syncError } = await supabase.from('productions')
      .update({ notion_data_source_id: sourceId, notion_last_synced_at: new Date().toISOString() })
      .eq('id', productionId)
    if (syncError) throw syncError
    return new Response(JSON.stringify({
      rows: normalizedRows, imported: normalizedRows.length, skipped,
      dataSourceId: sourceId, sourceName: resolved.name,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('sync-notion failed', { stage, message })
    return new Response(JSON.stringify({ ok: false, error: `${stage}: ${message}` }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
