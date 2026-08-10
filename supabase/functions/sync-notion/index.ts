import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const notionHeaders = () => ({ Authorization: `Bearer ${Deno.env.get('NOTION_TOKEN')}`, 'Notion-Version': '2026-03-11', 'Content-Type': 'application/json' })
const plain = (property: any) => property?.title?.map((v: any) => v.plain_text).join('') || property?.rich_text?.map((v: any) => v.plain_text).join('') || ''
const number = (property: any) => property?.number ?? Number(plain(property))

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const token = Deno.env.get('NOTION_TOKEN')
    if (!token) throw new Error('NOTION_TOKEN이 설정되지 않았습니다.')
    const auth = request.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { productionId, dataSourceId } = await request.json()
    const { data: production, error: productionError } = await supabase.from('productions').select('id, notion_data_source_id').eq('id', productionId).single()
    if (productionError) throw productionError
    const sourceId = dataSourceId || production.notion_data_source_id
    if (!sourceId) throw new Error('Notion Data Source ID가 필요합니다.')
    const response = await fetch(`https://api.notion.com/v1/data_sources/${sourceId}/query`, { method: 'POST', headers: notionHeaders(), body: JSON.stringify({ page_size: 100 }) })
    if (!response.ok) throw new Error(`Notion 동기화 실패 (${response.status}): ${await response.text()}`)
    const payload = await response.json()
    const { data: scenes, error: scenesError } = await supabase.from('scenes').select('id, scene_no, summary').eq('production_id', productionId)
    if (scenesError) throw scenesError
    const sceneIds = new Map((scenes || []).map((scene: any) => [Number(scene.scene_no), scene.id]))
    const rows = (payload.results || []).map((page: any, index: number) => {
      const properties = page.properties || {}
      const sceneNo = number(properties['씬 번호'] || properties['Scene No'] || properties['Scene'])
      const code = plain(properties['사운드트랙 코드'] || properties['Soundtrack Code'] || properties['Code'])
      const title = plain(properties['사운드트랙'] || properties['Soundtrack'] || properties['이름'] || properties['Name'])
      return { production_id: productionId, scene_id: sceneIds.get(sceneNo), scene_detail_id: null, code: code || `SONG.${sceneNo}`, title, sort_order: index, notion_page_id: page.id, notion_last_edited_at: page.last_edited_time }
    }).filter((row: any) => row.scene_id && row.title)
    if (rows.length) {
      const { error } = await supabase.from('soundtracks').upsert(rows, { onConflict: 'production_id,code,title' })
      if (error) throw error
      for (const scene of scenes || []) {
        const tracks = rows.filter((row: any) => row.scene_id === scene.id)
        if (!tracks.length) continue
        const base = String(scene.summary || '').replace(/\n?Soundtrack:\n(?:- .*\n?)*/gi, '').trim()
        const soundtrackText = ['Soundtrack:', ...tracks.map((track: any) => `- ${track.code} ${track.title}`)].join('\n')
        await supabase.from('scenes').update({ summary: [base, soundtrackText].filter(Boolean).join('\n') }).eq('id', scene.id)
      }
    }
    await supabase.from('productions').update({ notion_data_source_id: sourceId, notion_last_synced_at: new Date().toISOString() }).eq('id', productionId)
    return new Response(JSON.stringify({ imported: rows.length, skipped: (payload.results || []).length - rows.length }), { headers: { ...headers, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } })
  }
})
