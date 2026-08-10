import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'POST 요청만 지원합니다.' }, { status: 405, headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.')

    const authorization = request.headers.get('Authorization') || ''
    if (!authorization) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: corsHeaders })
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return Response.json({ error: '로그인 세션이 만료되었습니다.' }, { status: 401, headers: corsHeaders })

    const { text, productionTitle = '', productionId } = await request.json()
    if (!productionId || typeof productionId !== 'string') throw new Error('공연 ID가 필요합니다.')
    if (!text || typeof text !== 'string' || !text.trim()) throw new Error('분석할 대본 텍스트가 없습니다.')
    if (text.length > 120000) throw new Error('분석할 텍스트는 120,000자 이하만 지원합니다.')
    const { data: production, error: productionError } = await supabase.from('productions').select('id').eq('id', productionId).maybeSingle()
    if (productionError || !production) return Response.json({ error: '이 공연을 분석할 권한이 없습니다.' }, { status: 403, headers: corsHeaders })

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini',
        response_format: { type: 'json_object' },
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `너는 뮤지컬 무대감독용 대본 분석기다. 제공된 대본/공연표를 장면 단위로 분석하고 반드시 JSON만 반환한다.
반환 형식: {"scenes":[{"number":1,"title":"장면 또는 넘버명","main":"메인 배역을 / 로 구분","ensemble":"등장 앙상블과 역할","backstage":"백 앙상블/대기 인원","music":"넘버명 또는 음악 큐","movement":"동선/안무 정보","status":"진도, 난이도, 확인 필요 사항","props":[{"kind":"소품 또는 대도구","name":"이름","inBy":"In 담당자","outBy":"Out 담당자","note":"주의사항"}],"costumes":[{"character":"배역","name":"의상","changeNote":"체인지 정보"}],"cues":[{"type":"조명/음향/영상/마이크/무대","label":"큐 이름","trigger":"큐사인"}]}]}.
번호 결정 규칙: '1. 장면명'처럼 장면 번호가 있으면 그 번호를 사용한다. 장면 번호가 없고 'SONG.13 글로리아', 'SONG 13', 'SONG_13' 같은 표기가 있으면 SONG 뒤의 숫자 13을 number로 사용하고 그 구간을 하나의 장면/넘버로 정리한다. SONG.NN 사이의 대사, 등장인물, 소품, 의상, 큐는 문맥상 해당 SONG 장면에 묶는다. 숫자와 SONG.NN이 모두 없을 때만 문서 순서대로 임시 번호를 붙이고 status에 '장면 번호 확인 필요'를 추가한다.
대본에 명시되지 않은 사실은 만들지 말고 빈 문자열/빈 배열로 둔다. 불확실하면 status 또는 note에 '확인 필요'라고 쓴다. 같은 장면의 넘버와 드라마 구간은 문맥상 하나의 장면으로 묶되 명확히 분리된 번호는 유지한다.`,
          },
          { role: 'user', content: `공연명: ${String(productionTitle).slice(0, 200)}\n\n분석 자료:\n${text.trim()}` },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      if (response.status === 429) throw new Error('AI 사용 한도를 초과했어요 (insufficient_quota).')
      throw new Error(`OpenAI 요청 실패 (${response.status}): ${detail.slice(0, 1000)}`)
    }
    const result = await response.json()
    const content = result.choices?.[0]?.message?.content
    if (!content) throw new Error('AI 응답이 비어 있습니다.')
    let parsed
    try { parsed = JSON.parse(content) } catch { throw new Error('AI 응답이 올바른 JSON 형식이 아닙니다.') }
    if (!Array.isArray(parsed?.scenes)) throw new Error('AI 응답에 장면 목록이 없습니다.')
    return Response.json(parsed, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = /필요|없습니다|이하|형식|목록/i.test(message) ? 400 : 502
    return Response.json({ error: message }, { status, headers: corsHeaders })
  }
})
