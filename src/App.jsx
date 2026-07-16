import { useEffect, useMemo, useState } from 'react'
import {
  Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Clock3, FileAudio, Home, ListChecks, ListMusic, MapPin,
  Music, Package, Pencil, Play, Plus, Save, Settings, Sparkles, Theater, Trash2, Upload, UserRound, Users, WandSparkles, X,
} from 'lucide-react'
import { supabase } from './supabase'
import './auth.css'
import './import.css'
import './music.css'
import './dashboard.css'
import './cast.css'
import './props.css'
import './cues.css'
import './ui-refinement.css'
import './ui-overrides.css'
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
  const [homePropStats, setHomePropStats] = useState({ total: 0, ready: 0 })
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
    if (selected && scenes.length) loadMusic(selected.id)
  }, [selected, scenes.length])

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
    if (!workspace) return
    const counts = await Promise.all(nextScenes.map(async (scene) => {
      const path = `${workspace.id}/${productionId}/music/${scene.scene_no}`
      const { data: files } = await supabase.storage.from('stageflow-files').list(path, { limit: 100 })
      return (files || []).filter((file) => file.id).length
    }))
    setHomeMusicCount(counts.reduce((sum, value) => sum + value, 0))
    const { data: propFile } = await supabase.storage.from('stageflow-files').download(`${workspace.id}/${productionId}/data/props.json`)
    if (propFile) {
      try {
        const payload = JSON.parse(await propFile.text())
        const items = Array.isArray(payload.items) ? payload.items : []
        setHomePropStats({ total: items.length, ready: items.filter((item) => item.ready).length })
      } catch {
        setHomePropStats({ total: 0, ready: 0 })
      }
    } else setHomePropStats({ total: 0, ready: 0 })
  }

  function openDefaultAt(tab = 'overview') {
    if (!defaultProduction) return
    setSelected(defaultProduction)
    window.setTimeout(() => setProductionTab(tab), 0)
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

  async function updateScene(id, values) {
    const payload = {
      title: values.title.trim(),
      act_no: Number(values.act_no) || 1,
      scene_no: Number(values.scene_no),
      summary: values.summary.trim(),
    }
    const { error } = await supabase.from('scenes').update(payload).eq('id', id)
    if (error) {
      setNotice(`장면 수정 실패: ${error.message}`)
      return false
    }
    await loadScenes(selected.id)
    setNotice(`${payload.scene_no}. ${payload.title} 장면을 수정했어요.`)
    return true
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
    const parsed = /(?:^|\n)\s*SONG[.\s_-]*\d+/i.test(importText)
      ? parseScriptByMarkers(importText)
      : parseProductionSheet(importText)
    setImportRows(parsed)
    setNotice(parsed.length ? `${parsed.length}개 장면과 연결 정보를 규칙으로 정리했어요.` : '장면 번호나 SONG.NN 표기를 찾지 못했어요.')
  }

  async function analyzeImportWithAI() {
    if (!importText.trim()) return
    setAiAnalyzing(true)
    setNotice('AI가 대본의 장면·인물·넘버·소품을 분석하고 있어요…')
    const { data, error } = await supabase.functions.invoke('analyze-production', {
      body: { text: importText.slice(0, 120000), productionTitle: selected.title },
    })
    if (error) {
      let detail = error.message
      try {
        const payload = await error.context?.json()
        detail = payload?.error || detail
      } catch {
        // The response body may already be consumed; use the SDK message instead.
      }
      if (/insufficient_quota|exceeded your current quota|429/i.test(detail)) {
        applyRuleFallback('AI 한도가 없어 규칙 분석으로 자동 전환했어요.')
      } else if (/OPENAI_API_KEY/i.test(detail)) {
        applyRuleFallback('AI 키를 사용할 수 없어 규칙 분석으로 자동 전환했어요.')
      } else {
        applyRuleFallback(`AI 연결이 불안정해 규칙 분석으로 자동 전환했어요. (${detail})`)
      }
    } else {
      const parsed = normalizeAiScenes(data?.scenes)
      setImportRows(parsed)
      setNotice(parsed.length ? `AI가 ${parsed.length}개 장면과 연결 정보를 정리했어요.` : 'AI 응답에서 장면을 찾지 못했어요.')
    }
    setAiAnalyzing(false)
  }

  function applyRuleFallback(message) {
    const parsed = /(?:^|\n)\s*SONG[.\s_-]*\d+/i.test(importText)
      ? parseScriptByMarkers(importText)
      : parseProductionSheet(importText)
    setImportRows(parsed)
    setNotice(parsed.length ? `${message} ${parsed.length}개 장면을 찾았습니다.` : `${message} 장면 번호나 SONG.NN 표기를 찾지 못했습니다.`)
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

  function assignMusicScene(index, sceneNo) {
    const scene = scenes.find((item) => Number(item.scene_no) === Number(sceneNo))
    setPendingMusic((items) => items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      sceneNo: scene ? scene.scene_no : null,
      sceneTitle: scene?.title || '선택 안 함',
    } : item))
  }

  async function uploadOrganizedMusic() {
    const matched = pendingMusic.filter((item) => item.sceneNo !== null)
    if (!matched.length) return setNotice('업로드할 파일의 넘버를 하나 이상 선택해주세요.')
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

  async function deleteMusicFile(file) {
    if (!window.confirm(`${cleanStoredFileName(file.name)} 음악파일을 삭제할까요?`)) return
    setUploadingMusic(true)
    const { error } = await supabase.storage.from('stageflow-files').remove([file.path])
    if (error) setNotice(`음악 삭제 실패: ${error.message}`)
    else {
      await loadMusic(selected.id)
      setNotice('음악파일을 삭제했어요.')
    }
    setUploadingMusic(false)
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

  async function updateCastMember(id, values) {
    const next = castMembers.map((member) => member.id === id ? { ...member, ...values, name: values.name.trim(), roleName: values.roleName.trim(), notes: values.notes.trim() } : member)
    const saved = await persistCastData(next)
    if (saved) setNotice(`${values.name.trim()} 배우 정보를 수정했어요.`)
    return saved
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

  async function importCastFromScenes() {
    const next = mergeCastFromScenes(castMembers, scenes)
    const added = next.length - castMembers.length
    if (!added) return setNotice('장면에서 새로 가져올 배우·배역이 없어요.')
    setBusy(true)
    if (await persistCastData(next)) setNotice(`${added}명의 배우·배역을 장면에서 가져왔어요.`)
    setBusy(false)
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

  async function updatePropItem(id, values) {
    const next = propItems.map((item) => item.id === id ? {
      ...item,
      ...values,
      name: values.name.trim(),
      sceneNo: Number(values.sceneNo) || null,
      inBy: values.inBy.trim(),
      outBy: values.outBy.trim(),
      note: values.note.trim(),
    } : item)
    const saved = await persistPropData(next)
    if (saved) setNotice(`${values.name.trim()} 정보를 수정했어요.`)
    return saved
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

  const selectedMusicCount = useMemo(() => Object.values(musicByScene).reduce((sum, files) => sum + files.length, 0), [musicByScene])
  const progress = useMemo(() => calculateReadiness(scenes, selectedMusicCount, {
    total: propItems.length,
    ready: propItems.filter((item) => item.ready).length,
  }), [scenes, selectedMusicCount, propItems])
  const defaultProduction = useMemo(() => productions.find((item) => item.id === defaultProductionId) || productions[0] || null, [productions, defaultProductionId])
  const homeProgress = useMemo(() => calculateReadiness(homeScenes, homeMusicCount, homePropStats), [homeScenes, homeMusicCount, homePropStats])
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
      updateScene={updateScene} deleteScene={deleteScene} showForm={showSceneForm} setShowForm={setShowSceneForm}
      notice={notice} busy={busy}
      importText={importText} setImportText={setImportText} importRows={importRows}
      analyzeImport={analyzeImport} saveImportedScenes={saveImportedScenes}
      analyzeImportWithAI={analyzeImportWithAI} aiAnalyzing={aiAnalyzing}
      readPdf={readPdf} importingPdf={importingPdf}
      pendingMusic={pendingMusic} musicByScene={musicByScene}
      organizeMusicFiles={organizeMusicFiles} assignMusicScene={assignMusicScene} uploadOrganizedMusic={uploadOrganizedMusic} deleteMusicFile={deleteMusicFile}
      uploadingMusic={uploadingMusic}
      castMembers={castMembers} castForm={castForm} setCastForm={setCastForm}
      showCastForm={showCastForm} setShowCastForm={setShowCastForm}
      addCastMember={addCastMember} updateCastMember={updateCastMember} removeCastMember={removeCastMember} toggleCastScene={toggleCastScene} importCastFromScenes={importCastFromScenes}
      propItems={propItems} propForm={propForm} setPropForm={setPropForm}
      showPropForm={showPropForm} setShowPropForm={setShowPropForm} propFilter={propFilter} setPropFilter={setPropFilter}
      addPropItem={addPropItem} updatePropItem={updatePropItem} removePropItem={removePropItem} togglePropReady={togglePropReady} importPropsFromScenes={importPropsFromScenes}
    />
  )

  return <HomeDashboardV2
    session={session} workspace={workspace} productions={productions}
    defaultProduction={defaultProduction} daysLeft={homeDaysLeft} progress={homeProgress}
    scenes={homeScenes} musicCount={homeMusicCount} propStats={homePropStats}
    openAt={openDefaultAt} profileOpen={profileOpen} setProfileOpen={setProfileOpen}
    chooseDefaultProduction={chooseDefaultProduction} notice={notice}
    showForm={showProductionForm} setShowForm={setShowProductionForm}
    productionForm={productionForm} setProductionForm={setProductionForm}
    createProduction={createProduction} busy={busy}
  />

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

function HomeDashboardV2({ session, workspace, productions, defaultProduction, daysLeft, progress, scenes, musicCount, propStats, openAt, profileOpen, setProfileOpen, chooseDefaultProduction, notice, showForm, setShowForm, productionForm, setProductionForm, createProduction, busy }) {
  const attentionScenes = scenes.filter((scene) => /확인\s*필요|미정|논의|재\s*정리|연습\s*필요/.test(scene.summary || '')).slice(0, 3)
  return <div className="app-shell home-v2">
    <header className="topbar home-topbar">
      <div className="brand-inline"><Theater size={22} /><div><strong>StageFlow</strong><span>{workspace.name}</span></div></div>
      <div className="topbar-actions"><button className="icon-button" onClick={() => setShowForm((value) => !value)} aria-label="새 공연 만들기"><Plus size={19} /></button><button className="avatar" onClick={() => setProfileOpen(true)} aria-label="프로필과 기본 공연 설정">{session.user.email?.[0]?.toUpperCase() || 'U'}</button></div>
    </header>
    <main className="content home-dashboard-v2">
      {showForm && <section className="inline-create"><div className="compact-heading"><div><span>NEW PRODUCTION</span><h2>새 공연</h2></div><button className="icon-button" onClick={() => setShowForm(false)}><X size={18} /></button></div><ProductionForm form={productionForm} setForm={setProductionForm} submit={createProduction} busy={busy} /></section>}
      {defaultProduction ? <>
        <button className="stage-summary" onClick={() => openAt('overview')}>
          <div className="stage-summary-top"><div><span className="stage-label">현재 공연</span><h1>{defaultProduction.title}</h1><p><MapPin size={14} /> {defaultProduction.venue || '공연 장소 미정'}</p></div>{daysLeft !== null && <strong className="d-day">{daysLeft >= 0 ? `D-${daysLeft}` : '종료'}</strong>}</div>
          <div className="stage-progress"><div><span>준비도</span><b>{progress}%</b></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div>
          <div className="stage-stats"><span><b>{scenes.length}</b> 장면</span><span><b>{musicCount}</b> 음악</span><span><b>{propStats.ready}/{propStats.total}</b> 소품 준비</span></div>
        </button>

        <section className="home-workbench"><div className="compact-heading"><div><span>WORKSPACE</span><h2>지금 할 일</h2></div></div><div className="workbench-grid"><button className="work-main" onClick={() => openAt('import')}><WandSparkles /><div><strong>대본 자동정리</strong><span>PDF에서 장면·인물·소품 추출</span></div><ChevronRight /></button><button onClick={() => openAt('scenes')}><Clapperboard /><div><strong>장면</strong><span>{scenes.length}개</span></div></button><button onClick={() => openAt('props')}><Package /><div><strong>소품</strong><span>{propStats.ready}/{propStats.total} 준비</span></div></button><button onClick={() => openAt('music')}><FileAudio /><div><strong>음악</strong><span>{musicCount}개 파일</span></div></button></div><button className="show-launch" onClick={() => openAt('show')}><Play fill="currentColor" /><div><strong>공연모드</strong><span>장면 순서대로 큐 진행</span></div><ChevronRight /></button></section>

        <section className="attention-block"><div className="compact-heading"><div><span>CHECK</span><h2>확인 필요한 장면</h2></div><button className="text-button" onClick={() => openAt('scenes')}>전체 장면</button></div>{attentionScenes.length ? <div className="attention-list">{attentionScenes.map((scene) => <button key={scene.id} onClick={() => openAt('scenes')}><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{extractAttention(scene.summary)}</small></div><ChevronRight /></button>)}</div> : <div className="clear-state"><CheckCircle2 /><div><strong>급한 확인 항목이 없어요</strong><span>장면 요약의 ‘미정·논의·확인 필요’를 자동으로 모읍니다.</span></div></div>}</section>
      </> : <section className="empty-home"><Theater /><h1>첫 공연을 만들어볼까요?</h1><p>공연을 만들면 대본, 장면, 배우, 소품과 음악을 한곳에서 정리할 수 있어요.</p><button className="primary" onClick={() => setShowForm(true)}><Plus /> 공연 만들기</button></section>}
      {notice && <p className="notice">{notice}</p>}
    </main>
    {profileOpen && <ProfileSheet session={session} workspace={workspace} productions={productions} defaultId={defaultProduction?.id} choose={chooseDefaultProduction} close={() => setProfileOpen(false)} logout={() => supabase.auth.signOut()} />}
  </div>
}

function extractAttention(summary = '') {
  return summary.split('\n').find((line) => /확인\s*필요|미정|논의|재\s*정리|연습\s*필요/.test(line))?.replace(/^현황:\s*/, '') || '확인 필요'
}

function calculateReadiness(scenes, musicCount, propStats) {
  if (!scenes.length) return 0
  const attentionCount = scenes.filter((scene) => /확인\s*필요|미정|논의|재\s*정리|연습\s*필요/.test(scene.summary || '')).length
  const sceneScore = 40
  const musicScore = Math.min(1, musicCount / scenes.length) * 25
  const propScore = propStats.total ? (propStats.ready / propStats.total) * 25 : 0
  const reviewScore = (1 - Math.min(1, attentionCount / scenes.length)) * 10
  return Math.round(sceneScore + musicScore + propScore + reviewScore)
}

function mergeCastFromScenes(existing, scenes) {
  const members = existing.map((member) => ({ ...member, sceneNumbers: [...(member.sceneNumbers || [])] }))
  const findMember = (name, roleName) => members.find((member) => normalizeMatch(member.name) === normalizeMatch(name) && normalizeMatch(member.roleName || member.name) === normalizeMatch(roleName || name))
  const add = (name, roleName, type, sceneNo) => {
    const cleanName = name.trim()
    const cleanRole = roleName.trim()
    if (!cleanName || /^(없음|미정|확인\s*필요|논의|\?)$/i.test(cleanName)) return
    const current = findMember(cleanName, cleanRole)
    if (current) {
      if (!current.sceneNumbers.includes(sceneNo)) current.sceneNumbers.push(sceneNo)
      current.sceneNumbers.sort((a, b) => a - b)
      return
    }
    members.push({ id: crypto.randomUUID(), name: cleanName, roleName: cleanRole, type, notes: '장면 자동정리에서 가져옴', sceneNumbers: [sceneNo] })
  }

  scenes.forEach((scene) => {
    String(scene.summary || '').split('\n').forEach((line) => {
      const match = line.match(/^(메인 배역|등장 앙상블):\s*(.+)$/)
      if (!match) return
      const type = match[1] === '메인 배역' ? '주연' : '앙상블'
      match[2].split(/\s*\/\s*/).forEach((entry) => {
        const value = entry.trim()
        if (!value || /없음|논의\s*후|등장\s*or|확인\s*필요/.test(value)) return
        const paired = value.match(/^(.+?)\s*\((.+)\)\s*$/)
        if (paired) {
          const roleName = paired[1].trim()
          paired[2].split(/\s*[,·&]\s*/).forEach((actor) => add(actor, roleName, type, Number(scene.scene_no)))
        } else {
          add(value, value, type, Number(scene.scene_no))
        }
      })
    })
  })
  return members
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
  const { workspace, production, scenes, tab, setTab, goBack, daysLeft, progress, showIndex, setShowIndex, form, setForm, createScene, updateScene, deleteScene, showForm, setShowForm, notice, busy, importText, setImportText, importRows, analyzeImport, analyzeImportWithAI, aiAnalyzing, saveImportedScenes, readPdf, importingPdf, pendingMusic, musicByScene, organizeMusicFiles, assignMusicScene, uploadOrganizedMusic, deleteMusicFile, uploadingMusic, castMembers, castForm, setCastForm, showCastForm, setShowCastForm, addCastMember, updateCastMember, removeCastMember, toggleCastScene, importCastFromScenes, propItems, propForm, setPropForm, showPropForm, setShowPropForm, propFilter, setPropFilter, addPropItem, updatePropItem, removePropItem, togglePropReady, importPropsFromScenes } = props
  const current = scenes[showIndex]
  const next = scenes[showIndex + 1]
  const readyProps = propItems.filter((item) => item.ready).length
  const [completedCues, setCompletedCues] = useState({})
  const currentCast = current ? castMembers.filter((member) => (member.sceneNumbers || []).includes(current.scene_no)) : []
  const currentProps = current ? propItems.filter((item) => Number(item.sceneNo) === Number(current.scene_no)) : []
  const currentMusic = current ? (musicByScene[current.scene_no] || []) : []
  const currentCues = current ? parseSceneCues(current.summary) : []
  const toggleCue = (sceneNo, cueIndex) => setCompletedCues((value) => ({ ...value, [`${sceneNo}-${cueIndex}`]: !value[`${sceneNo}-${cueIndex}`] }))
  return <div className="app-shell production-shell-v2">
    <header className="topbar"><button className="icon-button" onClick={goBack} aria-label="홈으로"><ChevronLeft /></button><div className="topbar-title"><strong>{production.title}</strong><span>{workspace.name}</span></div><span className="header-spacer" /></header>
    <main className="content production-content">
      <section className="production-bar"><div><span>{production.performance_start_date || '공연일 미정'}</span><h1>{production.title}</h1><p><MapPin size={14} /> {production.venue || '공연 장소 미정'}</p></div>{daysLeft !== null && <strong>{daysLeft >= 0 ? `D-${daysLeft}` : '종료'}</strong>}</section>
      <nav className="segmented segmented-scroll"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>개요</button><button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}>장면</button><button className={tab === 'cast' ? 'active' : ''} onClick={() => setTab('cast')}>배우</button><button className={tab === 'props' ? 'active' : ''} onClick={() => setTab('props')}>소품</button><button className={tab === 'cues' ? 'active' : ''} onClick={() => setTab('cues')}>큐</button><button className={tab === 'import' ? 'active' : ''} onClick={() => setTab('import')}>자동정리</button><button className={tab === 'music' ? 'active' : ''} onClick={() => setTab('music')}>음악</button><button className={tab === 'show' ? 'active' : ''} onClick={() => setTab('show')}>공연모드</button></nav>
      {tab === 'overview' && <section className="overview-v2"><article className="readiness-card"><div className="readiness-head"><div><span>전체 준비도</span><strong>{progress}%</strong></div><button onClick={() => setTab('show')}><Play fill="currentColor" /> 공연모드</button></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="readiness-list"><button onClick={() => setTab('scenes')}><Clapperboard /><span>장면</span><b>{scenes.length}</b><ChevronRight /></button><button onClick={() => setTab('cast')}><Users /><span>배우·배역</span><b>{castMembers.length}</b><ChevronRight /></button><button onClick={() => setTab('props')}><Package /><span>소품·대도구</span><b>{readyProps}/{propItems.length}</b><ChevronRight /></button></div></article><button className="continue-card" onClick={() => setTab('import')}><WandSparkles /><div><strong>자료에서 자동정리</strong><span>대본 PDF를 장면·인물·소품으로 분류</span></div><ChevronRight /></button></section>}
      {tab === 'scenes' && <><div className="section-heading"><div><p className="eyebrow">SCENES</p><h2>장면 관리</h2></div><button className="primary compact" onClick={() => setShowForm((v) => !v)}><Plus size={18} /> 장면</button></div>{showForm && <SceneForm form={form} setForm={setForm} submit={createScene} busy={busy} />}<section className="scene-list">{!scenes.length && <Empty icon={<Clapperboard />} title="아직 장면이 없어요" description="첫 장면을 등록해 공연 흐름을 만들어보세요." action={() => setShowForm(true)} />}{scenes.map((scene) => <SceneCard key={scene.id} scene={scene} update={updateScene} remove={() => deleteScene(scene.id)} />)}</section></>}
      {tab === 'cast' && <CastPanel members={castMembers} scenes={scenes} form={castForm} setForm={setCastForm} showForm={showCastForm} setShowForm={setShowCastForm} submit={addCastMember} update={updateCastMember} remove={removeCastMember} toggleScene={toggleCastScene} importFromScenes={importCastFromScenes} busy={busy} />}
      {tab === 'props' && <PropsPanel items={propItems} scenes={scenes} form={propForm} setForm={setPropForm} showForm={showPropForm} setShowForm={setShowPropForm} filter={propFilter} setFilter={setPropFilter} submit={addPropItem} update={updatePropItem} remove={removePropItem} toggleReady={togglePropReady} importFromScenes={importPropsFromScenes} busy={busy} />}
      {tab === 'cues' && <CuePanel scenes={scenes} completed={completedCues} toggle={toggleCue} updateScene={updateScene} />}
      {tab === 'import' && <ImportPanel text={importText} setText={setImportText} rows={importRows} analyze={analyzeImport} analyzeWithAI={analyzeImportWithAI} save={saveImportedScenes} readPdf={readPdf} loading={importingPdf || busy} aiAnalyzing={aiAnalyzing} />}
      {tab === 'music' && <MusicPanel scenes={scenes} pending={pendingMusic} musicByScene={musicByScene} organize={organizeMusicFiles} assign={assignMusicScene} upload={uploadOrganizedMusic} remove={deleteMusicFile} loading={uploadingMusic} />}
      {tab === 'show' && <section className="show-mode">{!current ? <Empty icon={<Play />} title="진행할 장면이 없어요" description="장면을 먼저 등록해주세요." action={() => setTab('scenes')} /> : <><div className="show-head"><span>NOW PLAYING</span><strong>{showIndex + 1} / {scenes.length}</strong></div><article className="current-scene"><p>ACT {current.act_no} · SCENE {current.scene_no}</p><h2>{current.title}</h2></article><div className="show-operations"><article><div className="show-section-title"><ListChecks /><strong>현재 큐</strong><span>{currentCues.filter((_, index) => completedCues[`${current.scene_no}-${index}`]).length}/{currentCues.length}</span></div>{currentCues.length ? <CueList cues={currentCues} sceneNo={current.scene_no} completed={completedCues} toggle={toggleCue} compact /> : <p>연결된 큐가 없어요.</p>}</article><article><div className="show-section-title"><Users /><strong>등장 배우</strong><span>{currentCast.length}</span></div>{currentCast.length ? <div className="show-cast-list">{currentCast.map((member) => <span key={member.id}><b>{member.roleName || member.name}</b>{member.name !== member.roleName && <small>{member.name}</small>}</span>)}</div> : <p>연결된 배우가 없어요.</p>}</article><article><div className="show-section-title"><Package /><strong>소품·대도구</strong><span>{currentProps.filter((item) => item.ready).length}/{currentProps.length}</span></div>{currentProps.length ? <div className="show-prop-list">{currentProps.map((item) => <button className={item.ready ? 'ready' : ''} key={item.id} onClick={() => togglePropReady(item.id)}><CheckCircle2 /><div><b>{item.name}</b><small>IN {item.inBy || '미정'} · OUT {item.outBy || '미정'}</small></div></button>)}</div> : <p>연결된 소품이 없어요.</p>}</article><article><div className="show-section-title"><FileAudio /><strong>음악</strong><span>{currentMusic.length}</span></div>{currentMusic.length ? <div className="show-music-list">{currentMusic.map((file) => <div key={file.path}><span>{cleanStoredFileName(file.name)}</span>{file.url && <audio controls preload="none" src={file.url} />}</div>)}</div> : <p>연결된 음악이 없어요.</p>}</article></div><article className="next-cue"><span>NEXT</span><strong>{next ? `${next.scene_no}. ${next.title}` : 'Curtain Call'}</strong></article><div className="show-actions"><button disabled={!showIndex} onClick={() => setShowIndex((i) => Math.max(0, i - 1))}>이전</button><button className="go-button" disabled={!next} onClick={() => setShowIndex((i) => Math.min(scenes.length - 1, i + 1))}>GO <Play fill="currentColor" /></button></div></>}</section>}
      {notice && <p className="notice">{notice}</p>}
    </main>
  </div>
}

function ProductionForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="공연명" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="공연 장소" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /><input type="date" value={form.performance_start_date} onChange={(e) => setForm({ ...form, performance_start_date: e.target.value })} /><button className="primary" disabled={busy}>공연 만들기</button></form> }
function SceneForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="장면 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><div className="two-col"><input type="number" min="1" value={form.act_no} onChange={(e) => setForm({ ...form, act_no: Number(e.target.value) })} /><input type="number" min="0" step="0.1" value={form.scene_no} onChange={(e) => setForm({ ...form, scene_no: Number(e.target.value) })} /></div><textarea placeholder="장면 설명" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /><button className="primary" disabled={busy}>장면 저장</button></form> }
function ProductionCard({ item, index, open, remove }) { return <article className="production-card" onClick={open}><div className={`poster poster-${index % 3}`}><Theater size={38} /></div><div className="production-info"><div className="card-top"><span className="status">준비 중</span><button className="icon-button danger" onClick={(e) => { e.stopPropagation(); remove() }} aria-label="공연 삭제"><Trash2 size={17} /></button></div><h3>{item.title}</h3><p>{item.venue || '장소 미정'}</p><small>{item.performance_start_date || '공연일 미정'}</small></div></article> }
function SceneCard({ scene, update, remove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: scene.title, act_no: scene.act_no, scene_no: scene.scene_no, summary: scene.summary || '' })
  async function save(event) {
    event.preventDefault()
    if (!draft.title.trim()) return
    if (await update(scene.id, draft)) setEditing(false)
  }
  if (editing) return <article className="scene-card scene-card-edit"><form onSubmit={save}><div className="two-col"><input type="number" min="1" value={draft.act_no} onChange={(event) => setDraft({ ...draft, act_no: event.target.value })} aria-label="ACT 번호" /><input type="number" min="0" step="0.1" value={draft.scene_no} onChange={(event) => setDraft({ ...draft, scene_no: event.target.value })} aria-label="장면 번호" /></div><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="장면 제목" /><textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="등장인물, 소품, 진행상황" /><div className="scene-edit-actions"><button type="button" onClick={() => setEditing(false)}>취소</button><button className="primary compact"><Save size={16} /> 저장</button></div></form></article>
  return <article className="scene-card"><div className="scene-index">{scene.scene_no}</div><div className="scene-copy"><span>ACT {scene.act_no}</span><h3>{scene.title}</h3><p>{scene.summary || '설명 없음'}</p></div><button className="icon-button" onClick={() => setEditing(true)} aria-label="장면 수정"><Pencil size={16} /></button><button className="icon-button danger" onClick={remove} aria-label="장면 삭제"><Trash2 size={18} /></button></article>
}
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
function MusicPanel({ scenes, pending, musicByScene, organize, assign, upload, remove, loading }) {
  const uploadedCount = Object.values(musicByScene).reduce((sum, files) => sum + files.length, 0)
  return <section className="import-panel music-panel">
    <div className="import-hero"><div className="import-icon music-icon"><Music /></div><div><p className="eyebrow">NUMBER MUSIC</p><h2>음악 자동정리</h2><p>음악파일을 한꺼번에 넣으면 파일명의 번호나 제목을 보고 해당 넘버에 자동 연결합니다. 한 넘버에 여러 파일도 저장할 수 있어요.</p></div></div>
    {!scenes.length ? <Empty icon={<ListMusic />} title="먼저 장면을 등록해주세요" description="자동정리에서 넘버표를 저장하면 음악을 자동 매칭할 수 있어요." /> : <>
      <label className="upload-zone music-upload"><FileAudio size={28} /><strong>음악파일 여러 개 선택</strong><span>MP3, M4A, WAV, AAC · 여러 파일 동시 선택 가능</span><input type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" multiple disabled={loading} onChange={(event) => organize(event.target.files || [])} /></label>
      {!!pending.length && <div className="music-match"><div className="import-result-head"><div><p className="eyebrow">AUTO MATCH</p><h3>{pending.length}개 파일 분류 결과</h3></div><button className="primary compact" disabled={loading || !pending.some((item) => item.sceneNo)} onClick={upload}><Upload size={17} /> {loading ? '업로드 중…' : '선택 파일 저장'}</button></div><div className="music-file-list">{pending.map((item, index) => <article className={item.sceneNo ? 'matched' : 'unmatched'} key={`${item.file.name}-${index}`}><FileAudio /><div><strong>{item.file.name}</strong><select aria-label={`${item.file.name} 넘버 선택`} value={item.sceneNo ?? ''} onChange={(event) => assign(index, event.target.value)}><option value="">넘버 선택 안 함</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select></div></article>)}</div></div>}
      <div className="import-result-head"><div><p className="eyebrow">LIBRARY</p><h3>넘버별 음악 {uploadedCount}개</h3></div></div>
      <div className="music-library">{scenes.map((scene) => { const files = musicByScene[scene.scene_no] || []; return <article className="music-scene" key={scene.id}><div className="music-scene-head"><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{files.length}개 파일</small></div></div>{files.length ? <div className="audio-list">{files.map((file) => <div className="audio-row" key={file.path}><div className="audio-file-head"><FileAudio size={17} /><span>{cleanStoredFileName(file.name)}</span><button className="icon-button danger" disabled={loading} onClick={() => remove(file)} aria-label={`${cleanStoredFileName(file.name)} 삭제`}><Trash2 size={15} /></button></div>{file.url && <audio controls preload="none" src={file.url} />}</div>)}</div> : <p>등록된 음악이 없어요.</p>}</article> })}</div>
    </>}
  </section>
}
function CastPanel({ members, scenes, form, setForm, showForm, setShowForm, submit, update, remove, toggleScene, importFromScenes, busy }) {
  return <section className="cast-panel">
    <div className="section-heading"><div><p className="eyebrow">CAST & CHARACTERS</p><h2>배우·배역</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={18} /> 배우</button></div>
    <section className="cast-summary"><article><strong>{members.length}</strong><span>전체 인원</span></article><article><strong>{members.filter((member) => member.type === '주연').length}</strong><span>주연</span></article><article><strong>{members.filter((member) => member.type === '앙상블').length}</strong><span>앙상블</span></article></section>
    <button className="import-props-button" disabled={!scenes.length || busy} onClick={importFromScenes}><WandSparkles size={18} /><div><strong>장면에서 배우·배역 가져오기</strong><span>대본 자동정리 결과의 메인 배역과 등장 앙상블을 장면별로 연결합니다.</span></div><ChevronRight /></button>
    {showForm && <form className="panel form-grid cast-form" onSubmit={submit}><div className="two-col"><input required placeholder="배우 이름" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input placeholder="배역 이름" value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} /></div><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>주연</option><option>앙상블</option><option>스태프</option></select><textarea placeholder="더블 캐스팅, 특이사항 등" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><button className="primary" disabled={busy}>배우 등록</button></form>}
    <div className="cast-list">{!members.length && <Empty icon={<Users />} title="등록된 배우가 없어요" description="배우와 배역을 등록하고 등장 장면을 연결해보세요." action={() => setShowForm(true)} />}{members.map((member) => <CastCard key={member.id} member={member} scenes={scenes} update={update} remove={remove} toggleScene={toggleScene} busy={busy} />)}</div>
  </section>
}

function CastCard({ member, scenes, update, remove, toggleScene, busy }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: member.name, roleName: member.roleName || '', type: member.type, notes: member.notes || '' })
  async function save(event) {
    event.preventDefault()
    if (!draft.name.trim()) return
    if (await update(member.id, draft)) setEditing(false)
  }
  return <article className="cast-card">{editing ? <form className="cast-edit-form" onSubmit={save}><div className="two-col"><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="배우 이름" /><input value={draft.roleName} onChange={(event) => setDraft({ ...draft, roleName: event.target.value })} placeholder="배역" /></div><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>주연</option><option>앙상블</option><option>스태프</option></select><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="특이사항" /><div className="cast-edit-actions"><button type="button" onClick={() => setEditing(false)}>취소</button><button className="primary compact" disabled={busy}><Save size={16} /> 저장</button></div></form> : <><div className="cast-card-head"><div className={`cast-avatar cast-${member.type}`}><UserRound /></div><div><span>{member.type}</span><h3>{member.name}</h3><p>{member.roleName || '배역 미정'}</p></div><button className="icon-button" onClick={() => setEditing(true)} aria-label="배우 정보 수정"><Pencil size={16} /></button><button className="icon-button danger" onClick={() => remove(member.id)} aria-label="배우 삭제"><Trash2 size={17} /></button></div>{member.notes && <p className="cast-notes">{member.notes}</p>}<div className="cast-scenes-head"><strong>등장 장면</strong><span>{(member.sceneNumbers || []).length}개 선택</span></div><div className="scene-chip-list">{scenes.map((scene) => { const active = (member.sceneNumbers || []).includes(scene.scene_no); return <button className={active ? 'active' : ''} key={scene.id} onClick={() => toggleScene(member.id, scene.scene_no)}><span>{scene.scene_no}</span>{scene.title}</button> })}{!scenes.length && <small>장면을 먼저 등록해주세요.</small>}</div></>}</article>
}
function PropsPanel({ items, scenes, form, setForm, showForm, setShowForm, filter, setFilter, submit, update, remove, toggleReady, importFromScenes, busy }) {
  const visible = items.filter((item) => filter === '전체' || item.kind === filter)
  const readyCount = items.filter((item) => item.ready).length
  const sceneTitle = (sceneNo) => scenes.find((scene) => Number(scene.scene_no) === Number(sceneNo))?.title || '장면 미지정'
  return <section className="props-panel">
    <div className="section-heading"><div><p className="eyebrow">PROPS & SET PIECES</p><h2>소품·대도구</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={18} /> 항목</button></div>
    <section className="prop-summary"><article><strong>{items.length}</strong><span>전체 항목</span></article><article><strong>{items.filter((item) => item.kind === '소품').length}</strong><span>소품</span></article><article><strong>{readyCount}/{items.length}</strong><span>준비 완료</span></article></section>
    <button className="import-props-button" disabled={!scenes.length || busy} onClick={importFromScenes}><WandSparkles size={18} /><div><strong>장면에서 자동으로 가져오기</strong><span>PDF 자동정리 결과의 소품·대도구와 In/Out 담당자를 불러옵니다.</span></div><ChevronRight /></button>
    {showForm && <form className="panel form-grid prop-form" onSubmit={submit}><div className="two-col"><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option>소품</option><option>대도구</option></select><select value={form.sceneNo} onChange={(event) => setForm({ ...form, sceneNo: event.target.value })}><option value="">장면 미지정</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select></div><input required placeholder="소품 또는 대도구 이름" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><div className="two-col"><input placeholder="In 담당자" value={form.inBy} onChange={(event) => setForm({ ...form, inBy: event.target.value })} /><input placeholder="Out 담당자" value={form.outBy} onChange={(event) => setForm({ ...form, outBy: event.target.value })} /></div><textarea placeholder="배치 위치, 이동 방법, 주의사항" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /><button className="primary" disabled={busy}>항목 저장</button></form>}
    <div className="prop-filters">{['전체', '소품', '대도구'].map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
    <div className="prop-list">{!visible.length && <Empty icon={<Package />} title="등록된 항목이 없어요" description="직접 추가하거나 장면 자동정리 결과에서 한 번에 가져오세요." action={() => setShowForm(true)} />}{visible.map((item) => <PropCard key={item.id} item={item} scenes={scenes} sceneTitle={sceneTitle} update={update} remove={remove} toggleReady={toggleReady} busy={busy} />)}</div>
  </section>
}

function PropCard({ item, scenes, sceneTitle, update, remove, toggleReady, busy }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: item.name, kind: item.kind, sceneNo: item.sceneNo || '', inBy: item.inBy || '', outBy: item.outBy || '', note: item.note || '' })
  async function save(event) {
    event.preventDefault()
    if (!draft.name.trim()) return
    if (await update(item.id, draft)) setEditing(false)
  }
  if (editing) return <article className="prop-card prop-card-edit"><form onSubmit={save}><div className="two-col"><select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })}><option>소품</option><option>대도구</option></select><select value={draft.sceneNo} onChange={(event) => setDraft({ ...draft, sceneNo: event.target.value })}><option value="">장면 미지정</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select></div><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="소품 또는 대도구 이름" /><div className="two-col"><input value={draft.inBy} onChange={(event) => setDraft({ ...draft, inBy: event.target.value })} placeholder="IN 담당자" /><input value={draft.outBy} onChange={(event) => setDraft({ ...draft, outBy: event.target.value })} placeholder="OUT 담당자" /></div><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="배치 위치, 이동 방법, 주의사항" /><div className="prop-edit-actions"><button type="button" onClick={() => setEditing(false)}>취소</button><button className="primary compact" disabled={busy}><Save size={16} /> 저장</button></div></form></article>
  return <article className={item.ready ? 'prop-card ready' : 'prop-card'}><button className="ready-toggle" onClick={() => toggleReady(item.id)} aria-label="준비 상태 변경"><CheckCircle2 /></button><div className="prop-copy"><div><span className={`prop-kind ${item.kind === '대도구' ? 'set-piece' : ''}`}>{item.kind}</span>{item.sceneNo && <span className="prop-scene">{item.sceneNo}. {sceneTitle(item.sceneNo)}</span>}</div><h3>{item.name}</h3><div className="prop-assignees"><span><b>IN</b>{item.inBy || '미정'}</span><span><b>OUT</b>{item.outBy || '미정'}</span></div>{item.note && <p>{item.note}</p>}</div><button className="icon-button" onClick={() => setEditing(true)} aria-label="소품 정보 수정"><Pencil size={16} /></button><button className="icon-button danger" onClick={() => remove(item.id)} aria-label="소품 삭제"><Trash2 size={17} /></button></article>
}

function CuePanel({ scenes, completed, toggle, updateScene }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ sceneNo: '', type: '조명', label: '', trigger: '' })
  const groups = scenes.map((scene) => ({ scene, cues: parseSceneCues(scene.summary) })).filter((group) => group.cues.length)
  const total = groups.reduce((sum, group) => sum + group.cues.length, 0)
  const done = groups.reduce((sum, group) => sum + group.cues.filter((_, index) => completed[`${group.scene.scene_no}-${index}`]).length, 0)
  async function addCue(event) {
    event.preventDefault()
    const scene = scenes.find((item) => Number(item.scene_no) === Number(form.sceneNo))
    if (!scene || !form.label.trim()) return
    const cueLine = `- [${form.type}] ${form.label.trim()}${form.trigger.trim() ? ` · 큐사인 ${form.trigger.trim()}` : ''}`
    const summary = [scene.summary?.trim(), cueLine].filter(Boolean).join('\n')
    if (await updateScene(scene.id, { ...scene, summary })) {
      setForm({ sceneNo: form.sceneNo, type: form.type, label: '', trigger: '' })
      setShowForm(false)
    }
  }
  async function removeCue(scene, cue) {
    if (!window.confirm(`${cue.type} 큐 '${cue.label}'을 삭제할까요?`)) return
    let removed = false
    const summary = String(scene.summary || '').split('\n').filter((line) => {
      if (!removed && line.trim() === cue.rawLine) {
        removed = true
        return false
      }
      return true
    }).join('\n').trim()
    if (removed) await updateScene(scene.id, { ...scene, summary })
  }
  return <section className="cue-panel"><div className="section-heading"><div><p className="eyebrow">CUE SHEET</p><h2>큐시트</h2></div><div className="cue-heading-actions"><span className="cue-progress">{done}/{total} 완료</span><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> 큐</button></div></div>{showForm && <form className="panel cue-form" onSubmit={addCue}><div className="two-col"><select required value={form.sceneNo} onChange={(event) => setForm({ ...form, sceneNo: event.target.value })}><option value="">장면 선택</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>조명</option><option>음향</option><option>영상</option><option>무대</option><option>마이크</option></select></div><input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="큐 내용 (예: 음악 시작)" /><input value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value })} placeholder="큐사인 (선택)" /><button className="primary">큐 추가</button></form>}{!groups.length ? <Empty icon={<ListChecks />} title="등록된 큐가 없어요" description="위의 큐 추가 버튼을 눌러 첫 큐를 등록하세요." action={() => setShowForm(true)} /> : <div className="cue-groups">{groups.map(({ scene, cues }) => <article key={scene.id}><div className="cue-scene-head"><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{cues.length}개 큐</small></div></div><CueList cues={cues} sceneNo={scene.scene_no} completed={completed} toggle={toggle} remove={(cue) => removeCue(scene, cue)} /></article>)}</div>}</section>
}

function CueList({ cues, sceneNo, completed, toggle, remove, compact = false }) {
  return <div className={compact ? 'cue-list compact-cues' : 'cue-list'}>{cues.map((cue, index) => { const key = `${sceneNo}-${index}`; return <div className={completed[key] ? 'cue-row done' : 'cue-row'} key={key}><button className="cue-toggle" onClick={() => toggle(sceneNo, index)}><CheckCircle2 /><span className={`cue-type cue-${cue.type}`}>{cue.type}</span><div><strong>{cue.label}</strong>{cue.trigger && <small>큐사인 · {cue.trigger}</small>}</div></button>{remove && <button className="cue-remove" onClick={() => remove(cue)} aria-label={`${cue.label} 큐 삭제`}><Trash2 size={15} /></button>}</div> })}</div>
}

function parseSceneCues(summary = '') {
  return String(summary).split('\n').map((line) => {
    const match = line.trim().match(/^-\s*\[([^\]]+)]\s*(.+)$/)
    if (!match || /^(소품|대도구)$/.test(match[1])) return null
    const parts = match[2].split(/\s*·\s*큐사인\s*/)
    return { type: match[1], label: parts[0].trim(), trigger: parts[1]?.trim() || '', rawLine: line.trim() }
  }).filter(Boolean)
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

function parseScriptByMarkers(source) {
  const normalized = source
    .replace(/\r/g, '')
    .replace(/([\t ])(?=SONG[.\s_-]*\d+)/gi, '\n')
  const lines = normalized.split('\n')
  const markers = []
  lines.forEach((line, index) => {
    const match = line.trim().match(/^SONG[.\s_-]*(\d{1,3})\s*[:：.\-_]?\s*(.*)$/i)
    if (match) markers.push({ index, number: Number(match[1]), title: match[2].trim() })
  })

  return markers.map((marker, markerIndex) => {
    const end = markers[markerIndex + 1]?.index ?? lines.length
    const segment = lines.slice(marker.index + 1, end).map((line) => line.trim()).filter(Boolean)
    const speakers = new Set()
    const props = []
    const cues = []
    const movement = []
    const checks = []

    segment.forEach((line) => {
      const speaker = line.match(/^([가-힣A-Za-z][가-힣A-Za-z0-9 _-]{0,18})\s*[:：]\s*\S/)
      if (speaker && !/^(소품|대도구|조명|음향|영상|큐|의상|동선|안무)$/i.test(speaker[1].trim())) speakers.add(speaker[1].trim())

      const propLine = line.match(/^(소품|대도구)\s*[:：]\s*(.+)$/i)
      if (propLine) {
        propLine[2].split(/\s*[\/|·]\s*|\s*,\s*/).filter(Boolean).forEach((name) => {
          if (!/^(없음|미정|-)$/.test(name)) props.push({ kind: propLine[1] === '대도구' ? '대도구' : '소품', name: name.trim(), inBy: '', outBy: '', note: '담당자 확인 필요' })
        })
      }

      const cueLine = line.match(/^(조명|음향|영상|마이크|무대|큐(?:사인)?)\s*[:：]\s*(.+)$/i)
      if (cueLine) cues.push({ type: cueLine[1].replace('큐사인', '무대'), label: cueLine[2].trim(), trigger: /큐사인/i.test(cueLine[1]) ? cueLine[2].trim() : '' })
      else if (/\b(GO|CUE)\b|큐사인|불이야/i.test(line)) cues.push({ type: '무대', label: line.slice(0, 100), trigger: line.match(/큐사인\s*[:：]?\s*(.+)/i)?.[1]?.trim() || '' })

      if (/동선|안무/.test(line)) movement.push(line)
      if (/확인\s*필요|미정|논의|재\s*정리|연습\s*필요/.test(line)) checks.push(line)
    })

    const uniqueProps = props.filter((item, index) => props.findIndex((value) => value.kind === item.kind && value.name === item.name) === index)
    return {
      number: marker.number,
      title: marker.title || `SONG ${marker.number}`,
      main: [...speakers].join(' / '),
      ensemble: '',
      backstage: '',
      music: marker.title || `SONG ${marker.number}`,
      movement: movement.slice(0, 4).join(' · '),
      status: ['규칙 기반 임시 정리', ...checks.slice(0, 3)].join(' · '),
      props: uniqueProps,
      costumes: [],
      cues,
    }
  }).sort((a, b) => a.number - b.number)
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
