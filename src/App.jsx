import { useEffect, useMemo, useState } from 'react'
import {
  Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Clock3, FileAudio, Home, ListMusic, MapPin,
  Music, Package, Play, Plus, Settings, Sparkles, Theater, Trash2, Upload, UserRound, Users, WandSparkles, X,
} from 'lucide-react'
import { supabase } from './supabase'
import './auth.css'
import './import.css'
import './music.css'
import './dashboard.css'
import './cast.css'
import './props.css'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const emptyProduction = { title: '', venue: '', performance_start_date: '' }
const emptyScene = { title: '', act_no: 1, scene_no: 1, summary: '' }

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [authMode, setAuthMode] = useState('signup')
  const [notice, setNotice] = useState('')
  const [workspace, setWorkspace] = useState(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [productions, setProductions] = useState([])
  const [productionForm, setProductionForm] = useState(emptyProduction)
  const [selected, setSelected] = useState(null)
  const [scenes, setScenes] = useState([])
  const [sceneForm, setSceneForm] = useState(emptyScene)
  const [productionTab, setProductionTab] = useState('overview')
  const [showIndex, setShowIndex] = useState(0)
  const [showProductionForm, setShowProductionForm] = useState(false)
  const [showSceneForm, setShowSceneForm] = useState(false)
  const [importText, setImportText] = useState('')
  const [importRows, setImportRows] = useState([])
  const [importingPdf, setImportingPdf] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [pendingMusic, setPendingMusic] = useState([])
  const [musicByScene, setMusicByScene] = useState({})
  const [uploadingMusic, setUploadingMusic] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [defaultProductionId, setDefaultProductionId] = useState(() => window.localStorage.getItem('stageflow:default-production') || '')
  const [homeScenes, setHomeScenes] = useState([])
  const [homeMusicCount, setHomeMusicCount] = useState(0)
  const [castMembers, setCastMembers] = useState([])
  const [castForm, setCastForm] = useState({ name: '', roleName: '', type: '주연', notes: '' })
  const [showCastForm, setShowCastForm] = useState(false)
  const [propItems, setPropItems] = useState([])
  const [propForm, setPropForm] = useState({ name: '', kind: '소품', sceneNo: '', inBy: '', outBy: '', note: '' })
  const [showPropForm, setShowPropForm] = useState(false)
  const [propFilter, setPropFilter] = useState('전체')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) loadWorkspace()
    else {
      setWorkspace(null)
      setProductions([])
      setSelected(null)
    }
  }, [session])

  useEffect(() => {
    if (!selected) return
    loadScenes(selected.id)
    loadCastData(selected.id)
    loadPropData(selected.id)
    setProductionTab('overview')
    setShowIndex(0)
  }, [selected])

  useEffect(() => {
    if (selected && productionTab === 'music') loadMusic(selected.id)
  }, [selected, productionTab, scenes.length])

  useEffect(() => {
    if (defaultProductionId && productions.some((item) => item.id === defaultProductionId)) loadHomeOverview(defaultProductionId)
  }, [defaultProductionId, productions])

  async function submitAuth(event) {
    event.preventDefault()
    if (authMode === 'signup' && password !== passwordConfirm) {
      setNotice('비밀번호가 서로 달라요.')
      return
    }
    if (password.length < 6) {
      setNotice('비밀번호는 6자 이상 입력해주세요.')
      return
    }
    setBusy(true)
    setNotice(authMode === 'signup' ? '계정을 만드는 중이에요…' : '로그인 중이에요…')
    const result = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (result.error) setNotice(`${authMode === 'signup' ? '회원가입' : '로그인'} 실패: ${result.error.message}`)
    else if (authMode === 'signup' && !result.data.session) setNotice('계정은 만들어졌지만 이메일 확인 설정이 켜져 있어요. Supabase에서 Confirm email을 꺼주세요.')
    else setNotice(authMode === 'signup' ? '가입 완료! StageFlow를 시작합니다.' : '로그인 완료!')
    setBusy(false)
  }

  async function loadWorkspace() {
    setLoading(true)
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', session.user.id)
      .limit(1)
    if (error) setNotice(`팀 정보를 불러오지 못했어요: ${error.message}`)
    const current = data?.[0]?.workspaces || null
    setWorkspace(current)
    if (current) await loadProductions(current.id)
    setLoading(false)
  }

  async function createWorkspace(event) {
    event.preventDefault()
    if (!workspaceName.trim()) return
    setBusy(true)
    const { error } = await supabase.rpc('create_workspace', { workspace_name: workspaceName.trim() })
    if (error) setNotice(`팀 생성 실패: ${error.message}`)
    else {
      setWorkspaceName('')
      await loadWorkspace()
    }
    setBusy(false)
  }

  async function loadProductions(workspaceId) {
    const { data, error } = await supabase
      .from('productions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (error) setNotice(`공연을 불러오지 못했어요: ${error.message}`)
    else {
      const next = data || []
      setProductions(next)
      const saved = window.localStorage.getItem('stageflow:default-production')
      if (!saved || !next.some((item) => item.id === saved)) {
        const firstId = next[0]?.id || ''
        setDefaultProductionId(firstId)
        if (firstId) window.localStorage.setItem('stageflow:default-production', firstId)
      }
    }
  }

  function chooseDefaultProduction(id) {
    setDefaultProductionId(id)
    window.localStorage.setItem('stageflow:default-production', id)
    setProfileOpen(false)
    setNotice('기본 공연을 변경했어요.')
  }

  async function loadHomeOverview(productionId) {
    const { data } = await supabase.from('scenes').select('*').eq('production_id', productionId).order('sort_order').order('scene_no')
    const nextScenes = data || []
    setHomeScenes(nextScenes)
    if (!workspace || !nextScenes.length) return setHomeMusicCount(0)
    const counts = await Promise.all(nextScenes.map(async (scene) => {
      const path = `${workspace.id}/${productionId}/music/${scene.scene_no}`
      const { data: files } = await supabase.storage.from('stageflow-files').list(path, { limit: 100 })
      return (files || []).filter((file) => file.id).length
    }))
    setHomeMusicCount(counts.reduce((sum, value) => sum + value, 0))
  }

  async function createProduction(event) {
    event.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('productions').insert({
      ...productionForm,
      workspace_id: workspace.id,
      created_by: session.user.id,
      performance_start_date: productionForm.performance_start_date || null,
    })
    if (error) setNotice(`공연 생성 실패: ${error.message}`)
    else {
      setProductionForm(emptyProduction)
      setShowProductionForm(false)
      await loadProductions(workspace.id)
    }
    setBusy(false)
  }

  async function deleteProduction(id) {
    if (!window.confirm('이 공연과 연결된 데이터를 삭제할까요?')) return
    const { error } = await supabase.from('productions').delete().eq('id', id)
    if (error) setNotice(`삭제 실패: ${error.message}`)
    else await loadProductions(workspace.id)
  }

  async function loadScenes(productionId) {
    const { data, error } = await supabase
      .from('scenes')
      .select('*')
      .eq('production_id', productionId)
      .order('sort_order')
      .order('scene_no')
    if (error) setNotice(`장면을 불러오지 못했어요: ${error.message}`)
    else setScenes(data || [])
  }

  async function createScene(event) {
    event.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('scenes').insert({
      ...sceneForm,
      production_id: selected.id,
      sort_order: scenes.length,
    })
    if (error) setNotice(`장면 생성 실패: ${error.message}`)
    else {
      setSceneForm({ ...emptyScene, scene_no: scenes.length + 2 })
      setShowSceneForm(false)
      await loadScenes(selected.id)
    }
    setBusy(false)
  }

  async function deleteScene(id) {
    if (!window.confirm('이 장면을 삭제할까요?')) return
    const { error } = await supabase.from('scenes').delete().eq('id', id)
    if (error) setNotice(`삭제 실패: ${error.message}`)
    else await loadScenes(selected.id)
  }

  async function readPdf(file) {
    if (!file) return
    setImportingPdf(true)
    setNotice('PDF에서 글자를 읽는 중이에요…')
    try {
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
      const pages = []
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        const page = await pdf.getPage(pageNo)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => item.str).join('\t'))
      }
      const text = pages.join('\n')
      setImportText(text)
      const parsed = parseProductionSheet(text)
      setImportRows(parsed)
      setNotice(parsed.length ? `${parsed.length}개 장면을 찾았어요.` : 'PDF에서 표를 찾지 못했어요. 텍스트를 붙여넣어 주세요.')
    } catch (error) {
      setNotice(`PDF 읽기 실패: ${error.message}`)
    }
    setImportingPdf(false)
  }

  function analyzeImport() {
    const parsed = parseProductionSheet(importText)
    setImportRows(parsed)
    setNotice(parsed.length ? `${parsed.length}개 장면과 연결 정보를 정리했어요.` : '번호로 시작하는 장면을 찾지 못했어요.')
  }

  async function analyzeImportWithAI() {
    if (!importText.trim()) return
    setAiAnalyzing(true)
    setNotice('AI가 대본의 장면·인물·넘버·소품을 분석하고 있어요…')
    const { data, error } = await supabase.functions.invoke('analyze-production', {
      body: { text: importText.slice(0, 120000), productionTitle: selected.title },
    })
    if (error) {
      setNotice(`AI 분석 실패: ${error.message}. Supabase의 analyze-production 함수가 배포됐는지 확인해 주세요.`)
    } else {
      const parsed = normalizeAiScenes(data?.scenes)
      setImportRows(parsed)
      setNotice(parsed.length ? `AI가 ${parsed.length}개 장면과 연결 정보를 정리했어요.` : 'AI 응답에서 장면을 찾지 못했어요.')
    }
    setAiAnalyzing(false)
  }

  async function saveImportedScenes() {
    if (!importRows.length) return
    setBusy(true)
    const existingNumbers = new Set(scenes.map((scene) => Number(scene.scene_no)))
    const rows = importRows.filter((row) => !existingNumbers.has(row.number)).map((row, index) => ({
      production_id: selected.id,
      act_no: row.number <= 14 ? 1 : 2,
      scene_no: row.number,
      sort_order: scenes.length + index,
      title: row.title,
      summary: formatSceneSummary(row),
    }))
    if (!rows.length) {
      setNotice('이미 같은 번호의 장면이 모두 등록되어 있어요.')
      setBusy(false)
      return
    }
    const { error } = await supabase.from('scenes').insert(rows)
    if (error) setNotice(`장면 저장 실패: ${error.message}`)
    else {
      await loadScenes(selected.id)
      setNotice(`${rows.length}개 장면을 공연에 저장했어요.`)
      setProductionTab('scenes')
    }
    setBusy(false)
  }

  function organizeMusicFiles(files) {
    const organized = [...files].map((file) => {
      const match = matchMusicToScene(file.name, scenes)
      return { file, sceneNo: match?.scene_no || null, sceneTitle: match?.title || '매칭 안 됨' }
    })
    setPendingMusic(organized)
    const matched = organized.filter((item) => item.sceneNo !== null).length
    setNotice(`${organized.length}개 파일 중 ${matched}개를 넘버에 자동 연결했어요.`)
  }

  async function uploadOrganizedMusic() {
    const matched = pendingMusic.filter((item) => item.sceneNo !== null)
    if (!matched.length) return setNotice('업로드할 수 있도록 파일명에 넘버 번호나 제목을 넣어주세요.')
    setUploadingMusic(true)
    let uploaded = 0
    for (const item of matched) {
      const safeName = safeStorageFileName(item.file.name)
      const path = `${workspace.id}/${selected.id}/music/${item.sceneNo}/${safeName}`
      const { error } = await supabase.storage.from('stageflow-files').upload(path, item.file, { contentType: item.file.type || 'audio/mpeg' })
      if (!error) uploaded += 1
      else setNotice(`음악 업로드 실패: ${error.message}`)
    }
    setUploadingMusic(false)
    setPendingMusic([])
    await loadMusic(selected.id)
    if (uploaded === matched.length) setNotice(`${uploaded}개 음악파일을 넘버별로 저장했어요.`)
  }

  async function loadMusic(productionId) {
    if (!scenes.length) return setMusicByScene({})
    const base = `${workspace.id}/${productionId}/music`
    const entries = await Promise.all(scenes.map(async (scene) => {
      const { data } = await supabase.storage.from('stageflow-files').list(`${base}/${scene.scene_no}`, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
      const files = (data || []).filter((item) => item.id).map((item) => ({ ...item, path: `${base}/${scene.scene_no}/${item.name}` }))
      const signed = await Promise.all(files.map(async (file) => {
        const { data: urlData } = await supabase.storage.from('stageflow-files').createSignedUrl(file.path, 3600)
        return { ...file, url: urlData?.signedUrl || '' }
      }))
      return [scene.scene_no, signed]
    }))
    setMusicByScene(Object.fromEntries(entries))
  }

  function castDataPath(productionId) {
    return `${workspace.id}/${productionId}/data/cast.json`
  }

  async function loadCastData(productionId) {
    const { data, error } = await supabase.storage.from('stageflow-files').download(castDataPath(productionId))
    if (error) return setCastMembers([])
    try {
      const parsed = JSON.parse(await data.text())
      setCastMembers(Array.isArray(parsed.members) ? parsed.members : [])
    } catch {
      setCastMembers([])
    }
  }

  async function persistCastData(members) {
    const body = new Blob([JSON.stringify({ members, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from('stageflow-files').upload(castDataPath(selected.id), body, { upsert: true, contentType: 'application/json' })
    if (error) {
      setNotice(`배우 정보 저장 실패: ${error.message}`)
      return false
    }
    setCastMembers(members)
    return true
  }

  async function addCastMember(event) {
    event.preventDefault()
    if (!castForm.name.trim()) return
    setBusy(true)
    const member = { id: crypto.randomUUID(), ...castForm, name: castForm.name.trim(), roleName: castForm.roleName.trim(), notes: castForm.notes.trim(), sceneNumbers: [] }
    if (await persistCastData([...castMembers, member])) {
      setCastForm({ name: '', roleName: '', type: '주연', notes: '' })
      setShowCastForm(false)
      setNotice(`${member.name} 배우를 등록했어요.`)
    }
    setBusy(false)
  }

  async function removeCastMember(id) {
    if (!window.confirm('이 배우 정보를 삭제할까요?')) return
    await persistCastData(castMembers.filter((member) => member.id !== id))
  }

  async function toggleCastScene(memberId, sceneNo) {
    const next = castMembers.map((member) => {
      if (member.id !== memberId) return member
      const numbers = member.sceneNumbers || []
      const hasScene = numbers.includes(sceneNo)
      return { ...member, sceneNumbers: hasScene ? numbers.filter((value) => value !== sceneNo) : [...numbers, sceneNo].sort((a, b) => a - b) }
    })
    await persistCastData(next)
  }

  function propDataPath(productionId) {
    return `${workspace.id}/${productionId}/data/props.json`
  }

  async function loadPropData(productionId) {
    const { data, error } = await supabase.storage.from('stageflow-files').download(propDataPath(productionId))
    if (error) return setPropItems([])
    try {
      const parsed = JSON.parse(await data.text())
      setPropItems(Array.isArray(parsed.items) ? parsed.items : [])
    } catch {
      setPropItems([])
    }
  }

  async function persistPropData(items) {
    const body = new Blob([JSON.stringify({ items, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from('stageflow-files').upload(propDataPath(selected.id), body, { upsert: true, contentType: 'application/json' })
    if (error) {
      setNotice(`소품 정보 저장 실패: ${error.message}`)
      return false
    }
    setPropItems(items)
    return true
  }

  async function addPropItem(event) {
    event.preventDefault()
    if (!propForm.name.trim()) return
    setBusy(true)
    const item = { id: crypto.randomUUID(), ...propForm, name: propForm.name.trim(), sceneNo: Number(propForm.sceneNo) || null, ready: false }
    if (await persistPropData([...propItems, item])) {
      setPropForm({ name: '', kind: '소품', sceneNo: '', inBy: '', outBy: '', note: '' })
      setShowPropForm(false)
      setNotice(`${item.name} 항목을 등록했어요.`)
    }
    setBusy(false)
  }

  async function removePropItem(id) {
    if (!window.confirm('이 소품 정보를 삭제할까요?')) return
    await persistPropData(propItems.filter((item) => item.id !== id))
  }

  async function togglePropReady(id) {
    await persistPropData(propItems.map((item) => item.id === id ? { ...item, ready: !item.ready } : item))
  }

  async function importPropsFromScenes() {
    const extracted = []
    const pattern = /^- \[(소품|대도구)\]\s*(.*?)\s*·\s*In\s*(.*?)\s*·\s*Out\s*(.*?)(?:\s*·\s*(.*))?$/
    scenes.forEach((scene) => {
      String(scene.summary || '').split('\n').forEach((line) => {
        const match = line.trim().match(pattern)
        if (!match || !match[2] || match[2] === '없음') return
        const item = { id: crypto.randomUUID(), kind: match[1], name: match[2].trim(), sceneNo: Number(scene.scene_no), inBy: match[3] === '-' ? '' : match[3].trim(), outBy: match[4] === '-' ? '' : match[4].trim(), note: (match[5] || '').trim(), ready: false }
        const duplicate = [...propItems, ...extracted].some((value) => value.kind === item.kind && value.name === item.name && Number(value.sceneNo) === item.sceneNo)
        if (!duplicate) extracted.push(item)
      })
    })
    if (!extracted.length) return setNotice('장면 요약에서 새 소품·대도구를 찾지 못했어요.')
    if (await persistPropData([...propItems, ...extracted])) setNotice(`${extracted.length}개 항목을 장면에서 가져왔어요.`)
  }

  const progress = useMemo(() => Math.min(100, scenes.length * 10), [scenes])
  const defaultProduction = useMemo(() => productions.find((item) => item.id === defaultProductionId) || productions[0] || null, [productions, defaultProductionId])
  const homeProgress = useMemo(() => Math.min(100, homeScenes.length * 10), [homeScenes])
  const homeDaysLeft = useMemo(() => {
    if (!defaultProduction?.performance_start_date) return null
    return Math.ceil((new Date(`${defaultProduction.performance_start_date}T00:00:00`) - new Date()) / 86400000)
  }, [defaultProduction])
  const daysLeft = useMemo(() => {
    if (!selected?.performance_start_date) return null
    return Math.ceil((new Date(`${selected.performance_start_date}T00:00:00`) - new Date()) / 86400000)
  }, [selected])

  if (loading) return <Loading />
  if (!session) return <Auth email={email} setEmail={setEmail} password={password} setPassword={setPassword} passwordConfirm={passwordConfirm} setPasswordConfirm={setPasswordConfirm} authMode={authMode} setAuthMode={setAuthMode} submit={submitAuth} notice={notice} busy={busy} />
  if (!workspace) return (
    <main className="auth-page"><section className="auth-card">
      <BrandMark icon={<Sparkles size={30} />} />
      <p className="eyebrow">FIRST STEP</p><h1>첫 팀을 만들어볼까요?</h1>
      <p className="muted">공연팀 이름을 입력하면 StageFlow 작업공간이 만들어집니다.</p>
      <form className="stack" onSubmit={createWorkspace}>
        <label htmlFor="workspace">팀 이름</label>
        <input id="workspace" required value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="예: 잭 더 리퍼 2026" />
        <button className="primary" disabled={busy}>팀 만들기</button>
      </form>
      {notice && <p className="notice">{notice}</p>}
    </section></main>
  )

  if (selected) return (
    <ProductionView
      workspace={workspace} production={selected} scenes={scenes} tab={productionTab}
      setTab={setProductionTab} goBack={() => setSelected(null)} daysLeft={daysLeft}
      progress={progress} showIndex={showIndex} setShowIndex={setShowIndex}
      form={sceneForm} setForm={setSceneForm} createScene={createScene}
      deleteScene={deleteScene} showForm={showSceneForm} setShowForm={setShowSceneForm}
      notice={notice} busy={busy}
      importText={importText} setImportText={setImportText} importRows={importRows}
      analyzeImport={analyzeImport} saveImportedScenes={saveImportedScenes}
      analyzeImportWithAI={analyzeImportWithAI} aiAnalyzing={aiAnalyzing}
      readPdf={readPdf} importingPdf={importingPdf}
      pendingMusic={pendingMusic} musicByScene={musicByScene}
      organizeMusicFiles={organizeMusicFiles} uploadOrganizedMusic={uploadOrganizedMusic}
      uploadingMusic={uploadingMusic}
      castMembers={castMembers} castForm={castForm} setCastForm={setCastForm}
      showCastForm={showCastForm} setShowCastForm={setShowCastForm}
      addCastMember={addCastMember} removeCastMember={removeCastMember} toggleCastScene={toggleCastScene}
      propItems={propItems} propForm={propForm} setPropForm={setPropForm}
      showPropForm={showPropForm} setShowPropForm={setShowPropForm} propFilter={propFilter} setPropFilter={setPropFilter}
      addPropItem={addPropItem} removePropItem={removePropItem} togglePropReady={togglePropReady} importPropsFromScenes={importPropsFromScenes}
    />
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-inline"><Theater size={24} /><strong>StageFlow</strong></div>
        <button className="avatar" onClick={() => setProfileOpen(true)} aria-label="프로필과 기본 공연 설정">
          {session.user.email?.[0]?.toUpperCase() || 'U'}
        </button>
      </header>
      <main className="content home-dashboard">
        <section className="welcome-block">
          <p className="eyebrow">TODAY'S STAGE</p><h1>오늘의 공연 준비</h1>
          <p>{workspace.name} · 해야 할 일을 빠르게 확인하세요.</p>
        </section>
        {defaultProduction ? <>
          <section className="focus-production" onClick={() => setSelected(defaultProduction)}>
            <div className="focus-top"><span className="status">기본 공연</span>{homeDaysLeft !== null && <strong>{homeDaysLeft >= 0 ? `D-${homeDaysLeft}` : '공연 종료'}</strong>}</div>
            <h2>{defaultProduction.title}</h2><p><MapPin size={15} /> {defaultProduction.venue || '공연 장소 미정'}</p>
            <div className="focus-progress"><div><span>전체 준비도</span><b>{homeProgress}%</b></div><div className="progress"><i style={{ width: `${homeProgress}%` }} /></div></div>
            <div className="focus-open">공연 준비 열기 <ChevronRight size={18} /></div>
          </section>
          <section className="home-metrics"><article><Clapperboard /><span>등록 장면</span><strong>{homeScenes.length}</strong></article><article><Music /><span>음악 파일</span><strong>{homeMusicCount}</strong></article><article><Clock3 /><span>정리 필요</span><strong>{Math.max(0, 10 - homeScenes.length)}</strong></article></section>
          <div className="section-heading home-section-heading"><div><p className="eyebrow">PREPARATION</p><h2>바로 준비하기</h2></div></div>
          <section className="prep-actions"><button onClick={() => setSelected(defaultProduction)}><WandSparkles /><div><strong>PDF·표 자동정리</strong><span>장면과 소품을 한 번에</span></div><ChevronRight /></button><button onClick={() => setSelected(defaultProduction)}><FileAudio /><div><strong>넘버 음악 정리</strong><span>여러 파일 자동 분류</span></div><ChevronRight /></button><button onClick={() => setSelected(defaultProduction)}><Play /><div><strong>공연모드 점검</strong><span>장면 순서대로 GO</span></div><ChevronRight /></button></section>
          <div className="section-heading home-section-heading"><div><p className="eyebrow">RECENT SCENES</p><h2>최근 장면</h2></div><button className="text-button" onClick={() => setSelected(defaultProduction)}>전체 보기</button></div>
          <section className="home-scene-list">{homeScenes.slice(0, 4).map((scene) => <button key={scene.id} onClick={() => setSelected(defaultProduction)}><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>ACT {scene.act_no}</small></div><ChevronRight /></button>)}{!homeScenes.length && <Empty icon={<Clapperboard />} title="등록된 장면이 없어요" description="자동정리에서 공연표를 넣어보세요." action={() => setSelected(defaultProduction)} />}</section>
        </> : <section className="today-card"><div><span>첫 번째 준비</span><h3>공연을 만들고 무대 준비를 시작하세요.</h3></div><Sparkles /></section>}
        <div className="section-heading"><div><p className="eyebrow">ALL PRODUCTIONS</p><h2>다른 공연</h2></div><button className="primary compact" onClick={() => setShowProductionForm((v) => !v)}><Plus size={18} /> 공연</button></div>
        {showProductionForm && <ProductionForm form={productionForm} setForm={setProductionForm} submit={createProduction} busy={busy} />}
        <section className="production-grid">
          {!productions.length && <Empty icon={<CalendarDays />} title="아직 공연이 없어요" description="첫 공연을 만들고 준비를 시작해보세요." />}
          {productions.filter((item) => item.id !== defaultProduction?.id).map((item, index) => <ProductionCard key={item.id} item={item} index={index} open={() => setSelected(item)} remove={() => deleteProduction(item.id)} />)}
        </section>
        {notice && <p className="notice">{notice}</p>}
      </main>
      <nav className="bottom-nav"><button className="active"><Home /><span>홈</span></button><button><Theater /><span>공연</span></button><button><Users /><span>팀</span></button><button><Settings /><span>설정</span></button></nav>
      {profileOpen && <ProfileSheet session={session} workspace={workspace} productions={productions} defaultId={defaultProduction?.id} choose={chooseDefaultProduction} close={() => setProfileOpen(false)} logout={() => supabase.auth.signOut()} />}
    </div>
  )
}

function Auth({ email, setEmail, password, setPassword, passwordConfirm, setPasswordConfirm, authMode, setAuthMode, submit, notice, busy }) {
  return <main className="auth-page"><section className="auth-card">
    <BrandMark icon={<Theater size={34} />} /><p className="eyebrow">MUSICAL PRODUCTION OS</p><h1>StageFlow</h1>
    <p className="muted">공연 준비부터 실전 큐 진행까지, 하나의 흐름으로.</p>
    <div className="auth-tabs"><button className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setNotice('') }}>회원가입</button><button className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setNotice('') }}>로그인</button></div>
    <form onSubmit={submit} className="stack">
      <label htmlFor="email">이메일</label><input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <label htmlFor="password">비밀번호</label><input id="password" type="password" required minLength="6" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상 입력" />
      {authMode === 'signup' && <><label htmlFor="password-confirm">비밀번호 확인</label><input id="password-confirm" type="password" required minLength="6" autoComplete="new-password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="비밀번호를 한 번 더 입력" /></>}
      <button className="primary" disabled={busy}>{busy ? '처리 중…' : authMode === 'signup' ? '30초 만에 가입하기' : '로그인'}</button>
    </form>
    <p className="auth-help">로그인 링크를 기다릴 필요 없이 이메일과 비밀번호로 바로 시작할 수 있어요.</p>
    {notice && <p className="notice">{notice}</p>}
  </section></main>
}

function ProfileSheet({ session, workspace, productions, defaultId, choose, close, logout }) {
  return <div className="sheet-backdrop" onClick={close}><section className="profile-sheet" onClick={(event) => event.stopPropagation()}>
    <div className="sheet-handle" /><div className="profile-head"><div className="profile-avatar"><UserRound /></div><div><strong>{session.user.email?.split('@')[0] || 'StageFlow 사용자'}</strong><span>{session.user.email}</span></div><button className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="profile-workspace"><Users size={18} /><div><span>현재 팀</span><strong>{workspace.name}</strong></div></div>
    <div className="sheet-title"><div><p className="eyebrow">DEFAULT PRODUCTION</p><h3>기본 공연 선택</h3></div><small>홈 화면에 표시할 공연</small></div>
    <div className="default-production-list">{productions.map((item) => <button className={item.id === defaultId ? 'active' : ''} key={item.id} onClick={() => choose(item.id)}><div className="production-radio">{item.id === defaultId && <i />}</div><div><strong>{item.title}</strong><span>{item.venue || '장소 미정'} · {item.performance_start_date || '공연일 미정'}</span></div>{item.id === defaultId && <CheckCircle2 />}</button>)}</div>
    <button className="logout-button" onClick={logout}>로그아웃</button>
  </section></div>
}

function ProductionView(props) {
  const { workspace, production, scenes, tab, setTab, goBack, daysLeft, progress, showIndex, setShowIndex, form, setForm, createScene, deleteScene, showForm, setShowForm, notice, busy, importText, setImportText, importRows, analyzeImport, analyzeImportWithAI, aiAnalyzing, saveImportedScenes, readPdf, importingPdf, pendingMusic, musicByScene, organizeMusicFiles, uploadOrganizedMusic, uploadingMusic, castMembers, castForm, setCastForm, showCastForm, setShowCastForm, addCastMember, removeCastMember, toggleCastScene, propItems, propForm, setPropForm, showPropForm, setShowPropForm, propFilter, setPropFilter, addPropItem, removePropItem, togglePropReady, importPropsFromScenes } = props
  const current = scenes[showIndex]
  const next = scenes[showIndex + 1]
  return <div className="app-shell">
    <header className="topbar"><button className="icon-button" onClick={goBack}><ChevronLeft /></button><div className="topbar-title"><span>{workspace.name}</span><strong>{production.title}</strong></div><span className="header-spacer" /></header>
    <main className="content production-content">
      <section className="production-cover"><div className="cover-glow" /><div className="cover-copy"><span className="status">준비 중</span><h1>{production.title}</h1><p><MapPin size={15} /> {production.venue || '공연 장소 미정'}</p><div className="cover-meta"><span>{production.performance_start_date || '공연일 미정'}</span>{daysLeft !== null && <strong>{daysLeft >= 0 ? `D-${daysLeft}` : '공연 종료'}</strong>}</div></div></section>
      <nav className="segmented segmented-scroll"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>개요</button><button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}>장면</button><button className={tab === 'cast' ? 'active' : ''} onClick={() => setTab('cast')}>배우</button><button className={tab === 'props' ? 'active' : ''} onClick={() => setTab('props')}>소품</button><button className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}>자동정리</button><button className={tab === 'music' ? 'active' : ''} onClick={() => setTab('music')}>음악</button><button className={tab === 'show' ? 'active' : ''} onClick={() => setTab('show')}>공연모드</button></nav>
      {tab === 'overview' && <><section className="metric-grid"><article className="metric-card"><span>준비도</span><strong>{progress}%</strong><div className="progress"><i style={{ width: `${progress}%` }} /></div></article><article className="metric-card"><span>등록 장면</span><strong>{scenes.length}</strong><small>Scenes</small></article></section><section className="quick-grid"><button onClick={() => setTab('scenes')}><Clapperboard /><span>장면 관리</span><small>{scenes.length}개</small></button><button onClick={() => setTab('cast')}><Users /><span>배우·배역</span><small>{castMembers.length}명</small></button><button onClick={() => setTab('show')}><Play /><span>공연 모드</span><small>GO 큐</small></button><button><Settings /><span>공연 설정</span><small>정보 관리</small></button></section></>}
      {tab === 'scenes' && <><div className="section-heading"><div><p className="eyebrow">SCENES</p><h2>장면 관리</h2></div><button className="primary compact" onClick={() => setShowForm((v) => !v)}><Plus size={18} /> 장면</button></div>{showForm && <SceneForm form={form} setForm={setForm} submit={createScene} busy={busy} />}<section className="scene-list">{!scenes.length && <Empty icon={<Clapperboard />} title="아직 장면이 없어요" description="첫 장면을 등록해 공연 흐름을 만들어보세요." action={() => setShowForm(true)} />}{scenes.map((scene) => <SceneCard key={scene.id} scene={scene} remove={() => deleteScene(scene.id)} />)}</section></>}
      {tab === 'cast' && <CastPanel members={castMembers} scenes={scenes} form={castForm} setForm={setCastForm} showForm={showCastForm} setShowForm={setShowCastForm} submit={addCastMember} remove={removeCastMember} toggleScene={toggleCastScene} busy={busy} />}
      {tab === 'props' && <PropsPanel items={propItems} scenes={scenes} form={propForm} setForm={setPropForm} showForm={showPropForm} setShowForm={setShowPropForm} filter={propFilter} setFilter={setPropFilter} submit={addPropItem} remove={removePropItem} toggleReady={togglePropReady} importFromScenes={importPropsFromScenes} busy={busy} />}
      {tab === 'import' && <ImportPanel text={importText} setText={setImportText} rows={importRows} analyze={analyzeImport} analyzeWithAI={analyzeImportWithAI} save={saveImportedScenes} readPdf={readPdf} loading={importingPdf || busy} aiAnalyzing={aiAnalyzing} />}
      {tab === 'music' && <MusicPanel scenes={scenes} pending={pendingMusic} musicByScene={musicByScene} organize={organizeMusicFiles} upload={uploadOrganizedMusic} loading={uploadingMusic} />}
      {tab === 'show' && <section className="show-mode">{!current ? <Empty icon={<Play />} title="진행할 장면이 없어요" description="장면을 먼저 등록해주세요." action={() => setTab('scenes')} /> : <><div className="show-head"><span>NOW PLAYING</span><strong>{showIndex + 1} / {scenes.length}</strong></div><article className="current-scene"><p>ACT {current.act_no} · SCENE {current.scene_no}</p><h2>{current.title}</h2><span>{current.summary || '등록된 장면 설명이 없습니다.'}</span></article><article className="next-cue"><span>NEXT</span><strong>{next ? next.title : 'Curtain Call'}</strong></article><div className="show-actions"><button disabled={!showIndex} onClick={() => setShowIndex((i) => Math.max(0, i - 1))}>이전</button><button className="go-button" disabled={!next} onClick={() => setShowIndex((i) => Math.min(scenes.length - 1, i + 1))}>GO <Play fill="currentColor" /></button></div></>}</section>}
      {notice && <p className="notice">{notice}</p>}
    </main>
  </div>
}

function ProductionForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="공연명" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="공연 장소" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /><input type="date" value={form.performance_start_date} onChange={(e) => setForm({ ...form, performance_start_date: e.target.value })} /><button className="primary" disabled={busy}>공연 만들기</button></form> }
function SceneForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="장면 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><div className="two-col"><input type="number" min="1" value={form.act_no} onChange={(e) => setForm({ ...form, act_no: Number(e.target.value) })} /><input type="number" min="0" step="0.1" value={form.scene_no} onChange={(e) => setForm({ ...form, scene_no: Number(e.target.value) })} /></div><textarea placeholder="장면 설명" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /><button className="primary" disabled={busy}>장면 저장</button></form> }
function ProductionCard({ item, index, open, remove }) { return <article className="production-card" onClick={open}><div className={`poster poster-${index % 3}`}><Theater size={38} /></div><div className="production-info"><div className="card-top"><span className="status">준비 중</span><button className="icon-button danger" onClick={(e) => { e.stopPropagation(); remove() }} aria-label="공연 삭제"><Trash2 size={17} /></button></div><h3>{item.title}</h3><p>{item.venue || '장소 미정'}</p><small>{item.performance_start_date || '공연일 미정'}</small></div></article> }
function SceneCard({ scene, remove }) { return <article className="scene-card"><div className="scene-index">{scene.scene_no}</div><div className="scene-copy"><span>ACT {scene.act_no}</span><h3>{scene.title}</h3><p>{scene.summary || '설명 없음'}</p></div><button className="icon-button danger" onClick={remove} aria-label="장면 삭제"><Trash2 size={18} /></button></article> }
function ImportPanel({ text, setText, rows, analyze, analyzeWithAI, save, readPdf, loading, aiAnalyzing }) {
  return <section className="import-panel">
    <div className="import-hero"><div className="import-icon"><WandSparkles /></div><div><p className="eyebrow">SMART ORGANIZER</p><h2>자료 자동정리</h2><p>대본 PDF나 공연표를 넣으면 장면·배역·앙상블·소품·In/Out을 넘버별로 묶어줍니다.</p></div></div>
    <label className="upload-zone"><Upload size={25} /><strong>{loading ? 'PDF 분석 중…' : '대본 PDF 불러오기'}</strong><span>텍스트가 포함된 PDF를 선택하세요</span><input type="file" accept="application/pdf,.pdf" disabled={loading} onChange={(event) => readPdf(event.target.files?.[0])} /></label>
    <div className="import-divider"><span>또는 표 내용 붙여넣기</span></div>
    <textarea className="import-textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder={'1. 가려진 진실\t앤더슨\t살인자 / 매춘부\t...\n2. 진정해 조심해\t앤더슨 / 먼로\t경찰 / 기자\t...'} />
    <div className="import-action-grid"><button className="secondary analyze-button" disabled={loading || aiAnalyzing || !text.trim()} onClick={analyze}><WandSparkles size={18} /> 빠른 표 정리</button><button className="primary analyze-button ai-analyze" disabled={loading || aiAnalyzing || !text.trim()} onClick={analyzeWithAI}><Sparkles size={18} /> {aiAnalyzing ? 'AI 분석 중…' : 'AI로 대본 분석'}</button></div>
    {!!rows.length && <><div className="import-result-head"><div><p className="eyebrow">PREVIEW</p><h3>{rows.length}개 장면을 찾았어요</h3></div><button className="primary compact" disabled={loading} onClick={save}><CheckCircle2 size={18} /> 공연에 저장</button></div><div className="import-results">{rows.map((row) => <article className="import-card" key={row.number}><div className="import-number">{row.number}</div><div className="import-card-copy"><h3>{row.title}</h3><div className="import-tags">{row.main && <span>주연 {row.main}</span>}{row.ensemble && <span>앙상블 {row.ensemble}</span>}{row.props.length > 0 && <span>소품 {row.props.length}개</span>}</div>{row.status && <p>{row.status}</p>}{row.props.length > 0 && <ul>{row.props.slice(0, 3).map((prop, index) => <li key={`${prop.name}-${index}`}><b>{prop.kind || '소품'}</b> {prop.name}{prop.inBy && ` · In ${prop.inBy}`}{prop.outBy && ` · Out ${prop.outBy}`}</li>)}</ul>}</div></article>)}</div></>}
  </section>
}
function MusicPanel({ scenes, pending, musicByScene, organize, upload, loading }) {
  const uploadedCount = Object.values(musicByScene).reduce((sum, files) => sum + files.length, 0)
  return <section className="import-panel music-panel">
    <div className="import-hero"><div className="import-icon music-icon"><Music /></div><div><p className="eyebrow">NUMBER MUSIC</p><h2>음악 자동정리</h2><p>음악파일을 한꺼번에 넣으면 파일명의 번호나 제목을 보고 해당 넘버에 자동 연결합니다. 한 넘버에 여러 파일도 저장할 수 있어요.</p></div></div>
    {!scenes.length ? <Empty icon={<ListMusic />} title="먼저 장면을 등록해주세요" description="자동정리에서 넘버표를 저장하면 음악을 자동 매칭할 수 있어요." /> : <>
      <label className="upload-zone music-upload"><FileAudio size={28} /><strong>음악파일 여러 개 선택</strong><span>MP3, M4A, WAV, AAC · 여러 파일 동시 선택 가능</span><input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" multiple disabled={loading} onChange={(event) => organize(event.target.files || [])} /></label>
      {!!pending.length && <div className="music-match"><div className="import-result-head"><div><p className="eyebrow">AUTO MATCH</p><h3>{pending.length}개 파일 분류 결과</h3></div><button className="primary compact" disabled={loading || !pending.some((item) => item.sceneNo)} onClick={upload}><Upload size={17} /> {loading ? '업로드 중…' : '모두 저장'}</button></div><div className="music-file-list">{pending.map((item, index) => <article className={item.sceneNo ? 'matched' : 'unmatched'} key={`${item.file.name}-${index}`}><FileAudio /><div><strong>{item.file.name}</strong><span>{item.sceneNo ? `${item.sceneNo}. ${item.sceneTitle}` : '번호나 제목을 찾지 못했어요'}</span></div></article>)}</div></div>}
      <div className="import-result-head"><div><p className="eyebrow">LIBRARY</p><h3>넘버별 음악 {uploadedCount}개</h3></div></div>
      <div className="music-library">{scenes.map((scene) => { const files = musicByScene[scene.scene_no] || []; return <article className="music-scene" key={scene.id}><div className="music-scene-head"><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{files.length}개 파일</small></div></div>{files.length ? <div className="audio-list">{files.map((file) => <div className="audio-row" key={file.path}><div><FileAudio size={17} /><span>{cleanStoredFileName(file.name)}</span></div>{file.url && <audio controls preload="none" src={file.url} />}</div>)}</div> : <p>등록된 음악이 없어요.</p>}</article> })}</div>
    </>}
  </section>
}
function CastPanel({ members, scenes, form, setForm, showForm, setShowForm, submit, remove, toggleScene, busy }) {
  return <section className="cast-panel">
    <div className="section-heading"><div><p className="eyebrow">CAST & CHARACTERS</p><h2>배우·배역</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={18} /> 배우</button></div>
    <section className="cast-summary"><article><strong>{members.length}</strong><span>전체 인원</span></article><article><strong>{members.filter((member) => member.type === '주연').length}</strong><span>주연</span></article><article><strong>{members.filter((member) => member.type === '앙상블').length}</strong><span>앙상블</span></article></section>
    {showForm && <form className="panel form-grid cast-form" onSubmit={submit}><div className="two-col"><input required placeholder="배우 이름" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input placeholder="배역 이름" value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} /></div><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>주연</option><option>앙상블</option><option>스태프</option></select><textarea placeholder="더블 캐스팅, 특이사항 등" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><button className="primary" disabled={busy}>배우 등록</button></form>}
    <div className="cast-list">{!members.length && <Empty icon={<Users />} title="등록된 배우가 없어요" description="배우와 배역을 등록하고 등장 장면을 연결해보세요." action={() => setShowForm(true)} />}{members.map((member) => <article className="cast-card" key={member.id}><div className="cast-card-head"><div className={`cast-avatar cast-${member.type}`}><UserRound /></div><div><span>{member.type}</span><h3>{member.name}</h3><p>{member.roleName || '배역 미정'}</p></div><button className="icon-button danger" onClick={() => remove(member.id)}><Trash2 size={17} /></button></div>{member.notes && <p className="cast-notes">{member.notes}</p>}<div className="cast-scenes-head"><strong>등장 장면</strong><span>{(member.sceneNumbers || []).length}개 선택</span></div><div className="scene-chip-list">{scenes.map((scene) => { const active = (member.sceneNumbers || []).includes(scene.scene_no); return <button className={active ? 'active' : ''} key={scene.id} onClick={() => toggleScene(member.id, scene.scene_no)}><span>{scene.scene_no}</span>{scene.title}</button> })}{!scenes.length && <small>장면을 먼저 등록해주세요.</small>}</div></article>)}</div>
  </section>
}
function PropsPanel({ items, scenes, form, setForm, showForm, setShowForm, filter, setFilter, submit, remove, toggleReady, importFromScenes, busy }) {
  const visible = items.filter((item) => filter === '전체' || item.kind === filter)
  const readyCount = items.filter((item) => item.ready).length
  const sceneTitle = (sceneNo) => scenes.find((scene) => Number(scene.scene_no) === Number(sceneNo))?.title || '장면 미지정'
  return <section className="props-panel">
    <div className="section-heading"><div><p className="eyebrow">PROPS & SET PIECES</p><h2>소품·대도구</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={18} /> 항목</button></div>
    <section className="prop-summary"><article><strong>{items.length}</strong><span>전체 항목</span></article><article><strong>{items.filter((item) => item.kind === '소품').length}</strong><span>소품</span></article><article><strong>{readyCount}/{items.length}</strong><span>준비 완료</span></article></section>
    <button className="import-props-button" disabled={!scenes.length || busy} onClick={importFromScenes}><WandSparkles size={18} /><div><strong>장면에서 자동으로 가져오기</strong><span>PDF 자동정리 결과의 소품·대도구와 In/Out 담당자를 불러옵니다.</span></div><ChevronRight /></button>
    {showForm && <form className="panel form-grid prop-form" onSubmit={submit}><div className="two-col"><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option>소품</option><option>대도구</option></select><select value={form.sceneNo} onChange={(event) => setForm({ ...form, sceneNo: event.target.value })}><option value="">장면 미지정</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select></div><input required placeholder="소품 또는 대도구 이름" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><div className="two-col"><input placeholder="In 담당자" value={form.inBy} onChange={(event) => setForm({ ...form, inBy: event.target.value })} /><input placeholder="Out 담당자" value={form.outBy} onChange={(event) => setForm({ ...form, outBy: event.target.value })} /></div><textarea placeholder="배치 위치, 이동 방법, 주의사항" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /><button className="primary" disabled={busy}>항목 저장</button></form>}
    <div className="prop-filters">{['전체', '소품', '대도구'].map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
    <div className="prop-list">{!visible.length && <Empty icon={<Package />} title="등록된 항목이 없어요" description="직접 추가하거나 장면 자동정리 결과에서 한 번에 가져오세요." action={() => setShowForm(true)} />}{visible.map((item) => <article className={item.ready ? 'prop-card ready' : 'prop-card'} key={item.id}><button className="ready-toggle" onClick={() => toggleReady(item.id)} aria-label="준비 상태 변경"><CheckCircle2 /></button><div className="prop-copy"><div><span className={`prop-kind ${item.kind === '대도구' ? 'set-piece' : ''}`}>{item.kind}</span>{item.sceneNo && <span className="prop-scene">{item.sceneNo}. {sceneTitle(item.sceneNo)}</span>}</div><h3>{item.name}</h3><div className="prop-assignees"><span><b>IN</b>{item.inBy || '미정'}</span><span><b>OUT</b>{item.outBy || '미정'}</span></div>{item.note && <p>{item.note}</p>}</div><button className="icon-button danger" onClick={() => remove(item.id)}><Trash2 size={17} /></button></article>)}</div>
  </section>
}
function Empty({ icon, title, description, action }) { return <div className="empty">{icon}<strong>{title}</strong><span>{description}</span>{action && <button className="primary compact" onClick={action}><Plus size={17} /> 추가하기</button>}</div> }
function BrandMark({ icon }) { return <div className="brand-mark">{icon}</div> }
function Loading() { return <div className="center"><div className="spinner" /><span>StageFlow 불러오는 중…</span></div> }

function splitCells(value) {
  return value.split(/\t+| {2,}/).map((cell) => cell.trim()).filter(Boolean)
}

function normalizeMatch(value) {
  return value.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^0-9a-z가-힣]/g, '')
}

function matchMusicToScene(filename, scenes) {
  const numberMatch = filename.match(/(?:^|[^0-9])(\d{1,3})(?:[^0-9]|$)/)
  if (numberMatch) {
    const byNumber = scenes.find((scene) => Number(scene.scene_no) === Number(numberMatch[1]))
    if (byNumber) return byNumber
  }
  const normalizedFile = normalizeMatch(filename)
  return scenes.find((scene) => {
    const title = normalizeMatch(scene.title)
    return title.length >= 2 && normalizedFile.includes(title)
  }) || null
}

function cleanStoredFileName(value) {
  const encoded = value.match(/^\d{13}--([A-Za-z0-9_-]+)(\.[A-Za-z0-9]+)?$/)
  if (encoded) {
    try {
      const base64 = encoded[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
      const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
      return `${new TextDecoder().decode(bytes)}${encoded[2] || ''}`
    } catch {
      return value
    }
  }
  return value.replace(/^\d{13}-/, '')
}

function safeStorageFileName(value) {
  const extensionMatch = value.match(/\.([A-Za-z0-9]{1,8})$/)
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : ''
  const title = extension ? value.slice(0, -extension.length) : value
  const bytes = new TextEncoder().encode(title)
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  return `${Date.now()}--${encoded || 'track'}${extension}`
}

function parseProductionSheet(source) {
  const rows = new Map()
  let current = null
  let propsMode = false
  const lines = source.replace(/\r/g, '').split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue
    if (/구분\s*소품명|소품명\s*In\s*Out/i.test(line.replace(/\t/g, ' '))) propsMode = true
    if (/투입\s*인원|진도\s*현황/.test(line.replace(/\t/g, ' '))) propsMode = false
    const match = line.trimStart().match(/^(?:(\d{1,3})\.|SONG[.\s_-]*(\d{1,3}))\s*([^\t]+?)(?:\t+| {2,}|$)(.*)$/i)
    if (match) {
      const number = Number(match[1] || match[2])
      const title = match[3].trim()
      current = rows.get(number) || { number, title, main: '', ensemble: '', backstage: '', music: '', movement: '', status: '', props: [] }
      current.title = title || current.title
      rows.set(number, current)
      const cells = splitCells(match[4])
      applyCells(current, cells, propsMode)
      continue
    }
    if (!current) continue
    const cells = splitCells(line.trim())
    if (propsMode && cells.length) addProp(current, cells)
  }
  return [...rows.values()].filter((row) => row.title).sort((a, b) => a.number - b.number)
}

function applyCells(row, cells, propsMode) {
  const typeIndex = cells.findIndex((cell) => /^(대도구|소품)$/.test(cell))
  if (propsMode || typeIndex >= 0) {
    const castEnd = typeIndex >= 0 ? typeIndex : Math.min(3, cells.length)
    if (!row.main && cells[0]) row.main = cells[0]
    if (!row.ensemble && cells[1]) row.ensemble = cells[1]
    if (!row.backstage && cells[2]) row.backstage = cells[2]
    if (typeIndex >= 0) addProp(row, cells.slice(typeIndex))
    else if (cells.length > castEnd) addProp(row, cells.slice(castEnd))
    return
  }
  row.main ||= cells[0] || ''
  row.ensemble ||= cells[1] || ''
  row.backstage ||= cells[2] || ''
  row.music ||= cells[3] || ''
  row.movement ||= cells[4] || ''
  row.status ||= cells.slice(5).join(' · ')
}

function addProp(row, cells) {
  const typeIndex = cells.findIndex((cell) => /^(대도구|소품)$/.test(cell))
  const start = typeIndex >= 0 ? typeIndex : 0
  const kind = typeIndex >= 0 ? cells[start] : '소품'
  const name = cells[start + 1] || ''
  if (!name || /^(없음|-)$/.test(name)) return
  const item = { kind, name, inBy: cells[start + 2] || '', outBy: cells[start + 3] || '', note: cells.slice(start + 4).join(' ') }
  const duplicate = row.props.some((prop) => prop.kind === item.kind && prop.name === item.name)
  if (!duplicate) row.props.push(item)
}

function normalizeAiScenes(value) {
  if (!Array.isArray(value)) return []
  return value.map((scene, index) => ({
    number: Number(scene.number) || index + 1,
    title: String(scene.title || `장면 ${index + 1}`).trim(),
    main: String(scene.main || '').trim(),
    ensemble: String(scene.ensemble || '').trim(),
    backstage: String(scene.backstage || '').trim(),
    music: String(scene.music || '').trim(),
    movement: String(scene.movement || '').trim(),
    status: String(scene.status || '').trim(),
    props: Array.isArray(scene.props) ? scene.props.filter((item) => item?.name).map((item) => ({ kind: item.kind === '대도구' ? '대도구' : '소품', name: String(item.name).trim(), inBy: String(item.inBy || '').trim(), outBy: String(item.outBy || '').trim(), note: String(item.note || '').trim() })) : [],
    costumes: Array.isArray(scene.costumes) ? scene.costumes : [],
    cues: Array.isArray(scene.cues) ? scene.cues : [],
  })).sort((a, b) => a.number - b.number)
}

function formatSceneSummary(row) {
  const lines = []
  if (row.main) lines.push(`메인 배역: ${row.main}`)
  if (row.ensemble) lines.push(`등장 앙상블: ${row.ensemble}`)
  if (row.backstage) lines.push(`백 앙상블: ${row.backstage}`)
  if (row.music || row.movement) lines.push(`진도: 음악 ${row.music || '-'} · 동선 ${row.movement || '-'}`)
  if (row.status) lines.push(`현황: ${row.status}`)
  if (row.props.length) {
    lines.push('소품/대도구:')
    row.props.forEach((prop) => lines.push(`- [${prop.kind}] ${prop.name} · In ${prop.inBy || '-'} · Out ${prop.outBy || '-'}${prop.note ? ` · ${prop.note}` : ''}`))
  }
  if (row.costumes?.length) {
    lines.push('의상/체인지:')
    row.costumes.forEach((item) => lines.push(`- ${item.character || '배역 미정'}: ${item.name || '의상 확인 필요'}${item.changeNote ? ` · ${item.changeNote}` : ''}`))
  }
  if (row.cues?.length) {
    lines.push('큐:')
    row.cues.forEach((item) => lines.push(`- [${item.type || '무대'}] ${item.label || '큐 확인 필요'}${item.trigger ? ` · 큐사인 ${item.trigger}` : ''}`))
  }
  return lines.join('\n')
}
