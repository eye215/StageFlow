import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const notionHeaders = () => ({ Authorization: `Bearer ${Deno.env.get('NOTION_TOKEN')}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' })

const text = (property: any) => {
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
    const value = text(properties[name])
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
  const values = [left, right].flatMap((value) => String(value || '').split(/\s*[|/,]\s*/)).map((value) => value.trim()).filter(Boolean)
  return [...new Map(values.map((value) => [value.toLowerCase().replace(/\s/g, ''), value])).values()].join(' / ')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (!Deno.env.get('NOTION_TOKEN')) throw new Error('NOTION_TOKEN이 설정되지 않았습니다.')
    const auth = request.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { productionId, dataSourceId, targets: requestedTargets } = await request.json()
    const targets = { scenes: true, cast: true, props: true, costumes: true, cues: true, soundtracks: true, ...(requestedTargets || {}) }
    const { data: production, error: productionError } = await supabase.from('productions').select('id, notion_data_source_id').eq('id', productionId).single()
    if (productionError) throw productionError
    const sourceId = normalizeSourceId(dataSourceId || production.notion_data_source_id || '')
    if (!sourceId) throw new Error('Notion Data Source ID가 필요합니다.')

    const pages: any[] = []
    let cursor: string | undefined
    do {
      const response = await fetch(`https://api.notion.com/v1/data_sources/${sourceId}/query`, {
        method: 'POST', headers: notionHeaders(), body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      })
      if (!response.ok) throw new Error(`Notion 읽기 실패 (${response.status}): ${await response.text()}`)
      const payload = await response.json()
      pages.push(...(payload.results || []))
      cursor = payload.has_more ? payload.next_cursor : undefined
    } while (cursor)

    const rows = new Map<number, any>()
    for (const page of pages) {
      const p = page.properties || {}
      const sceneNo = numeric(pick(p, ['씬 번호', '장면 번호', 'Scene No', 'Scene', 'SCENE']))
      if (!sceneNo) continue
      const current = rows.get(sceneNo) || { number: sceneNo, title: `SCENE ${sceneNo}`, main: '', ensemble: '', backstage: '', music: '', movement: '', status: '', props: [], costumes: [], cues: [], details: [], soundtracks: [], characters: [] }
      const title = pick(p, ['장면명', '씬 제목', 'Scene Title', 'Title'])
      if (targets.scenes && title) current.title = title
      if (targets.cast) {
        current.main = mergeText(current.main, pick(p, ['메인 배역', '주요 배역', 'Main Cast', 'Main']))
        current.ensemble = mergeText(current.ensemble, pick(p, ['등장 앙상블', '앙상블', 'Ensemble']))
        current.backstage = mergeText(current.backstage, pick(p, ['백 앙상블', '대기 인원', 'Back Ensemble', 'Backstage']))
      }
      if (targets.scenes) {
        current.music = mergeText(current.music, pick(p, ['넘버', '음악', 'Music', 'Number']))
        current.movement = mergeText(current.movement, pick(p, ['동선', '안무', 'Movement']))
        current.status = mergeText(current.status, pick(p, ['현황', '상태', 'Status', '진도']))
      }
      if (targets.props) {
        const name = pick(p, ['소품명', '대도구명', '준비물', 'Prop', 'Item'])
        if (name) current.props.push({ kind: pick(p, ['구분', '종류', 'Kind']) || '소품', name, inBy: pick(p, ['In', 'IN', '반입']), outBy: pick(p, ['Out', 'OUT', '반출']), note: pick(p, ['비고', '메모', 'Note']) })
      }
      if (targets.costumes) {
        const name = pick(p, ['의상명', '의상', 'Costume', 'Look'])
        if (name) current.costumes.push({ character: pick(p, ['의상 배역', '배역', 'Role', 'Character']), name, changeNote: pick(p, ['체인지', '퀵체인지', 'Change Note']) })
      }
      if (targets.cues) {
        const label = pick(p, ['큐 이름', '큐', 'Cue', 'Cue Label'])
        if (label) current.cues.push({ type: pick(p, ['큐 종류', '큐 구분', 'Cue Type']) || '무대', label, trigger: pick(p, ['큐사인', '트리거', 'Trigger', 'GO 사인']) })
      }
      if (targets.soundtracks) {
        const soundtrackTitle = pick(p, ['사운드트랙', 'Soundtrack', '트랙명', 'Track'])
        if (soundtrackTitle) current.soundtracks.push({ code: pick(p, ['사운드트랙 코드', 'Soundtrack Code', 'Code']) || `SONG.${sceneNo}`, title: soundtrackTitle, notionPageId: page.id, notionLastEditedAt: page.last_edited_time })
      }
      rows.set(sceneNo, current)
    }

    const normalizedRows = [...rows.values()].sort((a, b) => a.number - b.number)
    if (targets.soundtracks && normalizedRows.length) {
      const { data: scenes } = await supabase.from('scenes').select('id, scene_no').eq('production_id', productionId)
      const sceneIds = new Map((scenes || []).map((scene: any) => [Number(scene.scene_no), scene.id]))
      const records = normalizedRows.flatMap((row) => row.soundtracks.map((track: any, index: number) => ({ production_id: productionId, scene_id: sceneIds.get(row.number), scene_detail_id: null, code: track.code, title: track.title, sort_order: index, notion_page_id: track.notionPageId, notion_last_edited_at: track.notionLastEditedAt }))).filter((record) => record.scene_id)
      if (records.length) {
        const { error } = await supabase.from('soundtracks').upsert(records, { onConflict: 'production_id,code,title' })
        if (error) throw error
      }
    }

    const skipped = pages.filter((page) => !numeric(pick(page.properties || {}, ['씬 번호', '장면 번호', 'Scene No', 'Scene', 'SCENE']))).length
    await supabase.from('productions').update({ notion_data_source_id: sourceId, notion_last_synced_at: new Date().toISOString() }).eq('id', productionId)
    return new Response(JSON.stringify({ rows: normalizedRows, imported: normalizedRows.length, skipped }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
