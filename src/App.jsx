import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Clock3, Download, FileAudio, FileSpreadsheet, FileText, Home, ListChecks, ListMusic, MapPin,
  MoreHorizontal, Music, Package, Pencil, Play, Plus, RotateCcw, Save, Search, Settings, Shirt, Sparkles, Square, Theater, Timer, Trash2, Upload, UserRound, Users, WandSparkles, X,
} from 'lucide-react'
import { supabase } from './supabase'
import './auth.css'
import './import.css'
import './music.css'
import './dashboard.css'
import './cast.css'
import './props.css'
import './cues.css'
import './rehearsal.css'
import './materials.css'
import './tasks.css'
import './scenes.css'
import './search.css'
import './navigation.css'
import './navigation-v2.css'
import './ui-cleanup.css'
import './schedule.css'
import './ui-refinement.css'
import './ui-overrides.css'
import './show-briefing.css'
import './costumes.css'
import './role-grouping.css'
import './cast-scenes-ux.css'
import './cast-call-sheet.css'
import './backup.css'
import './invite.css'
import './full-run.css'
import './run-history.css'
import './run-analysis.css'
import './import-options.css'
import './ux-pass.css'
import './navigation-hotfix.css'
import './preparation-health.css'
import './import-audit.css'
import './spreadsheet-upload.css'
import './import-selection.css'
import './import-edit.css'
import './import-undo.css'
import './import-plan.css'
import './import-flow.css'
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
  const [homeMusicLinkedScenes, setHomeMusicLinkedScenes] = useState(0)
  const [homePropStats, setHomePropStats] = useState({ total: 0, ready: 0 })
  const [homeTasks, setHomeTasks] = useState([])
  const [castMembers, setCastMembers] = useState([])
  const [castForm, setCastForm] = useState({ name: '', roleName: '', type: '주연', notes: '' })
  const [showCastForm, setShowCastForm] = useState(false)
  const [propItems, setPropItems] = useState([])
  const [propForm, setPropForm] = useState({ name: '', kind: '소품', sceneNo: '', inBy: '', outBy: '', note: '' })
  const [showPropForm, setShowPropForm] = useState(false)
  const [propFilter, setPropFilter] = useState('미준비')
  const [inviteProductionId, setInviteProductionId] = useState(() => new URLSearchParams(window.location.search).get('production') || '')
  const [inviteCastMembers, setInviteCastMembers] = useState([])
  const [showRoleClaim, setShowRoleClaim] = useState(() => Boolean(new URLSearchParams(window.location.search).get('invite')))

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
    if (!selected && defaultProductionId && productions.some((item) => item.id === defaultProductionId)) loadHomeOverview(defaultProductionId)
  }, [defaultProductionId, productions, selected])

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
    const inviteToken = new URLSearchParams(window.location.search).get('invite')
    if (inviteToken) {
      const { data: joinedProduction, error: joinError } = await supabase.rpc('join_workspace_by_invite', { invite_token: inviteToken })
      if (joinError) setNotice(`팀 초대 확인 실패: ${joinError.message}`)
      else if (joinedProduction) setInviteProductionId(String(joinedProduction))
    }
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

  useEffect(() => {
    if (workspace && inviteProductionId && showRoleClaim) loadInviteRoles(inviteProductionId)
  }, [workspace, inviteProductionId, showRoleClaim])
  async function loadInviteRoles(productionId) {
    const { data, error } = await supabase.storage.from('stageflow-files').download(castDataPath(productionId))
    if (error) return setInviteCastMembers([])
    try { const parsed = JSON.parse(await data.text()); setInviteCastMembers(Array.isArray(parsed.members) ? parsed.members : []) } catch { setInviteCastMembers([]) }
  }
  async function createTeamInvite() {
    const productionId = defaultProductionId || productions[0]?.id
    if (!productionId) return setNotice('먼저 공연을 하나 만들어주세요.')
    const { data, error } = await supabase.rpc('create_workspace_invite', { target_workspace_id: workspace.id, target_production_id: productionId })
    if (error) return setNotice(`초대 링크 생성 실패: ${error.message}`)
    const link = `${window.location.origin}${window.location.pathname}?invite=${encodeURIComponent(data)}&production=${encodeURIComponent(productionId)}`
    try { if (navigator.share) await navigator.share({ title: `${workspace.name} StageFlow 초대`, text: '회원가입 후 팀 참가와 배역 선택을 진행해주세요.', url: link }); else await navigator.clipboard.writeText(link); setNotice('팀 초대 링크를 공유했어요.') }
    catch (error) { if (error?.name !== 'AbortError') setNotice(`초대 링크 공유 실패: ${error.message}`) }
  }
  async function claimInviteRole(memberId) {
    const member = inviteCastMembers.find((item) => item.id === memberId)
    if (!member || (member.userId && member.userId !== session.user.id)) return
    setBusy(true)
    const next = inviteCastMembers.map((item) => item.id === memberId ? { ...item, userId: session.user.id, email: session.user.email, claimedAt: new Date().toISOString() } : item)
    const body = new Blob([JSON.stringify({ members: next, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from('stageflow-files').upload(castDataPath(inviteProductionId), body, { upsert: true, contentType: 'application/json' })
    setBusy(false)
    if (error) return setNotice(`배역 선택 실패: ${error.message}`)
    window.localStorage.setItem(`stageflow-briefing-${inviteProductionId}`, memberId); setShowRoleClaim(false); window.history.replaceState({}, '', window.location.pathname); setNotice(`${member.roleName || member.name} 배역으로 팀 참가가 완료됐어요.`)
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
    setHomeMusicLinkedScenes(counts.filter((value) => value > 0).length)
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
    const { data: taskFile } = await supabase.storage.from('stageflow-files').download(`${workspace.id}/${productionId}/data/tasks.json`)
    if (taskFile) {
      try {
        const payload = JSON.parse(await taskFile.text())
        setHomeTasks(Array.isArray(payload.tasks) ? payload.tasks : [])
      } catch { setHomeTasks([]) }
    } else setHomeTasks([])
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

  async function updateProduction(values) {
    const payload = {
      title: values.title.trim(),
      venue: values.venue.trim(),
      performance_start_date: values.performance_start_date || null,
    }
    const { data, error } = await supabase.from('productions').update(payload).eq('id', selected.id).select().single()
    if (error) {
      setNotice(`공연 정보 수정 실패: ${error.message}`)
      return false
    }
    setSelected(data)
    await loadProductions(workspace.id)
    setNotice('공연 기본정보를 수정했어요.')
    return true
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
      const sourcePath = `${workspace.id}/${selected.id}/imports/${safeStorageFileName(file.name)}`
      await supabase.storage.from('stageflow-files').upload(sourcePath, file, { upsert: false, contentType: 'application/pdf' })
      const parsed = parseProductionSheet(text)
      setImportRows(parsed)
      setNotice(parsed.length ? `${parsed.length}개 장면을 찾았어요.` : 'PDF에서 표를 찾지 못했어요. 텍스트를 붙여넣어 주세요.')
    } catch (error) {
      setNotice(`PDF 읽기 실패: ${error.message}`)
    }
    setImportingPdf(false)
  }

  async function readSpreadsheet(file) {
    if (!file) return
    setImportingPdf(true)
    setNotice('표 파일의 모든 시트와 행·열을 읽고 있어요…')
    try {
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
      const sheetTexts = workbook.SheetNames.map((sheetName) => {
        const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '', blankrows: false })
        return matrix.map((row) => row.map((cell) => String(cell ?? '').replace(/\r?\n/g, ' / ')).join('\t')).join('\n')
      }).filter(Boolean)
      const extracted = sheetTexts.join('\n\n')
      const parsed = parseProductionSheet(extracted)
      setImportText(extracted)
      setImportRows(parsed)
      const sourcePath = `${workspace.id}/${selected.id}/imports/${safeStorageFileName(file.name)}`
      await supabase.storage.from('stageflow-files').upload(sourcePath, file, { upsert: false, contentType: file.type || 'application/octet-stream' })
      setNotice(parsed.length ? `${workbook.SheetNames.length}개 시트 전체에서 ${parsed.length}개 장면을 인식했어요.` : '표 전체를 읽었지만 장면 번호와 제목을 찾지 못했어요.')
    } catch (error) {
      setNotice(`표 파일 읽기 실패: ${error.message}`)
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

  async function saveImportedScenes(options = {}) {
    if (!importRows.length) return
    const mode = options.mode || 'add'
    const targets = options.targets || { scenes: true, cast: true, props: true, costumes: true, cues: true }
    const selectedNumbers = Array.isArray(options.selectedNumbers) ? new Set(options.selectedNumbers.map(Number)) : null
    const selectedImportRows = selectedNumbers ? importRows.filter((row) => selectedNumbers.has(Number(row.number))) : importRows
    if (!selectedImportRows.length) return setNotice('적용할 장면을 하나 이상 선택해 주세요.')
    setBusy(true)
    const undoSnapshot = { format: 'stageflow-backup', version: 1, createdAt: new Date().toISOString(), production: selected, scenes, castMembers, props: propItems, reason: 'before-import' }
    const undoPath = `${workspace.id}/${selected.id}/data/import-undo.json`
    const { error: undoError } = await supabase.storage.from('stageflow-files').upload(undoPath, new Blob([JSON.stringify(undoSnapshot, null, 2)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (undoError) { setBusy(false); return setNotice(`자동 백업 실패: ${undoError.message}`) }
    const existingNumbers = new Set(scenes.map((scene) => Number(scene.scene_no)))
    const rows = selectedImportRows.filter((row) => !existingNumbers.has(row.number)).map((row, index) => ({
      production_id: selected.id,
      act_no: row.number <= 14 ? 1 : 2,
      scene_no: row.number,
      sort_order: scenes.length + index,
      title: targets.scenes ? row.title : `장면 ${row.number}`,
      summary: formatSceneSummarySelected(row, targets),
    }))
    let updated = 0
    if (mode === 'update') {
      for (const row of selectedImportRows.filter((item) => existingNumbers.has(item.number))) {
        const scene = scenes.find((item) => Number(item.scene_no) === Number(row.number))
        if (!scene) continue
        const incoming = formatSceneSummarySelected(row, targets)
        const summary = mergeSummaryLines(scene.summary, incoming)
        const { error } = await supabase.from('scenes').update({ title: targets.scenes ? row.title : scene.title, summary }).eq('id', scene.id)
        if (!error) updated += 1
      }
    }
    const { error } = rows.length ? await supabase.from('scenes').insert(rows) : { error: null }
    if (error) setNotice(`장면 저장 실패: ${error.message}`)
    else {
      const importedSceneRows = selectedImportRows.map((row) => ({ scene_no: row.number, title: row.title, summary: formatSceneSummarySelected(row, targets) }))
      const nextCast = targets.cast ? mergeCastFromScenes(castMembers, importedSceneRows) : castMembers
      const importedProps = selectedImportRows.flatMap((row) => (row.props || []).map((item) => ({
        id: crypto.randomUUID(),
        kind: item.kind === '대도구' ? '대도구' : '소품',
        name: String(item.name || '').trim(),
        sceneNo: Number(row.number),
        inBy: String(item.inBy || '').trim(),
        outBy: String(item.outBy || '').trim(),
        note: String(item.note || '').trim(),
        ready: false,
      }))).filter((item) => item.name && !propItems.some((value) => normalizeMatch(value.name) === normalizeMatch(item.name) && Number(value.sceneNo) === item.sceneNo))
      if (targets.cast) await persistCastData(nextCast)
      if (targets.props && importedProps.length) await persistPropData([...propItems, ...importedProps])
      const archiveName = `${Date.now()}--${btoa(unescape(encodeURIComponent('표-자동정리'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}.txt`
      await supabase.storage.from('stageflow-files').upload(`${workspace.id}/${selected.id}/imports/${archiveName}`, new Blob([importText], { type: 'text/plain;charset=utf-8' }), { upsert: false, contentType: 'text/plain;charset=utf-8' })
      await loadScenes(selected.id)
      setNotice(`새 장면 ${rows.length}개 · 업데이트 ${updated}개를 적용했어요. 기존 자료는 삭제하지 않았어요.`)
      setProductionTab('scenes')
    }
    setBusy(false)
  }

  async function undoLastImport() {
    if (!selected) return
    const path = `${workspace.id}/${selected.id}/data/import-undo.json`
    const { data, error } = await supabase.storage.from('stageflow-files').download(path)
    if (error || !data) return setNotice('되돌릴 자동정리 백업이 없어요.')
    try {
      const backup = JSON.parse(await data.text())
      const result = await restoreProductionBackup(backup)
      if (result?.ok) setNotice('마지막 자동정리 전 상태로 되돌렸어요.')
    } catch (parseError) {
      setNotice(`되돌리기 실패: ${parseError.message}`)
    }
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
    const uploadedItems = []
    for (const item of matched) {
      const safeName = safeStorageFileName(item.file.name)
      const path = `${workspace.id}/${selected.id}/music/${item.sceneNo}/${safeName}`
      const { error } = await supabase.storage.from('stageflow-files').upload(path, item.file, { contentType: item.file.type || 'audio/mpeg' })
      if (!error) {
        uploaded += 1
        uploadedItems.push(item)
      }
      else setNotice(`음악 업로드 실패: ${error.message}`)
    }
    setUploadingMusic(false)
    setPendingMusic([])
    if (uploadedItems.length) await linkUploadedMusicCues(uploadedItems)
    await loadMusic(selected.id)
    if (uploaded === matched.length) setNotice(`${uploaded}개 음악파일을 넘버별로 저장하고 음향 큐까지 연결했어요.`)
  }

  async function linkUploadedMusicCues(items) {
    const grouped = items.reduce((result, item) => {
      const key = Number(item.sceneNo)
      if (!result[key]) result[key] = []
      result[key].push(item.file.name)
      return result
    }, {})
    for (const scene of scenes) {
      const filenames = grouped[Number(scene.scene_no)] || []
      if (!filenames.length) continue
      const cues = filenames.map((filename) => ({
        type: '음향',
        label: `${stripFileExtension(filename)} 재생`,
        trigger: `${scene.title} 시작`,
      }))
      const summary = appendUniqueCueLines(scene.summary, cues)
      if (summary !== String(scene.summary || '')) {
        await supabase.from('scenes').update({ summary }).eq('id', scene.id)
      }
    }
    await loadScenes(selected.id)
  }

  async function autoLinkProductionCues() {
    if (!scenes.length) return setNotice('큐를 연결할 장면이 없어요.')
    setBusy(true)
    let added = 0
    for (const scene of scenes) {
      const generated = buildAutoCuesForScene(scene, musicByScene[scene.scene_no] || [], castMembers)
      const before = parseSceneCues(scene.summary).length
      const summary = appendUniqueCueLines(scene.summary, generated)
      const after = parseSceneCues(summary).length
      if (summary !== String(scene.summary || '')) {
        const { error } = await supabase.from('scenes').update({ summary }).eq('id', scene.id)
        if (!error) added += Math.max(0, after - before)
      }
    }
    await loadScenes(selected.id)
    setBusy(false)
    setNotice(added ? `${added}개 큐를 대본·음악·배역에서 찾아 장면에 자동 연결했어요.` : '새로 연결할 큐가 없어요. 기존 연결을 유지했어요.')
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

  async function restoreProductionBackup(backup) {
    if (!backup || backup.format !== 'stageflow-backup' || !Array.isArray(backup.scenes) || !Array.isArray(backup.castMembers) || !Array.isArray(backup.props)) return { ok: false, message: 'StageFlow 백업 파일 형식이 아니에요.' }
    if (!window.confirm(`현재 공연 데이터를 백업 내용으로 교체할까요?\n\n장면 ${backup.scenes.length}개 · 배우 ${backup.castMembers.length}명 · 소품 ${backup.props.length}개`)) return { ok: false, cancelled: true }
    setBusy(true)
    const sceneRows = backup.scenes.map((scene, index) => ({ production_id: selected.id, title: String(scene.title || `장면 ${index + 1}`), act_no: Number(scene.act_no) || 1, scene_no: Number(scene.scene_no) || index + 1, sort_order: index, summary: String(scene.summary || '') }))
    const { error: deleteError } = await supabase.from('scenes').delete().eq('production_id', selected.id)
    if (deleteError) { setBusy(false); return { ok: false, message: `기존 장면 정리 실패: ${deleteError.message}` } }
    if (sceneRows.length) {
      const { error: sceneError } = await supabase.from('scenes').insert(sceneRows)
      if (sceneError) { setBusy(false); return { ok: false, message: `장면 복원 실패: ${sceneError.message}` } }
    }
    const castSaved = await persistCastData(backup.castMembers)
    const propsSaved = await persistPropData(backup.props)
    await loadScenes(selected.id)
    setBusy(false)
    if (!castSaved || !propsSaved) return { ok: false, message: '일부 배우·소품 정보를 복원하지 못했어요.' }
    setNotice('공연 백업을 복원했어요.')
    return { ok: true }
  }

  const selectedMusicLinkedScenes = useMemo(() => scenes.filter((scene) => (musicByScene[scene.scene_no] || []).length > 0).length, [scenes, musicByScene])
  const progress = useMemo(() => calculateReadiness(scenes, selectedMusicLinkedScenes, {
    total: propItems.length,
    ready: propItems.filter((item) => item.ready).length,
  }), [scenes, selectedMusicLinkedScenes, propItems])
  const defaultProduction = useMemo(() => productions.find((item) => item.id === defaultProductionId) || productions[0] || null, [productions, defaultProductionId])
  const homeProgress = useMemo(() => calculateReadiness(homeScenes, homeMusicLinkedScenes, homePropStats), [homeScenes, homeMusicLinkedScenes, homePropStats])
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
      workspace={workspace} production={selected} updateProduction={updateProduction} scenes={scenes} tab={productionTab}
      setTab={setProductionTab} goBack={() => setSelected(null)} daysLeft={daysLeft}
      progress={progress} showIndex={showIndex} setShowIndex={setShowIndex}
      form={sceneForm} setForm={setSceneForm} createScene={createScene}
      updateScene={updateScene} deleteScene={deleteScene} showForm={showSceneForm} setShowForm={setShowSceneForm}
      notice={notice} busy={busy}
      importText={importText} setImportText={setImportText} importRows={importRows} setImportRows={setImportRows}
      analyzeImport={analyzeImport} saveImportedScenes={saveImportedScenes}
      analyzeImportWithAI={analyzeImportWithAI} aiAnalyzing={aiAnalyzing}
      readPdf={readPdf} readSpreadsheet={readSpreadsheet} undoLastImport={undoLastImport} importingPdf={importingPdf}
      pendingMusic={pendingMusic} musicByScene={musicByScene}
      organizeMusicFiles={organizeMusicFiles} assignMusicScene={assignMusicScene} uploadOrganizedMusic={uploadOrganizedMusic} deleteMusicFile={deleteMusicFile}
      uploadingMusic={uploadingMusic}
      castMembers={castMembers} castForm={castForm} setCastForm={setCastForm}
      showCastForm={showCastForm} setShowCastForm={setShowCastForm}
      addCastMember={addCastMember} updateCastMember={updateCastMember} removeCastMember={removeCastMember} toggleCastScene={toggleCastScene} importCastFromScenes={importCastFromScenes}
      propItems={propItems} propForm={propForm} setPropForm={setPropForm}
      showPropForm={showPropForm} setShowPropForm={setShowPropForm} propFilter={propFilter} setPropFilter={setPropFilter}
      addPropItem={addPropItem} updatePropItem={updatePropItem} removePropItem={removePropItem} togglePropReady={togglePropReady} importPropsFromScenes={importPropsFromScenes}
      restoreProductionBackup={restoreProductionBackup}
    />
  )

  return <HomeDashboardV2
    session={session} workspace={workspace} productions={productions}
    defaultProduction={defaultProduction} daysLeft={homeDaysLeft} progress={homeProgress}
    scenes={homeScenes} musicCount={homeMusicCount} propStats={homePropStats} tasks={homeTasks}
    openAt={openDefaultAt} profileOpen={profileOpen} setProfileOpen={setProfileOpen}
    chooseDefaultProduction={chooseDefaultProduction} notice={notice}
    showForm={showProductionForm} setShowForm={setShowProductionForm}
    productionForm={productionForm} setProductionForm={setProductionForm}
    createProduction={createProduction} busy={busy} createTeamInvite={createTeamInvite}
    showRoleClaim={showRoleClaim} inviteCastMembers={inviteCastMembers} claimInviteRole={claimInviteRole}
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

function HomeDashboardV2({ session, workspace, productions, defaultProduction, daysLeft, progress, scenes, musicCount, propStats, tasks, openAt, profileOpen, setProfileOpen, chooseDefaultProduction, notice, showForm, setShowForm, productionForm, setProductionForm, createProduction, busy, createTeamInvite, showRoleClaim, inviteCastMembers, claimInviteRole }) {
  const attentionScenes = scenes.filter((scene) => /확인\s*필요|미정|논의|재\s*정리|연습\s*필요/.test(scene.summary || '')).slice(0, 3)
  const pendingTasks = [...tasks].filter((task) => !task.done).sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))).slice(0, 3)
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

        <section className="home-task-block"><div className="compact-heading"><div><span>TO DO</span><h2>공연 준비 할 일</h2></div><button className="text-button" onClick={() => openAt('tasks')}>{tasks.filter((task) => !task.done).length}개 남음</button></div>{pendingTasks.length ? <div className="home-task-list">{pendingTasks.map((task) => <button key={task.id} onClick={() => openAt('tasks')}><CheckCircle2 /><div><strong>{task.title}</strong><span>{task.assignee ? `${task.assignee} · ` : ''}{task.dueDate ? formatTaskDue(task.dueDate) : '마감일 미정'}</span></div><ChevronRight /></button>)}</div> : <div className="clear-state"><CheckCircle2 /><div><strong>남은 준비 업무가 없어요</strong><span>할 일 탭에서 새로운 공연 준비 업무를 추가할 수 있어요.</span></div></div>}</section>

        <section className="attention-block"><div className="compact-heading"><div><span>CHECK</span><h2>확인 필요한 장면</h2></div><button className="text-button" onClick={() => openAt('scenes')}>전체 장면</button></div>{attentionScenes.length ? <div className="attention-list">{attentionScenes.map((scene) => <button key={scene.id} onClick={() => openAt('scenes')}><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{extractAttention(scene.summary)}</small></div><ChevronRight /></button>)}</div> : <div className="clear-state"><CheckCircle2 /><div><strong>급한 확인 항목이 없어요</strong><span>장면 요약의 ‘미정·논의·확인 필요’를 자동으로 모읍니다.</span></div></div>}</section>
      </> : <section className="empty-home"><Theater /><h1>첫 공연을 만들어볼까요?</h1><p>공연을 만들면 대본, 장면, 배우, 소품과 음악을 한곳에서 정리할 수 있어요.</p><button className="primary" onClick={() => setShowForm(true)}><Plus /> 공연 만들기</button></section>}
      {notice && <p className="notice">{notice}</p>}
    </main>
    {profileOpen && <ProfileSheet session={session} workspace={workspace} productions={productions} defaultId={defaultProduction?.id} choose={chooseDefaultProduction} invite={createTeamInvite} close={() => setProfileOpen(false)} logout={() => supabase.auth.signOut()} />}
    {showRoleClaim && <RoleClaimSheet members={inviteCastMembers} choose={claimInviteRole} busy={busy} />}
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

function ProfileSheet({ session, workspace, productions, defaultId, choose, invite, close, logout }) {
  return <div className="sheet-backdrop" onClick={close}><section className="profile-sheet" onClick={(event) => event.stopPropagation()}>
    <div className="sheet-handle" /><div className="profile-head"><div className="profile-avatar"><UserRound /></div><div><strong>{session.user.email?.split('@')[0] || 'StageFlow 사용자'}</strong><span>{session.user.email}</span></div><button className="icon-button" onClick={close}><X size={19} /></button></div>
    <div className="profile-workspace"><Users size={18} /><div><span>현재 팀</span><strong>{workspace.name}</strong></div></div>
    <div className="sheet-title"><div><p className="eyebrow">DEFAULT PRODUCTION</p><h3>기본 공연 선택</h3></div><small>홈 화면에 표시할 공연</small></div>
    <div className="default-production-list">{productions.map((item) => <button className={item.id === defaultId ? 'active' : ''} key={item.id} onClick={() => choose(item.id)}><div className="production-radio">{item.id === defaultId && <i />}</div><div><strong>{item.title}</strong><span>{item.venue || '장소 미정'} · {item.performance_start_date || '공연일 미정'}</span></div>{item.id === defaultId && <CheckCircle2 />}</button>)}</div>
    <button className="team-invite-button" onClick={invite}><Upload /><span><b>팀원 초대 링크</b><small>회원가입 후 팀 참가 · 배역 선택</small></span><ChevronRight /></button>
    <button className="logout-button" onClick={logout}>로그아웃</button>
  </section></div>
}

function RoleClaimSheet({ members, choose, busy }) {
  const [query, setQuery] = useState('')
  const available = members.filter((member) => !member.userId && (!normalizeMatch(query) || normalizeMatch(`${member.name} ${member.roleName || ''}`).includes(normalizeMatch(query))))
  return <div className="sheet-backdrop role-claim-backdrop"><section className="profile-sheet role-claim-sheet"><div className="sheet-handle" /><p className="eyebrow">JOIN THE CAST</p><h2>내 배역을 선택하세요</h2><p className="muted">선택하면 이 팀에 참가하고 개인 공연 브리핑이 자동 설정돼요.</p><label className="role-claim-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="배우 이름·배역 검색" /></label><div className="role-claim-list">{available.map((member) => <button key={member.id} disabled={busy} onClick={() => choose(member.id)}><UserRound /><span><b>{member.roleName || '배역 미정'}</b><small>{member.name} · {member.type}</small></span><ChevronRight /></button>)}</div>{!members.length && <p className="notice">등록된 배역이 없어요. 팀 관리자에게 배우 탭에서 배역을 먼저 등록해달라고 알려주세요.</p>}{members.length > 0 && !available.length && <p className="notice">선택 가능한 배역이 없어요.</p>}</section></div>
}

function ProductionView(props) {
  const { workspace, production, updateProduction, scenes, tab, setTab, goBack, daysLeft, progress, showIndex, setShowIndex, form, setForm, createScene, updateScene, deleteScene, showForm, setShowForm, notice, busy, importText, setImportText, importRows, setImportRows, analyzeImport, analyzeImportWithAI, aiAnalyzing, saveImportedScenes, readPdf, readSpreadsheet, undoLastImport, importingPdf, pendingMusic, musicByScene, organizeMusicFiles, assignMusicScene, uploadOrganizedMusic, deleteMusicFile, uploadingMusic, castMembers, castForm, setCastForm, showCastForm, setShowCastForm, addCastMember, updateCastMember, removeCastMember, toggleCastScene, importCastFromScenes, propItems, propForm, setPropForm, showPropForm, setShowPropForm, propFilter, setPropFilter, addPropItem, updatePropItem, removePropItem, togglePropReady, importPropsFromScenes, restoreProductionBackup } = props
  const current = scenes[showIndex]
  const next = scenes[showIndex + 1]
  const readyProps = propItems.filter((item) => item.ready).length
  const [completedCues, setCompletedCues] = useState({})
  const [editingProduction, setEditingProduction] = useState(false)
  const [productionDraft, setProductionDraft] = useState({ title: production.title, venue: production.venue || '', performance_start_date: production.performance_start_date || '' })
  const [sceneQuery, setSceneQuery] = useState('')
  const [actFilter, setActFilter] = useState('전체')
  const [moreOpen, setMoreOpen] = useState(false)
  const [briefingMemberId, setBriefingMemberId] = useState(() => window.localStorage.getItem(`stageflow-briefing-${production.id}`) || '')
  const [personalReady, setPersonalReady] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem(`stageflow-personal-ready-${production.id}`) || '{}') }
    catch { return {} }
  })
  const [readinessSyncedAt, setReadinessSyncedAt] = useState(null)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [showCursorLoaded, setShowCursorLoaded] = useState(false)
  const [showCursorSyncedAt, setShowCursorSyncedAt] = useState(null)
  const [showController, setShowController] = useState(() => window.localStorage.getItem(`stageflow-show-controller-${production.id}`) === 'true')
  const [showHold, setShowHold] = useState(false)
  const [showHoldMessage, setShowHoldMessage] = useState('')
  const [showEvents, setShowEvents] = useState([])
  const [runType, setRunType] = useState('rehearsal')
  const [runSession, setRunSession] = useState(null)
  const [runElapsed, setRunElapsed] = useState(0)
  const [runHistory, setRunHistory] = useState([])
  const previousShowState = useRef(null)
  const readinessPath = `${workspace.id}/${production.id}/data/show-readiness.json`
  const showCursorPath = `${workspace.id}/${production.id}/data/show-cursor.json`
  const showLogPath = `${workspace.id}/${production.id}/data/show-log.json`
  const runLogPath = `${workspace.id}/${production.id}/data/full-runs.json`
  const briefingMember = castMembers.find((member) => member.id === briefingMemberId)
  function toggleShowController() {
    setShowController((value) => {
      const nextValue = !value
      window.localStorage.setItem(`stageflow-show-controller-${production.id}`, String(nextValue))
      return nextValue
    })
  }
  function toggleShowHold() {
    if (!showController) return
    if (showHold) {
      setShowHold(false)
      setShowHoldMessage('')
      return
    }
    const reason = window.prompt('HOLD 사유를 입력해주세요.\n예: 음향 확인, 배우 대기, 무대 점검', '')
    if (reason === null) return
    setShowHoldMessage(reason.trim() || '상황 확인 중')
    setShowHold(true)
  }
  useEffect(() => {
    let active = true
    async function syncReadiness() {
      const { data } = await supabase.storage.from('stageflow-files').download(readinessPath)
      if (!active || !data) return
      try {
        const cloudReady = JSON.parse(await data.text())
        if (cloudReady && typeof cloudReady === 'object') {
          setPersonalReady((localReady) => {
            const merged = { ...localReady, ...cloudReady }
            window.localStorage.setItem(`stageflow-personal-ready-${production.id}`, JSON.stringify(merged))
            return merged
          })
          setReadinessSyncedAt(new Date())
        }
      } catch { /* 준비 상태 파일이 아직 없거나 손상된 경우 로컬 값을 유지합니다. */ }
    }
    syncReadiness()
    const timer = tab === 'show' ? window.setInterval(syncReadiness, 5000) : null
    return () => { active = false; if (timer) window.clearInterval(timer) }
  }, [readinessPath, production.id, tab])
  useEffect(() => {
    let wakeLock = null
    let active = true
    async function requestWakeLock() {
      if (tab !== 'show' || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
      try {
        wakeLock = await navigator.wakeLock.request('screen')
        if (active) setWakeLockActive(true)
        wakeLock.addEventListener('release', () => { if (active) setWakeLockActive(false) })
      } catch { if (active) setWakeLockActive(false) }
    }
    function handleVisibility() { if (document.visibilityState === 'visible') requestWakeLock() }
    requestWakeLock()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLock) wakeLock.release().catch(() => {})
      setWakeLockActive(false)
    }
  }, [tab])
  useEffect(() => {
    if (tab !== 'show') { setShowCursorLoaded(false); return undefined }
    let active = true
    async function syncShowCursor() {
      const { data } = await supabase.storage.from('stageflow-files').download(showCursorPath)
      if (!active) return
      if (data) {
        try {
          const cursor = JSON.parse(await data.text())
          if (Number.isInteger(cursor.index) && scenes.length) setShowIndex(Math.max(0, Math.min(scenes.length - 1, cursor.index)))
          setShowHold(Boolean(cursor.hold))
          setShowHoldMessage(String(cursor.holdMessage || ''))
          setShowCursorSyncedAt(new Date())
        } catch { /* 진행 상태가 없으면 현재 기기의 장면에서 시작합니다. */ }
      }
      setShowCursorLoaded(true)
    }
    syncShowCursor()
    const timer = showController ? null : window.setInterval(syncShowCursor, 3000)
    return () => { active = false; if (timer) window.clearInterval(timer) }
  }, [tab, showCursorPath, scenes.length, setShowIndex, showController])
  useEffect(() => {
    if (tab !== 'show') return
    supabase.storage.from('stageflow-files').download(showLogPath).then(async ({ data }) => {
      if (!data) return
      try {
        const parsed = JSON.parse(await data.text())
        setShowEvents(Array.isArray(parsed) ? parsed.slice(-100) : [])
      } catch { /* 공연 기록이 아직 없으면 빈 목록으로 시작합니다. */ }
    })
  }, [tab, showLogPath])
  useEffect(() => {
    if (tab !== 'show') return
    supabase.storage.from('stageflow-files').download(runLogPath).then(async ({ data }) => {
      if (!data) return
      try { const parsed = JSON.parse(await data.text()); setRunHistory(Array.isArray(parsed.runs) ? parsed.runs : []) }
      catch { /* 전체 런 기록이 없으면 빈 목록 유지 */ }
    })
  }, [tab, runLogPath])
  useEffect(() => {
    if (!runSession) return undefined
    const timer = window.setInterval(() => setRunElapsed(Math.floor((Date.now() - new Date(runSession.startedAt).getTime()) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [runSession])
  function startFullRun() {
    if (!scenes.length || !showController) return
    const now = new Date().toISOString()
    setShowIndex(0); setRunElapsed(0)
    setRunSession({ id: crypto.randomUUID(), type: runType, startedAt: now, sceneStartedAt: now, segments: [] })
  }
  async function persistFullRun(session, completed) {
    const record = { ...session, totalDuration: Math.max(1, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)), completed, endedAt: completed ? new Date().toISOString() : null }
    let existing = runHistory
    const { data } = await supabase.storage.from('stageflow-files').download(runLogPath)
    if (data) { try { const parsed = JSON.parse(await data.text()); if (Array.isArray(parsed.runs)) existing = parsed.runs } catch { /* 현재 기록 사용 */ } }
    const nextRuns = [record, ...existing.filter((item) => item.id !== record.id)].slice(0, 50)
    const { error } = await supabase.storage.from('stageflow-files').upload(runLogPath, new Blob([JSON.stringify({ runs: nextRuns, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (!error) setRunHistory(nextRuns)
  }
  async function goNextWithTiming() {
    if (!current) return
    if (!runSession) { if (next) setShowIndex((index) => Math.min(scenes.length - 1, index + 1)); return }
    const now = new Date()
    const segment = { sceneNo: current.scene_no, sceneTitle: current.title, startedAt: runSession.sceneStartedAt, endedAt: now.toISOString(), duration: Math.max(1, Math.floor((now - new Date(runSession.sceneStartedAt)) / 1000)) }
    const updated = { ...runSession, sceneStartedAt: now.toISOString(), segments: [...runSession.segments, segment] }
    await persistFullRun(updated, !next)
    if (next) { setRunSession(updated); setShowIndex((index) => Math.min(scenes.length - 1, index + 1)) }
    else { setRunSession(null); setRunElapsed(0) }
  }
  useEffect(() => {
    if (tab !== 'show' || !runSession) return undefined
    const interceptRunControls = (event) => {
      const goButton = event.target.closest?.('.show-actions .go-button')
      const previousButton = event.target.closest?.('.show-actions button:not(.go-button)')
      if (!goButton && !previousButton) return
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation()
      if (goButton) goNextWithTiming()
    }
    document.addEventListener('click', interceptRunControls, true)
    return () => document.removeEventListener('click', interceptRunControls, true)
  }, [tab, runSession, current, next, scenes.length])
  async function appendShowEvent(event) {
    let existing = showEvents
    const { data } = await supabase.storage.from('stageflow-files').download(showLogPath)
    if (data) {
      try { const parsed = JSON.parse(await data.text()); if (Array.isArray(parsed)) existing = parsed }
      catch { /* 기존 기록을 읽지 못하면 현재 화면의 기록을 사용합니다. */ }
    }
    const nextEvents = [...existing, event].slice(-100)
    const { error } = await supabase.storage.from('stageflow-files').upload(showLogPath, new Blob([JSON.stringify(nextEvents)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (!error) setShowEvents(nextEvents)
  }
  useEffect(() => {
    if (tab !== 'show' || !showController || !showCursorLoaded || !scenes[showIndex]) return
    const previous = previousShowState.current
    const payload = { index: showIndex, sceneNo: scenes[showIndex].scene_no, hold: showHold, holdMessage: showHold ? showHoldMessage : '', updatedAt: new Date().toISOString() }
    previousShowState.current = payload
    let event = null
    if (previous && previous.hold !== showHold) event = { id: crypto.randomUUID(), type: showHold ? 'HOLD' : 'RESUME', label: showHold ? (showHoldMessage || '상황 확인 중') : '공연 재개', sceneNo: scenes[showIndex].scene_no, createdAt: payload.updatedAt }
    else if (previous && previous.index !== showIndex) event = { id: crypto.randomUUID(), type: 'GO', label: scenes[showIndex].title, sceneNo: scenes[showIndex].scene_no, createdAt: payload.updatedAt }
    supabase.storage.from('stageflow-files').upload(showCursorPath, new Blob([JSON.stringify(payload)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' }).then(({ error }) => {
      if (!error) {
        setShowCursorSyncedAt(new Date())
        if (event) appendShowEvent(event)
      }
    })
  }, [showIndex, showHold, showHoldMessage, showController, showCursorLoaded, showCursorPath, tab, scenes])
  useEffect(() => {
    if (tab !== 'show') return undefined
    const controls = [...document.querySelectorAll('.show-mode .show-actions button')]
    controls.forEach((button, index) => { button.disabled = showHold || !showController || (index === 0 ? showIndex === 0 : showIndex >= scenes.length - 1) })
    return undefined
  }, [tab, showController, showHold, showIndex, scenes.length])
  const currentCast = current ? castMembers.filter((member) => (member.sceneNumbers || []).includes(current.scene_no)) : []
  const currentProps = current ? propItems.filter((item) => Number(item.sceneNo) === Number(current.scene_no)) : []
  const currentMusic = current ? (musicByScene[current.scene_no] || []) : []
  const currentCues = current ? parseSceneCues(current.summary) : []
  const currentCostumes = current ? parseSceneCostumes(current.summary) : []
  const nextProps = next ? propItems.filter((item) => Number(item.sceneNo) === Number(next.scene_no)) : []
  const nextCostumes = next ? parseSceneCostumes(next.summary) : []
  const briefingCurrentProps = briefingMember ? currentProps.filter((item) => assignmentMatches(item.inBy, briefingMember) || assignmentMatches(item.outBy, briefingMember)) : currentProps
  const briefingNextProps = briefingMember ? nextProps.filter((item) => assignmentMatches(item.inBy, briefingMember)) : nextProps
  const briefingCurrentCostumes = briefingMember ? currentCostumes.filter((item) => assignmentMatches(item.role, briefingMember)) : currentCostumes
  const briefingNextCostumes = briefingMember ? nextCostumes.filter((item) => assignmentMatches(item.role, briefingMember)) : nextCostumes
  const nextAppearanceIndex = briefingMember ? scenes.findIndex((scene, index) => index > showIndex && (briefingMember.sceneNumbers || []).includes(scene.scene_no)) : -1
  const nextAppearance = nextAppearanceIndex >= 0 ? scenes[nextAppearanceIndex] : null
  const nextAppearanceCostumes = nextAppearance && briefingMember ? parseSceneCostumes(nextAppearance.summary).filter((item) => assignmentMatches(item.role, briefingMember)) : []
  const nextAppearanceProps = nextAppearance && briefingMember ? propItems.filter((item) => Number(item.sceneNo) === Number(nextAppearance.scene_no) && assignmentMatches(item.inBy, briefingMember)) : []
  const upcomingCast = next ? castMembers.filter((member) => (member.sceneNumbers || []).includes(next.scene_no)) : []
  const upcomingReadyCount = next ? upcomingCast.filter((member) => personalReady[`${member.id}-${next.scene_no}`]).length : 0
  const preparationAlerts = [
    { key: 'music', tab: 'music', icon: 'music', count: scenes.filter((scene) => !(musicByScene[scene.scene_no] || []).length).length, title: '음악 미연결 장면', detail: '넘버 파일을 장면에 연결해 주세요.' },
    { key: 'props', tab: 'props', icon: 'props', count: propItems.filter((item) => !item.ready).length, title: '준비 안 된 소품', detail: '담당자와 IN·OUT을 확인해 주세요.' },
    { key: 'cast', tab: 'cast', icon: 'cast', count: scenes.filter((scene) => !castMembers.some((member) => (member.sceneNumbers || []).includes(scene.scene_no))).length, title: '배역 미연결 장면', detail: '등장 배우와 배역을 지정해 주세요.' },
    { key: 'cues', tab: 'cues', icon: 'cues', count: scenes.filter((scene) => !parseSceneCues(scene.summary).length).length, title: '큐 미등록 장면', detail: '조명·음향·영상 큐를 확인해 주세요.' },
  ].filter((item) => item.count > 0)
  const actNumbers = [...new Set(scenes.map((scene) => Number(scene.act_no)))].sort((a, b) => a - b)
  const visibleScenes = scenes.filter((scene) => {
    const matchesAct = actFilter === '전체' || Number(scene.act_no) === Number(actFilter)
    const query = normalizeMatch(sceneQuery)
    return matchesAct && (!query || normalizeMatch(`${scene.scene_no} ${scene.title} ${scene.summary || ''}`).includes(query))
  })
  const toggleCue = (sceneNo, cueIndex) => setCompletedCues((value) => ({ ...value, [`${sceneNo}-${cueIndex}`]: !value[`${sceneNo}-${cueIndex}`] }))
  function selectBriefingMember(id) {
    setBriefingMemberId(id)
    if (id) window.localStorage.setItem(`stageflow-briefing-${production.id}`, id)
    else window.localStorage.removeItem(`stageflow-briefing-${production.id}`)
  }
  async function togglePersonalReady(sceneNo) {
    const key = `${briefingMemberId}-${sceneNo}`
    const nextValue = { ...personalReady, [key]: !personalReady[key] }
    setPersonalReady(nextValue)
    window.localStorage.setItem(`stageflow-personal-ready-${production.id}`, JSON.stringify(nextValue))
    const { error } = await supabase.storage.from('stageflow-files').upload(readinessPath, new Blob([JSON.stringify(nextValue)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (!error) setReadinessSyncedAt(new Date())
  }
  async function saveProduction(event) {
    event.preventDefault()
    if (!productionDraft.title.trim()) return
    if (await updateProduction(productionDraft)) setEditingProduction(false)
  }
  return <div className="app-shell production-shell-v2">
    <header className="topbar production-topbar"><button className="icon-button" onClick={goBack} aria-label="홈으로"><ChevronLeft /></button><div className="topbar-title"><strong>공연 준비</strong><span>{workspace.name}</span></div><span className="header-spacer" /></header>
    <main className="content production-content">
      {editingProduction ? <form className="production-edit-bar" onSubmit={saveProduction}><input required value={productionDraft.title} onChange={(event) => setProductionDraft({ ...productionDraft, title: event.target.value })} placeholder="공연명" /><input value={productionDraft.venue} onChange={(event) => setProductionDraft({ ...productionDraft, venue: event.target.value })} placeholder="공연 장소" /><input type="date" value={productionDraft.performance_start_date} onChange={(event) => setProductionDraft({ ...productionDraft, performance_start_date: event.target.value })} /><div><button type="button" onClick={() => setEditingProduction(false)}>취소</button><button className="primary compact"><Save size={16} /> 저장</button></div></form> : <section className="production-bar"><div><span>{production.performance_start_date || '공연일 미정'}</span><h1>{production.title}</h1><p><MapPin size={14} /> {production.venue || '공연 장소 미정'}</p></div><div className="production-bar-actions">{daysLeft !== null && <strong>{daysLeft >= 0 ? `D-${daysLeft}` : '종료'}</strong>}<button className="icon-button" onClick={() => setEditingProduction(true)} aria-label="공연 정보 수정"><Pencil size={16} /></button></div></section>}
      <nav className="production-primary-nav" aria-label="공연 주요 메뉴"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><Home /><span>개요</span></button><button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}><CheckCircle2 /><span>할 일</span></button><button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}><Clapperboard /><span>장면</span></button><button className={tab === 'cast' ? 'active' : ''} onClick={() => setTab('cast')}><Users /><span>배우</span></button><button className={tab === 'show' ? 'active' : ''} onClick={() => setTab('show')}><Play /><span>공연</span></button><button className={['props', 'costumes', 'cues', 'rehearsal', 'materials', 'schedule', 'backup', 'import', 'music'].includes(tab) ? 'active' : ''} onClick={() => setMoreOpen(true)}><MoreHorizontal /><span>더보기</span></button></nav>
      {tab === 'overview' && <section className="overview-v2"><article className="readiness-card"><div className="readiness-head"><div><span>전체 준비도</span><strong>{progress}%</strong></div><button onClick={() => setTab('show')}><Play fill="currentColor" /> 공연모드</button></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="readiness-list"><button onClick={() => setTab('scenes')}><Clapperboard /><span>장면</span><b>{scenes.length}</b><ChevronRight /></button><button onClick={() => setTab('cast')}><Users /><span>배우·배역</span><b>{castMembers.length}</b><ChevronRight /></button><button onClick={() => setTab('props')}><Package /><span>소품·대도구</span><b>{readyProps}/{propItems.length}</b><ChevronRight /></button></div></article><button className="continue-card" onClick={() => setTab('import')}><WandSparkles /><div><strong>자료에서 자동정리</strong><span>대본 PDF를 장면·인물·소품으로 분류</span></div><ChevronRight /></button></section>}
      {tab === 'overview' && <PreparationHealth alerts={preparationAlerts} open={setTab} />}
      {tab === 'tasks' && <TasksPanel workspace={workspace} production={production} />}
      {tab === 'scenes' && <><div className="section-heading"><div><p className="eyebrow">SCENES</p><h2>장면 관리</h2></div><button className="primary compact" onClick={() => setShowForm((v) => !v)}><Plus size={18} /> 장면</button></div>{showForm && <SceneForm form={form} setForm={setForm} submit={createScene} busy={busy} />} {!!scenes.length && <div className="scene-tools"><label><Search size={17} /><input value={sceneQuery} onChange={(event) => setSceneQuery(event.target.value)} placeholder="장면·배역·소품 검색" /></label><div><button className={actFilter === '전체' ? 'active' : ''} onClick={() => setActFilter('전체')}>전체</button>{actNumbers.map((act) => <button className={Number(actFilter) === act ? 'active' : ''} key={act} onClick={() => setActFilter(act)}>ACT {act}</button>)}</div><span>{visibleScenes.length}/{scenes.length}개 장면</span></div>}<section className="scene-list">{!scenes.length && <Empty icon={<Clapperboard />} title="아직 장면이 없어요" description="첫 장면을 등록해 공연 흐름을 만들어보세요." action={() => setShowForm(true)} />}{!!scenes.length && !visibleScenes.length && <Empty icon={<Search />} title="검색 결과가 없어요" description="다른 검색어나 ACT를 선택해보세요." />}{visibleScenes.map((scene) => <SceneCard key={scene.id} scene={scene} update={updateScene} remove={() => deleteScene(scene.id)} />)}</section></>}
      {tab === 'cast' && <CastPanel members={castMembers} scenes={scenes} propItems={propItems} form={castForm} setForm={setCastForm} showForm={showCastForm} setShowForm={setShowCastForm} submit={addCastMember} update={updateCastMember} remove={removeCastMember} toggleScene={toggleCastScene} importFromScenes={importCastFromScenes} busy={busy} />}
      {tab === 'props' && <PropsPanel items={propItems} scenes={scenes} form={propForm} setForm={setPropForm} showForm={showPropForm} setShowForm={setShowPropForm} filter={propFilter} setFilter={setPropFilter} submit={addPropItem} update={updatePropItem} remove={removePropItem} toggleReady={togglePropReady} importFromScenes={importPropsFromScenes} busy={busy} />}
      {tab === 'costumes' && <CostumePanel scenes={scenes} castMembers={castMembers} updateScene={updateScene} />}
      {tab === 'cues' && <CuePanel scenes={scenes} completed={completedCues} toggle={toggleCue} updateScene={updateScene} autoLink={autoLinkProductionCues} busy={busy} />}
      {tab === 'materials' && <MaterialsPanel workspace={workspace} production={production} />}
      {tab === 'schedule' && <SchedulePanel workspace={workspace} production={production} />}
      {tab === 'backup' && <BackupPanel workspace={workspace} production={production} scenes={scenes} castMembers={castMembers} propItems={propItems} musicByScene={musicByScene} restore={restoreProductionBackup} busy={busy} />}
      {tab === 'import' && <ImportPanel workspace={workspace} production={production} scenes={scenes} text={importText} setText={setImportText} rows={importRows} setRows={setImportRows} analyze={analyzeImport} analyzeWithAI={analyzeImportWithAI} save={saveImportedScenes} readPdf={readPdf} readSpreadsheet={readSpreadsheet} undo={undoLastImport} loading={importingPdf || busy} aiAnalyzing={aiAnalyzing} />}
      {tab === 'music' && <MusicPanel scenes={scenes} pending={pendingMusic} musicByScene={musicByScene} organize={organizeMusicFiles} assign={assignMusicScene} upload={uploadOrganizedMusic} remove={deleteMusicFile} loading={uploadingMusic} />}
      {tab === 'show' && briefingMember && current && <section className={`next-appearance-card ${nextAppearance && nextAppearanceIndex - showIndex <= 1 ? 'urgent' : ''} ${nextAppearance && personalReady[`${briefingMemberId}-${nextAppearance.scene_no}`] ? 'ready' : ''}`}><div className="appearance-head"><UserRound /><div><span>NEXT CALL</span><strong>{briefingMember.roleName || briefingMember.name} 다음 등장</strong></div>{nextAppearance && <b>{nextAppearanceIndex - showIndex <= 1 ? '곧 등장' : `${nextAppearanceIndex - showIndex}장면 뒤`}</b>}</div>{nextAppearance ? <><div className="appearance-scene"><span>{nextAppearance.scene_no}</span><div><small>ACT {nextAppearance.act_no}</small><strong>{nextAppearance.title}</strong></div></div><div className="appearance-prep"><div><Shirt /><span><b>의상</b><small>{nextAppearanceCostumes.length ? nextAppearanceCostumes.map((item) => item.name).join(' · ') : '등록 없음'}</small></span></div><div><Package /><span><b>챙길 소품</b><small>{nextAppearanceProps.length ? nextAppearanceProps.map((item) => item.name).join(' · ') : '등록 없음'}</small></span></div></div><button className="appearance-ready-button" onClick={() => togglePersonalReady(nextAppearance.scene_no)}><CheckCircle2 />{personalReady[`${briefingMemberId}-${nextAppearance.scene_no}`] ? '등장 준비 완료됨' : '의상·소품 준비 완료'}</button></> : <p>남은 등장 장면이 없어요. 수고했어요!</p>}</section>}
      {tab === 'show' && next && <section className="team-readiness"><div><Users /><span><b>다음 장면 배우 준비</b><small>{next.scene_no}. {next.title}</small></span><strong>{upcomingReadyCount}/{upcomingCast.length}</strong></div><div className="team-ready-list">{upcomingCast.map((member) => <span className={personalReady[`${member.id}-${next.scene_no}`] ? 'ready' : ''} key={member.id}><CheckCircle2 />{member.roleName || member.name}</span>)}</div></section>}
      {tab === 'show' && <div className="show-system-status"><p className="readiness-sync"><span className="sync-dot" />{readinessSyncedAt ? `준비 상태 · ${readinessSyncedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '팀 준비 상태 연결 중…'}</p><p className={showCursorLoaded ? 'cursor-sync active' : 'cursor-sync'}><span />{showCursorSyncedAt ? `장면 동기화 · ${showCursorSyncedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '장면 연결 중…'}</p><p className={wakeLockActive ? 'wake-lock active' : 'wake-lock'}><span />{wakeLockActive ? '화면 꺼짐 방지 중' : '화면 잠금 방지 미지원'}</p></div>}
      {tab === 'show' && <button className={showController ? 'show-control-toggle controller' : 'show-control-toggle'} onClick={toggleShowController}><Clapperboard /><span><b>{showController ? '진행 제어 중' : '무대감독 장면 따라가기'}</b><small>{showController ? '이 기기의 이전·GO 이동을 팀에 전송합니다.' : '팀에서 공유된 현재 장면으로 자동 이동합니다.'}</small></span><strong>{showController ? 'CONTROL' : 'FOLLOW'}</strong></button>}
      {tab === 'show' && !showController && <p className="follow-lock"><Clapperboard />FOLLOW 모드 · 장면 이동은 무대감독 기기에서 제어합니다.</p>}
      {tab === 'show' && showHold && <section className="show-hold-alert"><Bell /><div><span>SHOW HOLD</span><strong>{showHoldMessage || '공연 진행 일시 정지'}</strong><small>무대감독의 재개 신호를 기다려주세요.</small></div></section>}
      {tab === 'show' && showController && <button className={showHold ? 'hold-control resume' : 'hold-control'} onClick={toggleShowHold}>{showHold ? <Play /> : <Square />}<span><b>{showHold ? '공연 재개' : '긴급 HOLD'}</b><small>{showHold ? '팀 화면의 정지를 해제하고 GO를 활성화합니다.' : '팀 전체 화면을 정지하고 장면 이동을 잠급니다.'}</small></span></button>}
      {tab === 'show' && <RunControl type={runType} setType={setRunType} session={runSession} elapsed={runElapsed} history={runHistory} current={current} start={startFullRun} finish={goNextWithTiming} enabled={showController} isLast={!next} />}
      {tab === 'show' && !runSession && !!runHistory.length && <RunHistory runs={runHistory} />}
      {tab === 'show' && !!showEvents.length && <ShowEventLog events={showEvents} />}
      {tab === 'show' && <section className="show-mode">{!current ? <Empty icon={<Play />} title="진행할 장면이 없어요" description="장면을 먼저 등록해주세요." action={() => setTab('scenes')} /> : <><div className="show-head"><span>NOW PLAYING</span><strong>{showIndex + 1} / {scenes.length}</strong></div><label className="briefing-picker"><UserRound /><span>내 배역 브리핑</span><select value={briefingMemberId} onChange={(event) => selectBriefingMember(event.target.value)}><option value="">전체 보기</option>{castMembers.map((member) => <option key={member.id} value={member.id}>{member.roleName || '배역 미정'} · {member.name}</option>)}</select></label><article className="current-scene"><p>ACT {current.act_no} · SCENE {current.scene_no}</p><h2>{current.title}</h2>{briefingMember && <span className={(briefingMember.sceneNumbers || []).includes(current.scene_no) ? 'briefing-status onstage' : 'briefing-status standby'}>{(briefingMember.sceneNumbers || []).includes(current.scene_no) ? `${briefingMember.roleName || briefingMember.name} 등장 장면` : '대기 · 다음 준비 확인'}</span>}</article><div className="show-operations"><article><div className="show-section-title"><ListChecks /><strong>현재 큐</strong><span>{currentCues.filter((_, index) => completedCues[`${current.scene_no}-${index}`]).length}/{currentCues.length}</span></div>{currentCues.length ? <CueList cues={currentCues} sceneNo={current.scene_no} completed={completedCues} toggle={toggleCue} compact /> : <p>연결된 큐가 없어요.</p>}</article><article><div className="show-section-title"><Users /><strong>등장 배역 · 배우</strong><span>{currentCast.length}</span></div>{currentCast.length ? <div className="show-cast-list">{currentCast.map((member) => <span className={member.id === briefingMemberId ? 'selected' : ''} key={member.id}><b>{member.roleName || '배역 미정'}</b><small>{member.name}</small></span>)}</div> : <p>연결된 배우가 없어요.</p>}</article><article><div className="show-section-title"><Shirt /><strong>{briefingMember ? '내 의상 · 체인지' : '현재 의상 · 체인지'}</strong><span>{briefingCurrentCostumes.length}</span></div>{briefingCurrentCostumes.length ? <div className="show-costume-list">{briefingCurrentCostumes.map((item, index) => <div key={`${item.role}-${index}`}><b>{item.role}</b><span>{item.name}</span>{item.note && <small>{item.note}</small>}</div>)}</div> : <p>{briefingMember ? '현재 장면에 내 의상 체인지가 없어요.' : '등록된 의상 체인지가 없어요.'}</p>}</article><article><div className="show-section-title"><Package /><strong>{briefingMember ? '내 소품 업무' : '소품·대도구'}</strong><span>{briefingCurrentProps.filter((item) => item.ready).length}/{briefingCurrentProps.length}</span></div>{briefingCurrentProps.length ? <div className="show-prop-list">{briefingCurrentProps.map((item) => <button className={item.ready ? 'ready' : ''} key={item.id} onClick={() => togglePropReady(item.id)}><CheckCircle2 /><div><b>{item.name}</b><small>IN {item.inBy || '미정'} · OUT {item.outBy || '미정'}</small></div></button>)}</div> : <p>{briefingMember ? '현재 장면에 내 소품 업무가 없어요.' : '연결된 소품이 없어요.'}</p>}</article><article><div className="show-section-title"><FileAudio /><strong>음악</strong><span>{currentMusic.length}</span></div>{currentMusic.length ? <div className="show-music-list">{currentMusic.map((file) => <div key={file.path}><span>{cleanStoredFileName(file.name)}</span>{file.url && <audio controls preload="none" src={file.url} />}</div>)}</div> : <p>연결된 음악이 없어요.</p>}</article></div><article className="next-cue"><span>NEXT</span><strong>{next ? `${next.scene_no}. ${next.title}` : 'Curtain Call'}</strong>{next && <div className="next-prep"><div><Shirt /><b>의상 준비</b><span>{briefingNextCostumes.length ? briefingNextCostumes.map((item) => `${item.role} → ${item.name}`).join(' · ') : briefingMember ? '내 체인지 없음' : '등록 없음'}</span></div><div><Package /><b>소품 준비</b><span>{briefingNextProps.length ? briefingNextProps.map((item) => `${item.name} (${item.inBy || '담당 미정'})`).join(' · ') : briefingMember ? '내 준비 업무 없음' : '등록 없음'}</span></div></div>}</article><div className="show-actions"><button disabled={!showIndex} onClick={() => setShowIndex((i) => Math.max(0, i - 1))}>이전</button><button className="go-button" disabled={!next} onClick={() => setShowIndex((i) => Math.min(scenes.length - 1, i + 1))}>GO <Play fill="currentColor" /></button></div></>}</section>}
      {notice && <p className="notice">{notice}</p>}
    </main>
    {moreOpen && <ProductionMoreSheet active={tab} close={() => setMoreOpen(false)} choose={(value) => { setTab(value); setMoreOpen(false) }} />}
  </div>
}

function PreparationHealth({ alerts, open }) {
  const icons = { music: FileAudio, props: Package, cast: Users, cues: ListChecks }
  return <section className="preparation-health"><div className="preparation-health-head"><div><span>PRE-FLIGHT CHECK</span><h2>공연 전 확인</h2></div><strong className={alerts.length ? 'warning' : 'ready'}>{alerts.length ? `${alerts.length}개 항목` : '준비 완료'}</strong></div>{alerts.length ? <div className="preparation-alert-list">{alerts.map((alert) => { const Icon = icons[alert.icon]; return <button key={alert.key} onClick={() => open(alert.tab)}><span className="alert-icon"><Icon /></span><div><b>{alert.title}</b><small>{alert.detail}</small></div><strong>{alert.count}</strong><ChevronRight /></button> })}</div> : <div className="preparation-clear"><CheckCircle2 /><div><b>필수 준비 항목을 모두 확인했어요</b><small>공연모드에서 최종 큐를 점검해 주세요.</small></div></div>}</section>
}

function RunControl({ type, setType, session, elapsed, history, current, start, finish, enabled, isLast }) {
  const latest = history[0]
  return <section className={session ? 'full-run-control running' : 'full-run-control'}><div className="run-control-head"><Timer /><span><b>{session ? `${session.type === 'rehearsal' ? '리허설' : '공연'} 전체 런 진행 중` : '공연 · 리허설 통합 런'}</b><small>{session ? `${current?.scene_no}. ${current?.title || ''} 측정 중` : 'GO를 누를 때마다 장면별 시간이 자동 저장됩니다.'}</small></span>{session && <strong>{formatDuration(elapsed)}</strong>}</div>{!session ? <><div className="run-type-switch"><button className={type === 'rehearsal' ? 'active' : ''} onClick={() => setType('rehearsal')}>리허설</button><button className={type === 'show' ? 'active' : ''} onClick={() => setType('show')}>공연</button></div><button className="run-start" disabled={!enabled} onClick={start}><Play fill="currentColor" /> 전체 장면 런 시작</button>{!enabled && <small className="run-help">CONTROL 모드에서 전체 런을 시작할 수 있어요.</small>}</> : <><div className="run-live"><span>완료 장면 <b>{session.segments.length}</b></span><span>현재 장면 <b>{formatDuration(Math.max(0, Math.floor((Date.now() - new Date(session.sceneStartedAt).getTime()) / 1000)))}</b></span></div>{isLast && <button className="run-finish" onClick={finish}><Square fill="currentColor" /> 마지막 장면 기록 · 런 종료</button>}</>}{latest && !session && <div className="last-run"><span>최근 {latest.type === 'show' ? '공연' : '리허설'} 런</span><b>{formatDuration(latest.totalDuration || 0)}</b><small>{latest.segments?.length || 0}개 장면 기록</small></div>}</section>
}

function RunHistory({ runs }) {
  const [open, setOpen] = useState(false)
  const completed = runs.filter((run) => run.completed && run.segments?.length)
  const [selectedId, setSelectedId] = useState(completed[0]?.id || runs[0]?.id)
  const selected = runs.find((run) => run.id === selectedId) || runs[0]
  const selectedIndex = completed.findIndex((run) => run.id === selected.id)
  const previous = selectedIndex >= 0 ? completed[selectedIndex + 1] : null
  const difference = previous ? (selected.totalDuration || 0) - (previous.totalDuration || 0) : null
  const slowest = [...(selected.segments || [])].sort((a, b) => b.duration - a.duration)[0]
  const sceneAverages = (selected.segments || []).map((segment) => { const values = completed.flatMap((run) => (run.segments || []).filter((item) => Number(item.sceneNo) === Number(segment.sceneNo)).map((item) => item.duration)); return { ...segment, average: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : segment.duration } })
  return <section className="full-run-history"><button onClick={() => setOpen((value) => !value)}><Clock3 /><span><b>전체 런 분석</b><small>{completed.length}회 완료 · 최근 {selected.segments?.length || 0}개 장면</small></span><strong>{formatDuration(selected.totalDuration || 0)}</strong><ChevronRight /></button>{open && <div className="run-analysis"><div className="run-history-tabs">{completed.slice(0, 5).map((run, index) => <button className={run.id === selected.id ? 'active' : ''} key={run.id} onClick={() => setSelectedId(run.id)}><b>{index === 0 ? '최근' : `${index + 1}회 전`}</b><small>{formatDuration(run.totalDuration || 0)}</small></button>)}</div><div className="run-insights"><span><small>전체 시간</small><b>{formatDuration(selected.totalDuration || 0)}</b></span><span className={difference !== null && difference > 0 ? 'slower' : 'faster'}><small>이전 런 대비</small><b>{difference === null ? '-' : `${difference > 0 ? '+' : ''}${difference}초`}</b></span><span><small>최장 장면</small><b>{slowest ? `${slowest.sceneNo}. ${formatDuration(slowest.duration)}` : '-'}</b></span></div><div className="run-scene-analysis">{sceneAverages.map((segment, index) => { const delta = segment.duration - segment.average; return <article key={`${segment.sceneNo}-${index}`}><span>{segment.sceneNo}</span><div><b>{segment.sceneTitle}</b><small>평균 {formatDuration(segment.average)} · {new Date(segment.endedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} GO</small></div><strong>{formatDuration(segment.duration)}</strong><em className={delta > 0 ? 'slower' : 'faster'}>{delta === 0 ? '평균' : `${delta > 0 ? '+' : ''}${delta}초`}</em></article> })}</div></div>}</section>
}

function ShowEventLog({ events }) {
  const [reportStatus, setReportStatus] = useState('')
  const recent = events.slice(-6).reverse()
  const goCount = events.filter((event) => event.type === 'GO').length
  const holdEvents = events.filter((event) => event.type === 'HOLD')
  const startedAt = events[0] ? new Date(events[0].createdAt) : null
  const endedAt = events.at(-1) ? new Date(events.at(-1).createdAt) : null
  const durationMinutes = startedAt && endedAt ? Math.max(0, Math.round((endedAt - startedAt) / 60000)) : 0
  async function shareReport() {
    const report = [`[StageFlow 공연 리포트]`, `기록 시간: ${startedAt ? startedAt.toLocaleString('ko-KR') : '-'} ~ ${endedAt ? endedAt.toLocaleTimeString('ko-KR') : '-'}`, `진행 시간: 약 ${durationMinutes}분`, `장면 GO: ${goCount}회`, `HOLD: ${holdEvents.length}회`, '', '[HOLD 기록]', ...(holdEvents.length ? holdEvents.map((event) => `- ${new Date(event.createdAt).toLocaleTimeString('ko-KR')} · Scene ${event.sceneNo} · ${event.label}`) : ['- 없음'])].join('\n')
    try {
      if (navigator.share) { await navigator.share({ title: 'StageFlow 공연 리포트', text: report }); setReportStatus('공연 리포트를 공유했어요.') }
      else { await navigator.clipboard.writeText(report); setReportStatus('공연 리포트를 복사했어요.') }
    } catch (error) { if (error?.name !== 'AbortError') setReportStatus('리포트를 공유하지 못했어요.') }
  }
  return <section className="show-event-log"><div><Clock3 /><strong>공연 기록</strong><span>{events.length}건</span></div><div className="show-report-summary"><span><b>{durationMinutes}</b>분</span><span><b>{goCount}</b>GO</span><span><b>{holdEvents.length}</b>HOLD</span><button onClick={shareReport}><Upload /> 리포트</button></div>{reportStatus && <p>{reportStatus}</p>}<ol>{recent.map((event) => <li className={`event-${event.type.toLowerCase()}`} key={event.id}><time>{new Date(event.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><b>{event.type}</b><span>{event.sceneNo}. {event.label}</span></li>)}</ol></section>
}

function BackupPanel({ workspace, production, scenes, castMembers, propItems, musicByScene, restore, busy }) {
  const [status, setStatus] = useState('')
  const musicCount = Object.values(musicByScene).reduce((sum, files) => sum + files.length, 0)
  async function exportBackup() {
    const backup = {
      format: 'stageflow-backup', version: 1, exportedAt: new Date().toISOString(),
      workspace: { id: workspace.id, name: workspace.name },
      production,
      scenes: scenes.map((scene) => ({ ...scene, costumes: parseSceneCostumes(scene.summary).map(({ rawLine, ...item }) => item), cues: parseSceneCues(scene.summary).map(({ rawLine, ...item }) => item) })),
      castMembers,
      props: propItems,
      music: Object.fromEntries(Object.entries(musicByScene).map(([sceneNo, files]) => [sceneNo, files.map((file) => ({ name: cleanStoredFileName(file.name), path: file.path }))])),
    }
    const safeTitle = production.title.replace(/[^0-9a-z가-힣_-]+/gi, '-').replace(/^-|-$/g, '') || 'stageflow'
    const filename = `${safeTitle}-backup-${new Date().toISOString().slice(0, 10)}.json`
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const file = new File([blob], filename, { type: 'application/json' })
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${production.title} StageFlow 백업`, files: [file] })
        setStatus('백업 파일을 공유했어요.')
      } else {
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        setStatus('백업 파일을 다운로드했어요.')
      }
    } catch (error) { if (error?.name !== 'AbortError') setStatus('백업 파일을 만들지 못했어요.') }
  }
  async function importBackup(file) {
    if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      const result = await restore(backup)
      if (result.ok) setStatus(`복원 완료 · 장면 ${backup.scenes.length}개, 배우 ${backup.castMembers.length}명, 소품 ${backup.props.length}개`)
      else if (!result.cancelled) setStatus(result.message || '백업을 복원하지 못했어요.')
    } catch { setStatus('JSON 백업 파일을 읽지 못했어요.') }
  }
  return <section className="backup-panel"><div className="backup-hero"><Download /><div><p className="eyebrow">PRODUCTION BACKUP</p><h2>공연 데이터 백업</h2><p>현재 공연의 운영 정보를 한 파일로 보관합니다.</p></div></div><div className="backup-summary"><article><b>{scenes.length}</b><span>장면</span></article><article><b>{castMembers.length}</b><span>배우</span></article><article><b>{propItems.length}</b><span>소품</span></article><article><b>{musicCount}</b><span>음악 연결</span></article></div><article className="backup-info"><FileText /><div><strong>백업에 포함되는 정보</strong><p>공연 기본정보, 장면 요약, 배우·배역·등장 장면, 의상·큐, 소품 IN/OUT, 음악 파일 연결 경로</p><small>음악·PDF 원본 파일 자체는 포함되지 않습니다.</small></div></article><button className="primary backup-button" disabled={busy} onClick={exportBackup}><Download /> JSON 백업 저장</button><label className="restore-backup-button"><Upload /><span><b>백업에서 복원</b><small>현재 장면·배우·소품 데이터가 선택한 백업으로 교체됩니다.</small></span><input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => { importBackup(event.target.files?.[0]); event.target.value = '' }} /></label>{status && <p className="notice">{status}</p>}</section>
}

function ProductionMoreSheet({ active, close, choose }) {
  const items = [
    { id: 'props', label: '소품·대도구', description: 'IN/OUT과 준비 상태', icon: <Package /> },
    { id: 'costumes', label: '의상·퀵체인지', description: '배역별 의상과 체인지 순서', icon: <Shirt /> },
    { id: 'cues', label: '큐시트', description: '조명·음향·영상·무대 큐', icon: <ListChecks /> },
    { id: 'music', label: '음악', description: '넘버별 음악 업로드와 재생', icon: <FileAudio /> },
    { id: 'materials', label: '자료실', description: '대본·악보·영상·이미지', icon: <FileText /> },
    { id: 'schedule', label: '일정', description: '연습·리허설·공연 일정', icon: <CalendarDays /> },
    { id: 'backup', label: '데이터 백업', description: '공연 정보를 파일로 보관', icon: <Download /> },
    { id: 'import', label: '자동정리', description: 'PDF와 공연표 분석', icon: <WandSparkles /> },
  ]
  return <div className="sheet-backdrop" onClick={close}><section className="production-more-sheet" onClick={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="more-sheet-head"><div><p className="eyebrow">PRODUCTION TOOLS</p><h2>공연 도구</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="more-tool-grid">{items.map((item) => <button className={active === item.id ? 'active' : ''} key={item.id} onClick={() => choose(item.id)}><span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div><ChevronRight /></button>)}</div></section></div>
}

function ProductionForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="공연명" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="공연 장소" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /><input type="date" value={form.performance_start_date} onChange={(e) => setForm({ ...form, performance_start_date: e.target.value })} /><button className="primary" disabled={busy}>공연 만들기</button></form> }
function SceneForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="장면 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><div className="two-col"><input type="number" min="1" value={form.act_no} onChange={(e) => setForm({ ...form, act_no: Number(e.target.value) })} /><input type="number" min="0" step="0.1" value={form.scene_no} onChange={(e) => setForm({ ...form, scene_no: Number(e.target.value) })} /></div><textarea placeholder="장면 설명" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /><button className="primary" disabled={busy}>장면 저장</button></form> }
function ProductionCard({ item, index, open, remove }) { return <article className="production-card" onClick={open}><div className={`poster poster-${index % 3}`}><Theater size={38} /></div><div className="production-info"><div className="card-top"><span className="status">준비 중</span><button className="icon-button danger" onClick={(e) => { e.stopPropagation(); remove() }} aria-label="공연 삭제"><Trash2 size={17} /></button></div><h3>{item.title}</h3><p>{item.venue || '장소 미정'}</p><small>{item.performance_start_date || '공연일 미정'}</small></div></article> }
function SceneCard({ scene, update, remove }) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState({ title: scene.title, act_no: scene.act_no, scene_no: scene.scene_no, summary: scene.summary || '' })
  const summaryLines = (scene.summary || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const summaryPreview = summaryLines.find((line) => !line.startsWith('[') && !line.startsWith('-')) || summaryLines[0] || '등록된 상세 정보가 없어요.'
  async function save(event) {
    event.preventDefault()
    if (!draft.title.trim()) return
    if (await update(scene.id, draft)) setEditing(false)
  }
  if (editing) return <article className="scene-card scene-card-edit"><form onSubmit={save}><div className="two-col"><input type="number" min="1" value={draft.act_no} onChange={(event) => setDraft({ ...draft, act_no: event.target.value })} aria-label="ACT 번호" /><input type="number" min="0" step="0.1" value={draft.scene_no} onChange={(event) => setDraft({ ...draft, scene_no: event.target.value })} aria-label="장면 번호" /></div><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="장면 제목" /><textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="등장인물, 소품, 진행상황" /><div className="scene-edit-actions"><button type="button" onClick={() => setEditing(false)}>취소</button><button className="primary compact"><Save size={16} /> 저장</button></div></form></article>
  return <article className={expanded ? 'scene-card scene-card-collapsible open' : 'scene-card scene-card-collapsible'}><button className="scene-card-main" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}><div className="scene-index">{scene.scene_no}</div><div className="scene-copy"><span>ACT {scene.act_no}</span><h3>{scene.title}</h3><p>{summaryPreview}</p></div><ChevronRight /></button>{expanded && <div className="scene-card-detail"><div className="scene-detail-copy">{summaryLines.length ? summaryLines.map((line, index) => <p key={`${line}-${index}`}>{line}</p>) : <p>등록된 상세 정보가 없어요.</p>}</div><div className="scene-card-actions"><button onClick={() => setEditing(true)}><Pencil size={15} /> 수정</button><button className="danger" onClick={remove}><Trash2 size={16} /> 삭제</button></div></div>}</article>
}
function ImportPanel({ workspace, production, scenes, text, setText, rows, setRows, analyze, analyzeWithAI, save, readPdf, readSpreadsheet, undo, loading, aiAnalyzing }) {
  const [mode, setMode] = useState('add')
  const [targets, setTargets] = useState({ scenes: true, cast: true, props: true, costumes: true, cues: true })
  const [sources, setSources] = useState([])
  const [excludedRows, setExcludedRows] = useState([])
  async function loadSources() {
    const base = `${workspace.id}/${production.id}/imports`
    const { data } = await supabase.storage.from('stageflow-files').list(base, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } })
    const next = await Promise.all((data || []).filter((item) => item.id).map(async (item) => { const { data: signed } = await supabase.storage.from('stageflow-files').createSignedUrl(`${base}/${item.name}`, 3600); return { ...item, url: signed?.signedUrl || '' } }))
    setSources(next)
  }
  useEffect(() => { loadSources() }, [workspace.id, production.id])
  const rowSignature = rows.map((row) => Number(row.number)).join(',')
  useEffect(() => { setExcludedRows([]) }, [rowSignature])
  async function applyImport() { await save({ mode, targets, selectedNumbers: rows.filter((row) => !excludedRows.includes(Number(row.number))).map((row) => row.number) }); await loadSources() }
  const toggleTarget = (key) => setTargets((value) => ({ ...value, [key]: !value[key] }))
  const toggleImportRow = (number) => setExcludedRows((value) => value.includes(Number(number)) ? value.filter((item) => item !== Number(number)) : [...value, Number(number)])
  const updateImportRow = (index, patch) => setRows((value) => value.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  const audit = useMemo(() => buildImportAudit(rows), [rows])
  const existingImportNumbers = useMemo(() => new Set(scenes.map((scene) => Number(scene.scene_no))), [scenes])
  return <section className="import-panel">
    <label className="spreadsheet-upload"><FileSpreadsheet /><span><b>{loading ? '전체 표 분석 중…' : '엑셀·CSV 전체 분석'}</b><small>모든 시트의 행·열을 한 번에 읽습니다</small></span><ChevronRight /><input type="file" accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values" disabled={loading} onChange={(event) => { readSpreadsheet(event.target.files?.[0]); event.target.value = '' }} /></label>
    <button className="import-undo" disabled={loading} onClick={undo}><RotateCcw /><span><b>마지막 자동정리 되돌리기</b><small>적용 직전 장면·배우·소품 상태를 복원합니다</small></span><ChevronRight /></button>
    {!!rows.length && <ImportAudit audit={audit} />}
    {!!rows.length && <ImportPlan rows={rows} excluded={excludedRows} existing={existingImportNumbers} mode={mode} />}
    {!!rows.length && <ImportSelection rows={rows} excluded={excludedRows} existing={existingImportNumbers} toggle={toggleImportRow} update={updateImportRow} selectAll={() => setExcludedRows([])} clearAll={() => setExcludedRows(rows.map((row) => Number(row.number)))} />}
    <div className="import-hero"><div className="import-icon"><WandSparkles /></div><div><p className="eyebrow">SMART ORGANIZER</p><h2>자료 자동정리</h2><p>대본 PDF나 공연표를 넣으면 장면·배역·앙상블·소품·In/Out을 넘버별로 묶어줍니다.</p></div></div>
    <label className="upload-zone"><Upload size={25} /><strong>{loading ? 'PDF 분석 중…' : '대본 PDF 불러오기'}</strong><span>텍스트가 포함된 PDF를 선택하세요</span><input type="file" accept="application/pdf,.pdf" disabled={loading} onChange={(event) => readPdf(event.target.files?.[0])} /></label>
    <div className="import-divider"><span>또는 표 내용 붙여넣기</span></div>
    <textarea className="import-textarea" value={text} onChange={(event) => setText(event.target.value)} placeholder={'1. 가려진 진실\t앤더슨\t살인자 / 매춘부\t...\n2. 진정해 조심해\t앤더슨 / 먼로\t경찰 / 기자\t...'} />
    <div className="import-action-grid"><button className="secondary analyze-button" disabled={loading || aiAnalyzing || !text.trim()} onClick={analyze}><WandSparkles size={18} /> 빠른 표 정리</button><button className="primary analyze-button ai-analyze" disabled={loading || aiAnalyzing || !text.trim()} onClick={analyzeWithAI}><Sparkles size={18} /> {aiAnalyzing ? 'AI 분석 중…' : 'AI로 대본 분석'}</button></div>
    {!!rows.length && <><section className="import-apply-options"><div><span>저장 방식</span><button className={mode === 'add' ? 'active' : ''} onClick={() => setMode('add')}>새 항목만 추가</button><button className={mode === 'update' ? 'active' : ''} onClick={() => setMode('update')}>기존 항목 업데이트</button></div><fieldset><legend>적용할 정보</legend>{[['scenes','장면'],['cast','배역·등장인물'],['props','소품·대도구'],['costumes','의상'],['cues','큐']].map(([key,label]) => <label key={key}><input type="checkbox" checked={targets[key]} onChange={() => toggleTarget(key)} /><span>{label}</span></label>)}</fieldset><p>기존 데이터는 삭제하지 않으며, 업데이트 모드도 새 정보만 합칩니다.</p></section><div className="import-result-head"><div><p className="eyebrow">PREVIEW</p><h3>{rows.length}개 행을 장면으로 인식했어요</h3></div><button className="primary compact" disabled={loading || !Object.values(targets).some(Boolean)} onClick={applyImport}><CheckCircle2 size={18} /> 선택대로 적용</button></div><div className="import-results">{rows.map((row) => <article className="import-card" key={row.number}><div className="import-number">{row.number}</div><div className="import-card-copy"><h3>{row.title}</h3><div className="import-tags">{row.main && <span>주연 {row.main}</span>}{row.ensemble && <span>앙상블 {row.ensemble}</span>}{row.props.length > 0 && <span>소품 {row.props.length}개</span>}{row.costumes?.length > 0 && <span>의상 {row.costumes.length}개</span>}{row.cues?.length > 0 && <span>큐 {row.cues.length}개</span>}</div>{row.status && <p>{row.status}</p>}{row.props.length > 0 && <ul>{row.props.slice(0, 3).map((prop, index) => <li key={`${prop.name}-${index}`}><b>{prop.kind || '소품'}</b> {prop.name}{prop.inBy && ` · In ${prop.inBy}`}{prop.outBy && ` · Out ${prop.outBy}`}</li>)}</ul>}</div></article>)}</div></>}
    <section className="import-source-library"><div className="compact-heading"><div><span>SOURCE LIBRARY</span><h2>업로드 자료</h2></div><small>{sources.length}개</small></div>{sources.length ? <div>{sources.map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><FileText /><span><b>{cleanStoredFileName(item.name)}</b><small>{item.created_at ? new Date(item.created_at).toLocaleString('ko-KR') : '업로드 자료'}</small></span><ChevronRight /></a>)}</div> : <p>아직 보관된 원본 자료가 없어요.</p>}</section>
  </section>
}
function ImportAudit({ audit }) {
  return <section className={audit.warnings.length ? 'import-audit has-warnings' : 'import-audit'}><div className="import-audit-head"><div><span>IMPORT CHECK</span><h3>인식 결과 점검</h3></div><strong>{audit.warnings.length ? `${audit.warnings.length}개 확인` : '문제 없음'}</strong></div><div className="import-audit-stats"><span><b>{audit.scenes}</b><small>장면</small></span><span><b>{audit.people}</b><small>인물·배역</small></span><span><b>{audit.props}</b><small>소품·대도구</small></span><span><b>{audit.cues}</b><small>큐</small></span></div>{audit.warnings.length > 0 && <div className="import-audit-warnings">{audit.warnings.map((warning) => <p key={warning}><Bell />{warning}</p>)}</div>}</section>
}

function ImportPlan({ rows, excluded, existing, mode }) {
  const selectedRows = rows.filter((row) => !excluded.includes(Number(row.number)))
  const newCount = selectedRows.filter((row) => !existing.has(Number(row.number))).length
  const existingCount = selectedRows.length - newCount
  return <section className="import-plan"><div><span>CHANGE PLAN</span><h3>적용 예정</h3></div><div className="import-plan-stats"><span className="new"><b>{newCount}</b><small>새 장면 추가</small></span><span className={mode === 'update' ? 'update' : 'skip'}><b>{existingCount}</b><small>{mode === 'update' ? '기존 장면 병합' : '기존 장면 건너뜀'}</small></span><span><b>{excluded.length}</b><small>선택 제외</small></span></div></section>
}

function ImportSelection({ rows, excluded, existing, toggle, update, selectAll, clearAll }) {
  const selected = rows.length - excluded.length
  return <section className="import-selection"><div className="import-selection-head"><div><span>APPLY ROWS</span><h3>적용할 장면 선택·수정</h3></div><strong>{selected}/{rows.length}</strong></div><div className="import-selection-actions"><button onClick={selectAll}>전체 선택</button><button onClick={clearAll}>전체 해제</button></div><div className="import-selection-list">{rows.map((row, index) => { const checked = !excluded.includes(Number(row.number)); const exists = existing.has(Number(row.number)); return <article className={checked ? 'selected' : ''} key={`${row.number}-${index}`}><label aria-label={`${row.number}. ${row.title} 적용`}><input type="checkbox" checked={checked} onChange={() => toggle(row.number)} /></label><span>{row.number}</span><div><div className="import-edit-title"><input value={row.title} onChange={(event) => update(index, { title: event.target.value })} aria-label={`${row.number}번 장면 제목`} /><em className={exists ? 'existing' : 'new'}>{exists ? '기존' : '신규'}</em></div><input value={row.main || ''} onChange={(event) => update(index, { main: event.target.value })} placeholder="메인 배역" aria-label={`${row.number}번 메인 배역`} /><small>{[row.props?.length && `소품 ${row.props.length}`, row.costumes?.length && `의상 ${row.costumes.length}`, row.cues?.length && `큐 ${row.cues.length}`].filter(Boolean).join(' · ') || '장면 정보만 적용'}</small></div></article> })}</div></section>
}

function buildImportAudit(rows) {
  const people = new Set()
  rows.forEach((row) => [row.main, row.ensemble, row.backstage].filter(Boolean).forEach((value) => String(value).split(/\s*[\/,]\s*/).filter(Boolean).forEach((name) => people.add(normalizeMatch(name)))))
  const props = rows.flatMap((row) => row.props || [])
  const numbers = rows.map((row) => Number(row.number)).filter(Boolean)
  const duplicateCount = numbers.length - new Set(numbers).size
  const missingTitles = rows.filter((row) => !String(row.title || '').trim()).length
  const unassignedProps = props.filter((item) => !String(item.inBy || '').trim() || !String(item.outBy || '').trim()).length
  const emptyCast = rows.filter((row) => !row.main && !row.ensemble && !row.backstage).length
  const warnings = []
  if (duplicateCount) warnings.push(`같은 장면 번호가 ${duplicateCount}개 중복됐어요.`)
  if (missingTitles) warnings.push(`제목이 없는 장면이 ${missingTitles}개 있어요.`)
  if (emptyCast) warnings.push(`등장인물이 비어 있는 장면이 ${emptyCast}개 있어요.`)
  if (unassignedProps) warnings.push(`IN 또는 OUT 담당자가 비어 있는 소품이 ${unassignedProps}개 있어요.`)
  return { scenes: rows.length, people: [...people].filter(Boolean).length, props: props.length, cues: rows.reduce((sum, row) => sum + (row.cues?.length || 0), 0), warnings }
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
function CastPanel({ members, scenes, propItems, form, setForm, showForm, setShowForm, submit, update, remove, toggleScene, importFromScenes, busy }) {
  const [query, setQuery] = useState('')
  const [groupNotice, setGroupNotice] = useState('')
  const [viewMode, setViewMode] = useState('roles')
  const actorCount = new Set(members.map((member) => canonicalActor(member.name)).filter(Boolean)).size
  const roleCount = new Set(members.map((member) => normalizeMatch(member.roleName || '')).filter(Boolean)).size
  const linkedSceneCount = new Set(members.flatMap((member) => member.sceneNumbers || [])).size
  const visible = members.filter((member) => {
    const memberScenes = scenes.filter((scene) => (member.sceneNumbers || []).includes(scene.scene_no)).map((scene) => `${scene.scene_no} ${scene.title}`).join(' ')
    return !normalizeMatch(query) || normalizeMatch(`${member.name} ${member.roleName || ''} ${member.type} ${member.notes || ''} ${memberScenes}`).includes(normalizeMatch(query))
  })
  const roleGroups = visible.reduce((groups, member) => {
    const actor = member.name?.trim() || '이름 미정'
    const key = canonicalActor(actor) || 'unassigned'
    const group = groups.find((item) => item.key === key)
    if (group) {
      group.members.push(member)
      if (!group.aliases.includes(actor)) group.aliases.push(actor)
      if (actor.length < group.role.length) group.role = actor
    } else groups.push({ key, role: actor, aliases: [actor], members: [member] })
    return groups
  }, []).sort((a, b) => a.role === '이름 미정' ? 1 : b.role === '이름 미정' ? -1 : a.role.localeCompare(b.role, 'ko'))
  function regroupRoles() {
    const merged = roleGroups.filter((group) => group.aliases.length > 1).length
    setGroupNotice(merged ? `이름 표기가 비슷한 배우 ${merged}개 그룹을 다시 묶었어요.` : '현재 배우 이름이 가장 깔끔하게 묶여 있어요.')
  }
  return <section className="cast-panel">
    <div className="section-heading"><div><p className="eyebrow">CAST</p><h2>배우</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={18} /> 추가</button></div>
    <section className="cast-summary compact-summary"><article><strong>{actorCount}</strong><span>배우</span></article><article><strong>{roleCount}</strong><span>배역</span></article><article><strong>{linkedSceneCount}</strong><span>연결 장면</span></article></section>
    <div className="cast-view-switch"><button className={viewMode === 'roles' ? 'active' : ''} onClick={() => setViewMode('roles')}><Users size={16} /> 배우별</button><button className={viewMode === 'scenes' ? 'active' : ''} onClick={() => setViewMode('scenes')}><Clapperboard size={16} /> 장면별</button></div>
    <div className="cast-utility-bar"><button disabled={!scenes.length || busy} onClick={importFromScenes}><WandSparkles /><span><b>장면에서 가져오기</b><small>배우·배역 자동 연결</small></span></button>{!!members.length && <button onClick={regroupRoles}><Sparkles /><span><b>이름 정리</b><small>비슷한 배우 묶기</small></span></button>}</div>
    {groupNotice && <p className="notice role-group-notice">{groupNotice}</p>}
    {showForm && <form className="panel form-grid cast-form" onSubmit={submit}><div className="two-col"><input required placeholder="배우 이름" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input placeholder="배역 이름" value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value })} /></div><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>주연</option><option>앙상블</option><option>스태프</option></select><textarea placeholder="더블 캐스팅, 특이사항 등" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /><button className="primary" disabled={busy}>배우 등록</button></form>}
    {!!members.length && <div className="entity-search"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={viewMode === 'roles' ? '배우·배역 검색' : '장면·배우·배역 검색'} /></label><span>{visible.length}/{members.length}명</span></div>}{viewMode === 'roles' ? <div className="cast-role-groups">{!members.length && <Empty icon={<Users />} title="등록된 배우가 없어요" description="배우와 배역을 등록하고 등장 장면을 연결해보세요." action={() => setShowForm(true)} />}{!!members.length && !visible.length && <Empty icon={<Search />} title="검색 결과가 없어요" description="다른 배우 이름이나 배역을 검색해보세요." />}{roleGroups.map((group) => <CastRoleGroup key={group.key} group={group} scenes={scenes} propItems={propItems} update={update} remove={remove} toggleScene={toggleScene} busy={busy} forceOpen={!!query} />)}</div> : <CastSceneGroups scenes={scenes} members={visible} query={query} />}
  </section>
}

function CastSceneGroups({ scenes, members, query }) {
  const [shareStatus, setShareStatus] = useState('')
  const visibleScenes = scenes.filter((scene) => {
    const cast = members.filter((member) => (member.sceneNumbers || []).includes(scene.scene_no))
    const text = `${scene.scene_no} ${scene.title} ${cast.map((member) => `${member.name} ${member.roleName || ''}`).join(' ')}`
    return cast.length && (!normalizeMatch(query) || normalizeMatch(text).includes(normalizeMatch(query)))
  })
  async function shareCallSheet() {
    const text = visibleScenes.map((scene) => {
      const cast = members.filter((member) => (member.sceneNumbers || []).includes(scene.scene_no))
      return `[ACT ${scene.act_no} · ${scene.scene_no}. ${scene.title}]\n${cast.map((member) => `- ${member.roleName || '배역 미정'}: ${member.name}`).join('\n')}`
    }).join('\n\n')
    if (!text) return
    try {
      if (navigator.share) {
        await navigator.share({ title: 'StageFlow 장면별 콜시트', text })
        setShareStatus('콜시트를 공유했어요.')
      } else {
        await navigator.clipboard.writeText(text)
        setShareStatus('콜시트를 클립보드에 복사했어요.')
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setShareStatus('공유하지 못했어요. 다시 시도해주세요.')
    }
  }
  return <div className="cast-scene-groups">{!!visibleScenes.length && <div className="call-sheet-actions"><div><strong>장면별 콜시트</strong><span>{visibleScenes.length}개 장면 · {members.length}명</span></div><button onClick={shareCallSheet}><Upload size={16} /> 공유</button></div>}{shareStatus && <p className="notice call-share-notice">{shareStatus}</p>}{!visibleScenes.length && <Empty icon={<Clapperboard />} title="연결된 등장 장면이 없어요" description="배역별 보기에서 배우의 등장 장면을 선택해주세요." />}{visibleScenes.map((scene) => { const cast = members.filter((member) => (member.sceneNumbers || []).includes(scene.scene_no)); return <article key={scene.id}><div className="cast-scene-title"><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>ACT {scene.act_no} · {cast.length}명 등장</small></div></div><div className="cast-call-list">{cast.map((member) => <div key={member.id}><UserRound /><span><b>{member.roleName || '배역 미정'}</b><small>{member.name}</small></span><em>{member.type}</em></div>)}</div></article> })}</div>
}

function CastRoleGroup({ group, scenes, propItems, update, remove, toggleScene, busy, forceOpen }) {
  const [open, setOpen] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const expanded = forceOpen || open
  const roles = [...new Set(group.members.map((member) => member.roleName || '배역 미정'))]
  const actorCalls = scenes.filter((scene) => group.members.some((member) => (member.sceneNumbers || []).includes(scene.scene_no))).map((scene) => {
    const sceneMembers = group.members.filter((member) => (member.sceneNumbers || []).includes(scene.scene_no))
    return {
      ...scene,
      roles: [...new Set(sceneMembers.map((member) => member.roleName || '배역 미정'))],
      costumes: parseSceneCostumes(scene.summary).filter((item) => sceneMembers.some((member) => assignmentMatches(item.role, member))),
      props: propItems.filter((item) => Number(item.sceneNo) === Number(scene.scene_no) && sceneMembers.some((member) => assignmentMatches(item.inBy, member) || assignmentMatches(item.outBy, member))),
    }
  })
  async function shareActorCall() {
    const lines = actorCalls.map((scene) => [`${scene.scene_no}. ${scene.title} (${scene.roles.join(' · ')})`, scene.costumes.length ? `  의상: ${scene.costumes.map((item) => item.name).join(' · ')}` : '', scene.props.length ? `  소품: ${scene.props.map((item) => item.name).join(' · ')}` : ''].filter(Boolean).join('\n'))
    const text = [`[StageFlow 개인 콜시트]`, `배우: ${group.role}`, `배역: ${roles.join(', ')}`, '', ...lines].join('\n')
    try {
      if (navigator.share) { await navigator.share({ title: `${group.role} 개인 콜시트`, text }); setShareStatus('개인 콜시트를 공유했어요.') }
      else { await navigator.clipboard.writeText(text); setShareStatus('개인 콜시트를 복사했어요.') }
    } catch (error) { if (error?.name !== 'AbortError') setShareStatus('콜시트를 공유하지 못했어요.') }
  }
  return <section className={expanded ? 'cast-role-group open' : 'cast-role-group'}><button className="cast-role-heading" onClick={() => setOpen((value) => !value)} aria-expanded={expanded}><div><span>ACTOR</span><h3>{group.role}</h3>{group.aliases.length > 1 && <small>{group.aliases.join(' · ')}</small>}<p>{roles.join(' · ')}</p></div><strong>{roles.length}배역 <ChevronRight /></strong></button>{expanded && <div className="actor-group-body"><div className="actor-call-preview"><div className="actor-call-preview-head"><span>등장 순서 · 준비물</span><strong>{actorCalls.length}장면</strong></div><div>{actorCalls.map((scene, index) => <article key={scene.id}><i>{index + 1}</i><span><b>{scene.scene_no}. {scene.title}</b><small>{scene.roles.join(' · ')}</small>{!!(scene.costumes.length || scene.props.length) && <span className="actor-call-kit">{scene.costumes.map((item) => <em key={`costume-${item.name}`}><Shirt />{item.name}</em>)}{scene.props.map((item) => <em key={`prop-${item.id}`}><Package />{item.name}</em>)}</span>}</span>{index < actorCalls.length - 1 && <em>{Number(actorCalls[index + 1].scene_no) - Number(scene.scene_no) > 1 ? `${Number(actorCalls[index + 1].scene_no) - Number(scene.scene_no) - 1}장면 대기` : '연속 등장'}</em>}</article>)}</div></div><button className="actor-call-share" onClick={shareActorCall}><Upload /><span><b>개인 콜시트 공유</b><small>등장 장면·의상·소품을 한 번에 정리</small></span></button>{shareStatus && <p>{shareStatus}</p>}<div className="cast-list">{group.members.map((member) => <CastCard key={member.id} member={member} scenes={scenes} update={update} remove={remove} toggleScene={toggleScene} busy={busy} />)}</div></div>}</section>
}

function canonicalActor(name = '') {
  return normalizeMatch(String(name).replace(/[（(][^）)]*[）)]/g, '')) || normalizeMatch(name)
}

function CastCard({ member, scenes, update, remove, toggleScene, busy }) {
  const [editing, setEditing] = useState(false)
  const [editingScenes, setEditingScenes] = useState(false)
  const [sceneSearch, setSceneSearch] = useState('')
  const [draft, setDraft] = useState({ name: member.name, roleName: member.roleName || '', type: member.type, notes: member.notes || '' })
  const selectedScenes = scenes.filter((scene) => (member.sceneNumbers || []).includes(scene.scene_no))
  const filteredScenes = scenes.filter((scene) => !normalizeMatch(sceneSearch) || normalizeMatch(`${scene.scene_no} ${scene.title}`).includes(normalizeMatch(sceneSearch)))
  async function save(event) {
    event.preventDefault()
    if (!draft.name.trim()) return
    if (await update(member.id, draft)) setEditing(false)
  }
  return <article className="cast-card">{editing ? <form className="cast-edit-form" onSubmit={save}><div className="two-col"><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="배우 이름" /><input value={draft.roleName} onChange={(event) => setDraft({ ...draft, roleName: event.target.value })} placeholder="배역" /></div><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}><option>주연</option><option>앙상블</option><option>스태프</option></select><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="특이사항" /><div className="cast-edit-actions"><button type="button" onClick={() => setEditing(false)}>취소</button><button className="primary compact" disabled={busy}><Save size={16} /> 저장</button></div></form> : <><div className="cast-card-head"><div className={`cast-avatar cast-${member.type}`}><UserRound /></div><div><span>{member.type}</span><h3>{member.name}</h3><p>{member.roleName || '배역 미정'}</p></div><button className="icon-button" onClick={() => setEditing(true)} aria-label="배우 정보 수정"><Pencil size={16} /></button><button className="icon-button danger" onClick={() => remove(member.id)} aria-label="배우 삭제"><Trash2 size={17} /></button></div>{member.notes && <p className="cast-notes">{member.notes}</p>}<div className="cast-scenes-head"><strong>등장 장면</strong><button className="scene-edit-toggle" onClick={() => setEditingScenes((value) => !value)}>{editingScenes ? '완료' : '장면 편집'} · {selectedScenes.length}개</button></div>{!editingScenes ? <div className="selected-scene-summary">{selectedScenes.map((scene) => <span key={scene.id}><b>{scene.scene_no}</b>{scene.title}</span>)}{!selectedScenes.length && <small>등록된 등장 장면이 없어요.</small>}</div> : <div className="scene-picker"><label><Search size={15} /><input value={sceneSearch} onChange={(event) => setSceneSearch(event.target.value)} placeholder="장면 번호·제목 검색" /></label><div>{filteredScenes.map((scene) => { const active = (member.sceneNumbers || []).includes(scene.scene_no); return <button className={active ? 'active' : ''} key={scene.id} onClick={() => toggleScene(member.id, scene.scene_no)}><span><b>{scene.scene_no}</b><strong>{scene.title}</strong></span><CheckCircle2 /></button> })}{!filteredScenes.length && <small>검색 결과가 없어요.</small>}</div></div>}</>}</article>
}

function CostumePanel({ scenes, castMembers, updateScene }) {
  const [form, setForm] = useState({ sceneNo: '', role: '', name: '', note: '' })
  const [status, setStatus] = useState('')
  const roles = [...new Set(castMembers.map((member) => member.roleName?.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'))
  const entries = scenes.flatMap((scene) => parseSceneCostumes(scene.summary).map((item, index) => ({ ...item, scene, index })))
  const transitionRoles = [...new Set(entries.map((entry) => entry.role))]
  const transitions = transitionRoles.flatMap((role) => {
    const looks = entries.filter((entry) => normalizeMatch(entry.role) === normalizeMatch(role)).sort((a, b) => Number(a.scene.scene_no) - Number(b.scene.scene_no))
    return looks.slice(1).map((look, index) => {
      const previous = looks[index]
      const gap = Number(look.scene.scene_no) - Number(previous.scene.scene_no)
      return { role, previous, look, gap, urgent: gap <= 1 }
    })
  }).sort((a, b) => Number(a.look.scene.scene_no) - Number(b.look.scene.scene_no))

  async function addCostume(event) {
    event.preventDefault()
    const scene = scenes.find((item) => Number(item.scene_no) === Number(form.sceneNo))
    if (!scene || !form.role.trim() || !form.name.trim()) return
    const line = `- ${form.role.trim()}: ${form.name.trim()}${form.note.trim() ? ` · ${form.note.trim()}` : ''}`
    const summary = appendSummarySection(scene.summary, '의상/체인지:', line)
    await updateScene(scene.id, { ...scene, summary })
    setForm({ sceneNo: '', role: '', name: '', note: '' })
    setStatus('의상 체인지가 저장됐어요.')
  }

  async function removeCostume(entry) {
    if (!window.confirm(`${entry.role}의 ${entry.name} 정보를 삭제할까요?`)) return
    const summary = String(entry.scene.summary || '').split('\n').filter((line) => line.trim() !== entry.rawLine).join('\n').replace(/의상\/체인지:\s*(?=\n(?:\S|$)|$)/g, '').trim()
    await updateScene(entry.scene.id, { ...entry.scene, summary })
  }

  return <section className="costume-panel"><div className="section-heading"><div><p className="eyebrow">COSTUME TRACK</p><h2>의상·퀵체인지</h2></div></div>{!!transitions.length && <QuickChangeBoard transitions={transitions} />}<form className="panel form-grid costume-form" onSubmit={addCostume}><div className="two-col"><select required value={form.sceneNo} onChange={(event) => setForm({ ...form, sceneNo: event.target.value })}><option value="">장면 선택</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select><input required list="costume-roles" placeholder="배역" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /><datalist id="costume-roles">{roles.map((role) => <option key={role} value={role} />)}</datalist></div><input required placeholder="의상명 (예: LOOK 2 빨강 드레스)" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><input placeholder="체인지 위치·도우미·제한시간" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /><button className="primary"><Shirt size={17} /> 의상 저장</button></form>{status && <p className="notice">{status}</p>}<div className="costume-groups">{!entries.length && <Empty icon={<Shirt />} title="등록된 의상이 없어요" description="장면과 배역을 지정하면 공연모드에서 현재·다음 의상으로 표시돼요." />}{scenes.map((scene) => { const items = entries.filter((entry) => entry.scene.id === scene.id); if (!items.length) return null; return <article key={scene.id}><div className="costume-scene-head"><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{items.length}개 의상</small></div></div><div>{items.map((item) => <div className="costume-row" key={`${item.role}-${item.index}`}><Shirt /><div><b>{item.role}</b><strong>{item.name}</strong>{item.note && <small>{item.note}</small>}</div><button className="icon-button danger" onClick={() => removeCostume(item)} aria-label="의상 삭제"><Trash2 size={16} /></button></div>)}</div></article> })}</div></section>
}

function QuickChangeBoard({ transitions }) {
  return <section className="quick-change-board"><div className="quick-change-title"><div><span>QUICK CHANGE MAP</span><strong>체인지 타임라인</strong></div><b>{transitions.filter((item) => item.urgent).length}개 긴급</b></div><div>{transitions.map((item, index) => <article className={item.urgent ? 'urgent' : ''} key={`${item.role}-${item.look.scene.id}-${index}`}><div className="quick-role"><UserRound /><strong>{item.role}</strong><span>{item.urgent ? '즉시 체인지' : `${item.gap}장면 간격`}</span></div><div className="quick-route"><span><small>SCENE {item.previous.scene.scene_no}</small>{item.previous.name}</span><ChevronRight /><span><small>SCENE {item.look.scene.scene_no}</small>{item.look.name}</span></div>{item.look.note && <p>{item.look.note}</p>}</article>)}</div></section>
}

function appendSummarySection(summary = '', heading, line) {
  const text = String(summary || '').trim()
  if (text.includes(heading)) return text.replace(heading, `${heading}\n${line}`)
  return [text, heading, line].filter(Boolean).join('\n')
}

function PropsPanel({ items, scenes, form, setForm, showForm, setShowForm, filter, setFilter, submit, update, remove, toggleReady, importFromScenes, busy }) {
  const [query, setQuery] = useState('')
  const visible = items.filter((item) => (filter === '전체' || (filter === '미준비' && !item.ready) || (filter === '완료' && item.ready) || item.kind === filter) && (!normalizeMatch(query) || normalizeMatch(`${item.name} ${item.inBy || ''} ${item.outBy || ''} ${item.note || ''}`).includes(normalizeMatch(query)))).sort((a, b) => Number(a.ready) - Number(b.ready) || Number(a.sceneNo || 9999) - Number(b.sceneNo || 9999))
  const readyCount = items.filter((item) => item.ready).length
  const sceneTitle = (sceneNo) => scenes.find((scene) => Number(scene.scene_no) === Number(sceneNo))?.title || '장면 미지정'
  const groups = visible.reduce((result, item) => {
    const key = item.sceneNo || 'unassigned'
    const group = result.find((entry) => String(entry.key) === String(key))
    if (group) group.items.push(item)
    else result.push({ key, title: item.sceneNo ? sceneTitle(item.sceneNo) : '장면 미지정', items: [item] })
    return result
  }, [])
  return <section className="props-panel">
    <div className="section-heading"><div><p className="eyebrow">PROPS & SET PIECES</p><h2>소품·대도구</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={18} /> 항목</button></div>
    <section className="prop-summary compact-summary"><article><strong>{items.length - readyCount}</strong><span>미준비</span></article><article><strong>{readyCount}</strong><span>준비 완료</span></article><article><strong>{items.length}</strong><span>전체</span></article></section>
    <button className="props-import-compact" disabled={!scenes.length || busy} onClick={importFromScenes}><WandSparkles /><span><b>장면 자료에서 가져오기</b><small>소품·대도구와 IN/OUT 담당자 자동 연결</small></span><ChevronRight /></button>
    {showForm && <form className="panel form-grid prop-form" onSubmit={submit}><div className="two-col"><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}><option>소품</option><option>대도구</option></select><select value={form.sceneNo} onChange={(event) => setForm({ ...form, sceneNo: event.target.value })}><option value="">장면 미지정</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select></div><input required placeholder="소품 또는 대도구 이름" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><div className="two-col"><input placeholder="In 담당자" value={form.inBy} onChange={(event) => setForm({ ...form, inBy: event.target.value })} /><input placeholder="Out 담당자" value={form.outBy} onChange={(event) => setForm({ ...form, outBy: event.target.value })} /></div><textarea placeholder="배치 위치, 이동 방법, 주의사항" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /><button className="primary" disabled={busy}>항목 저장</button></form>}
    {!!items.length && <div className="entity-search"><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="소품·담당자 검색" /></label><span>{visible.length}/{items.length}개</span></div>}<div className="prop-filters prop-filters-scroll">{['미준비', '전체', '소품', '대도구', '완료'].map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}</div>
    <div className="prop-scene-groups">{!visible.length && <Empty icon={items.length ? <Search /> : <Package />} title={items.length ? '조건에 맞는 항목이 없어요' : '등록된 항목이 없어요'} description={items.length ? '다른 필터나 검색어를 선택해보세요.' : '직접 추가하거나 장면 자동정리 결과에서 한 번에 가져오세요.'} action={items.length ? null : () => setShowForm(true)} />}{groups.map((group) => <section key={group.key}><div className="prop-group-head"><span>{group.key === 'unassigned' ? '—' : group.key}</span><div><strong>{group.title}</strong><small>{group.items.filter((item) => item.ready).length}/{group.items.length} 준비</small></div></div><div className="prop-list">{group.items.map((item) => <PropCard key={item.id} item={item} scenes={scenes} sceneTitle={sceneTitle} update={update} remove={remove} toggleReady={toggleReady} busy={busy} />)}</div></section>)}</div>
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

function CuePanel({ scenes, completed, toggle, updateScene, autoLink, busy }) {
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
  return <section className="cue-panel"><div className="section-heading"><div><p className="eyebrow">CUE SHEET</p><h2>큐시트</h2></div><div className="cue-heading-actions"><span className="cue-progress">{done}/{total} 완료</span><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> 큐</button></div></div><button className="cue-auto-link" disabled={busy || !scenes.length} onClick={autoLink}><WandSparkles /><span><b>{busy ? '큐 연결 중…' : '대본·음악·배역 자동 연결'}</b><small>음악 GO, 배역 등장 준비, 대본 큐사인을 장면별로 합칩니다.</small></span><ChevronRight /></button>{showForm && <form className="panel cue-form" onSubmit={addCue}><div className="two-col"><select required value={form.sceneNo} onChange={(event) => setForm({ ...form, sceneNo: event.target.value })}><option value="">장면 선택</option>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>조명</option><option>음향</option><option>영상</option><option>무대</option><option>마이크</option></select></div><input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="큐 내용 (예: 음악 시작)" /><input value={form.trigger} onChange={(event) => setForm({ ...form, trigger: event.target.value })} placeholder="큐사인 (선택)" /><button className="primary">큐 추가</button></form>}{!groups.length ? <Empty icon={<ListChecks />} title="등록된 큐가 없어요" description="자동 연결을 실행하거나 첫 큐를 직접 등록하세요." action={autoLink} /> : <div className="cue-groups">{groups.map(({ scene, cues }) => <article key={scene.id}><div className="cue-scene-head"><span>{scene.scene_no}</span><div><strong>{scene.title}</strong><small>{cues.length}개 큐</small></div></div><CueList cues={cues} sceneNo={scene.scene_no} completed={completed} toggle={toggle} remove={(cue) => removeCue(scene, cue)} /></article>)}</div>}</section>
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

function stripFileExtension(value = '') {
  return cleanStoredFileName(value).replace(/\.[A-Za-z0-9]{1,8}$/i, '').trim()
}

function cueIdentity(cue) {
  return normalizeMatch(`${cue.type || '무대'} ${cue.label || ''} ${cue.trigger || ''}`)
}

function appendUniqueCueLines(summary = '', cues = []) {
  const text = String(summary || '').trim()
  const existing = new Set(parseSceneCues(text).map(cueIdentity))
  const additions = []
  cues.forEach((cue) => {
    if (!cue?.label) return
    const normalized = { type: String(cue.type || '무대').trim(), label: String(cue.label).trim(), trigger: String(cue.trigger || '').trim() }
    const key = cueIdentity(normalized)
    if (!key || existing.has(key)) return
    existing.add(key)
    additions.push(`- [${normalized.type}] ${normalized.label}${normalized.trigger ? ` · 큐사인 ${normalized.trigger}` : ''}`)
  })
  if (!additions.length) return text
  return [text, text.includes('큐:') ? '' : '큐:', ...additions].filter(Boolean).join('\n')
}

function buildAutoCuesForScene(scene, musicFiles, castMembers) {
  const cues = []
  musicFiles.forEach((file) => cues.push({ type: '음향', label: `${stripFileExtension(file.name)} 재생`, trigger: `${scene.title} 시작` }))
  castMembers.filter((member) => (member.sceneNumbers || []).some((value) => Number(value) === Number(scene.scene_no))).forEach((member) => {
    cues.push({ type: '무대', label: `${member.roleName || member.name} 등장 준비`, trigger: `${scene.title} 진입 전` })
  })
  String(scene.summary || '').split('\n').forEach((rawLine) => {
    const line = rawLine.trim()
    const trigger = line.match(/큐사인\s*[:：]?\s*(.+)$/i)?.[1]?.trim()
    if (trigger && !/^[-·\s]*$/.test(trigger)) cues.push({ type: '무대', label: `${trigger} 실행`, trigger })
    const music = line.match(/^(?:진도\s*:\s*)?음악\s*[:：]?\s*([^·|]+)$/i)?.[1]?.trim()
    if (music && !/^(O|X|없음|미정|-)$/i.test(music)) cues.push({ type: '음향', label: `${music} 재생`, trigger: `${scene.title} 시작` })
  })
  return cues
}

function parseSceneCostumes(summary = '') {
  const lines = String(summary).split('\n')
  const costumes = []
  let inSection = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/^(의상|의상\/체인지)\s*:?$/.test(line)) { inSection = true; continue }
    if (inSection && /^(소품|대도구|큐|조명|음향|영상|음악)\s*[:：]/.test(line)) inSection = false
    if (!inSection) continue
    const match = line.match(/^[-•]\s*([^:：]+)\s*[:：]\s*(.+)$/)
    if (!match) continue
    const parts = match[2].split(/\s*·\s*/)
    costumes.push({ role: match[1].trim(), name: parts[0].trim(), note: parts.slice(1).join(' · '), rawLine: line })
  }
  return costumes
}

function assignmentMatches(value, member) {
  const assignment = normalizeMatch(value || '')
  if (!assignment || !member) return false
  const name = normalizeMatch(member.name)
  const role = normalizeMatch(member.roleName || '')
  return (name && assignment.includes(name)) || (role && assignment.includes(role))
}

function RehearsalPanel({ workspace, production, scenes }) {
  const [sceneNo, setSceneNo] = useState(scenes[0]?.scene_no || '')
  const [startedAt, setStartedAt] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [records, setRecords] = useState([])
  const [status, setStatus] = useState('')
  const path = `${workspace.id}/${production.id}/data/rehearsals.json`

  useEffect(() => {
    let active = true
    supabase.storage.from('stageflow-files').download(path).then(async ({ data }) => {
      if (!active || !data) return
      try {
        const parsed = JSON.parse(await data.text())
        setRecords(Array.isArray(parsed.records) ? parsed.records : [])
      } catch { /* 새 공연은 기록이 없을 수 있어요. */ }
    })
    return () => { active = false }
  }, [path])

  useEffect(() => {
    if (!startedAt) return undefined
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [startedAt])

  async function persist(next) {
    const body = new Blob([JSON.stringify({ records: next, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from('stageflow-files').upload(path, body, { upsert: true, contentType: 'application/json' })
    if (error) {
      setStatus(`기록 저장 실패: ${error.message}`)
      return false
    }
    setRecords(next)
    return true
  }

  function start() {
    if (!sceneNo) return
    setElapsed(0)
    setStartedAt(Date.now())
    setStatus('')
  }

  async function stop() {
    if (!startedAt) return
    const scene = scenes.find((item) => Number(item.scene_no) === Number(sceneNo))
    const duration = Math.max(1, Math.floor((Date.now() - startedAt) / 1000))
    setStartedAt(null)
    setElapsed(duration)
    const record = { id: crypto.randomUUID(), sceneNo: Number(sceneNo), sceneTitle: scene?.title || '장면', duration, createdAt: new Date().toISOString() }
    if (await persist([record, ...records].slice(0, 100))) setStatus(`${record.sceneTitle} 리허설 시간을 저장했어요.`)
  }

  const sceneRecords = records.filter((record) => Number(record.sceneNo) === Number(sceneNo))
  const average = sceneRecords.length ? Math.round(sceneRecords.reduce((sum, record) => sum + record.duration, 0) / sceneRecords.length) : 0
  return <section className="rehearsal-panel"><div className="section-heading"><div><p className="eyebrow">REHEARSAL TIMER</p><h2>리허설</h2></div><span className="rehearsal-count">{records.length}회 기록</span></div>{!scenes.length ? <Empty icon={<Timer />} title="측정할 장면이 없어요" description="장면을 먼저 등록해주세요." /> : <><article className={startedAt ? 'rehearsal-timer running' : 'rehearsal-timer'}><select disabled={!!startedAt} value={sceneNo} onChange={(event) => { setSceneNo(event.target.value); setElapsed(0) }}>{scenes.map((scene) => <option key={scene.id} value={scene.scene_no}>{scene.scene_no}. {scene.title}</option>)}</select><div className="timer-display">{formatDuration(elapsed)}</div><div className="timer-meta"><span>최근 {sceneRecords[0] ? formatDuration(sceneRecords[0].duration) : '-'}</span><span>평균 {average ? formatDuration(average) : '-'}</span></div>{startedAt ? <button className="stop-timer" onClick={stop}><Square fill="currentColor" /> 측정 종료</button> : <button className="primary start-timer" onClick={start}><Play fill="currentColor" /> 측정 시작</button>}</article>{status && <p className="notice">{status}</p>}<div className="rehearsal-history"><div className="compact-heading"><div><span>HISTORY</span><h2>최근 기록</h2></div></div>{records.length ? records.slice(0, 12).map((record) => <article key={record.id}><div><strong>{record.sceneNo}. {record.sceneTitle}</strong><span>{new Date(record.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div><b>{formatDuration(record.duration)}</b></article>) : <p>아직 측정 기록이 없어요.</p>}</div></>}</section>
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

const materialCategories = [
  { id: 'scripts', label: '대본' },
  { id: 'scores', label: '악보' },
  { id: 'videos', label: '영상' },
  { id: 'images', label: '이미지' },
  { id: 'etc', label: '기타' },
]

function MaterialsPanel({ workspace, production }) {
  const [category, setCategory] = useState('scripts')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const base = `${workspace.id}/${production.id}/materials`

  async function loadMaterials() {
    setLoading(true)
    const groups = await Promise.all(materialCategories.map(async (item) => {
      const { data } = await supabase.storage.from('stageflow-files').list(`${base}/${item.id}`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
      return Promise.all((data || []).filter((file) => file.id).map(async (file) => {
        const path = `${base}/${item.id}/${file.name}`
        const { data: signed } = await supabase.storage.from('stageflow-files').createSignedUrl(path, 3600)
        return { ...file, path, category: item.id, categoryLabel: item.label, url: signed?.signedUrl || '' }
      }))
    }))
    setFiles(groups.flat())
    setLoading(false)
  }

  useEffect(() => { loadMaterials() }, [production.id])

  async function uploadMaterials(fileList) {
    const selected = [...fileList]
    if (!selected.length) return
    setLoading(true)
    let uploaded = 0
    for (const file of selected) {
      const path = `${base}/${category}/${safeStorageFileName(file.name)}`
      const { error } = await supabase.storage.from('stageflow-files').upload(path, file, { contentType: file.type || 'application/octet-stream' })
      if (!error) uploaded += 1
      else setStatus(`업로드 실패: ${error.message}`)
    }
    await loadMaterials()
    if (uploaded) setStatus(`${uploaded}개 자료를 업로드했어요.`)
  }

  async function removeMaterial(file) {
    if (!window.confirm(`${cleanStoredFileName(file.name)} 자료를 삭제할까요?`)) return
    setLoading(true)
    const { error } = await supabase.storage.from('stageflow-files').remove([file.path])
    if (error) setStatus(`삭제 실패: ${error.message}`)
    else setStatus('자료를 삭제했어요.')
    await loadMaterials()
  }

  const visible = files.filter((file) => file.category === category)
  return <section className="materials-panel"><div className="section-heading"><div><p className="eyebrow">PRODUCTION FILES</p><h2>자료실</h2></div><span className="material-count">{files.length}개 파일</span></div><div className="material-tabs">{materialCategories.map((item) => <button className={category === item.id ? 'active' : ''} key={item.id} onClick={() => setCategory(item.id)}>{item.label}<span>{files.filter((file) => file.category === item.id).length}</span></button>)}</div><label className="upload-zone material-upload"><Upload /><strong>{loading ? '자료 불러오는 중…' : `${materialCategories.find((item) => item.id === category)?.label} 파일 업로드`}</strong><span>PDF, 이미지, 영상 등 여러 파일을 한꺼번에 선택할 수 있어요.</span><input type="file" multiple disabled={loading} onChange={(event) => uploadMaterials(event.target.files || [])} /></label>{status && <p className="notice">{status}</p>}<div className="material-list">{!loading && !visible.length && <Empty icon={<FileText />} title="등록된 자료가 없어요" description="위 업로드 영역에서 파일을 선택해주세요." />}{visible.map((file) => <article key={file.path}><div className="material-icon"><FileText /></div><div><strong>{cleanStoredFileName(file.name)}</strong><span>{file.categoryLabel} · {formatBytes(file.metadata?.size || 0)}</span></div>{file.url && <a className="icon-button" href={file.url} target="_blank" rel="noreferrer" aria-label={`${cleanStoredFileName(file.name)} 열기`}><Download size={16} /></a>}<button className="icon-button danger" disabled={loading} onClick={() => removeMaterial(file)} aria-label={`${cleanStoredFileName(file.name)} 삭제`}><Trash2 size={16} /></button></article>)}</div></section>
}

function formatBytes(bytes) {
  if (!bytes) return '크기 정보 없음'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function TasksPanel({ workspace, production }) {
  const [tasks, setTasks] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', category: '연출', assignee: '', dueDate: '' })
  const [status, setStatus] = useState('')
  const path = `${workspace.id}/${production.id}/data/tasks.json`

  useEffect(() => {
    supabase.storage.from('stageflow-files').download(path).then(async ({ data }) => {
      if (!data) return
      try {
        const parsed = JSON.parse(await data.text())
        setTasks(Array.isArray(parsed.tasks) ? parsed.tasks : [])
      } catch { /* 새 공연은 할 일이 없을 수 있어요. */ }
    })
  }, [path])

  async function persist(next, message) {
    const body = new Blob([JSON.stringify({ tasks: next, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from('stageflow-files').upload(path, body, { upsert: true, contentType: 'application/json' })
    if (error) {
      setStatus(`저장 실패: ${error.message}`)
      return false
    }
    setTasks(next)
    setStatus(message)
    return true
  }

  async function addTask(event) {
    event.preventDefault()
    if (!form.title.trim()) return
    const task = { id: crypto.randomUUID(), ...form, title: form.title.trim(), assignee: form.assignee.trim(), done: false, createdAt: new Date().toISOString() }
    if (await persist([...tasks, task], '할 일을 추가했어요.')) {
      setForm({ title: '', category: form.category, assignee: '', dueDate: '' })
      setShowForm(false)
    }
  }

  const toggleTask = (id) => persist(tasks.map((task) => task.id === id ? { ...task, done: !task.done } : task), '진행 상태를 변경했어요.')
  const updateTask = (id, values) => persist(tasks.map((task) => task.id === id ? { ...task, ...values, title: values.title.trim(), assignee: values.assignee.trim() } : task), '할 일을 수정했어요.')
  const removeTask = (id) => {
    if (window.confirm('이 할 일을 삭제할까요?')) persist(tasks.filter((task) => task.id !== id), '할 일을 삭제했어요.')
  }
  const ordered = [...tasks].sort((a, b) => Number(a.done) - Number(b.done) || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
  const done = tasks.filter((task) => task.done).length
  return <section className="tasks-panel"><div className="section-heading"><div><p className="eyebrow">PRODUCTION CHECKLIST</p><h2>공연 준비 할 일</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> 할 일</button></div><section className="task-summary"><article><strong>{tasks.length - done}</strong><span>남은 일</span></article><article><strong>{done}</strong><span>완료</span></article><article><strong>{tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</strong><span>완료율</span></article></section>{showForm && <form className="panel task-form" onSubmit={addTask}><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="해야 할 일" /><div className="two-col"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>연출</option><option>배우</option><option>음악</option><option>의상</option><option>소품</option><option>무대</option><option>홍보</option><option>기타</option></select><input value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} placeholder="담당자" /></div><input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /><button className="primary">저장</button></form>}{status && <p className="notice">{status}</p>}<div className="task-list">{!ordered.length && <Empty icon={<CheckCircle2 />} title="등록된 할 일이 없어요" description="공연 준비 업무를 등록하고 팀과 진행상황을 공유하세요." action={() => setShowForm(true)} />}{ordered.map((task) => <TaskCard key={task.id} task={task} toggle={toggleTask} update={updateTask} remove={removeTask} />)}</div></section>
}

function TaskCard({ task, toggle, update, remove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: task.title, category: task.category, assignee: task.assignee || '', dueDate: task.dueDate || '' })
  async function save(event) {
    event.preventDefault()
    if (!draft.title.trim()) return
    if (await update(task.id, draft)) setEditing(false)
  }
  if (editing) return <article className="task-card task-card-edit"><form onSubmit={save}><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="해야 할 일" /><div className="two-col"><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>연출</option><option>배우</option><option>음악</option><option>의상</option><option>소품</option><option>무대</option><option>홍보</option><option>기타</option></select><input value={draft.assignee} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })} placeholder="담당자" /></div><input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /><div className="task-edit-actions"><button type="button" onClick={() => setEditing(false)}>취소</button><button className="primary compact"><Save size={16} /> 저장</button></div></form></article>
  return <article className={task.done ? 'task-card done' : 'task-card'}><button className="task-check" onClick={() => toggle(task.id)} aria-label="완료 상태 변경"><CheckCircle2 /></button><div><div><span>{task.category}</span>{task.dueDate && <small>{formatTaskDue(task.dueDate)}</small>}</div><strong>{task.title}</strong><p>{task.assignee ? `담당 ${task.assignee}` : '담당자 미정'}</p></div><button className="icon-button" onClick={() => setEditing(true)} aria-label="할 일 수정"><Pencil size={15} /></button><button className="icon-button danger" onClick={() => remove(task.id)} aria-label="할 일 삭제"><Trash2 size={16} /></button></article>
}

function formatTaskDue(date) {
  const days = Math.ceil((new Date(`${date}T23:59:59`) - new Date()) / 86400000)
  if (days < 0) return `${Math.abs(days)}일 지남`
  if (days === 0) return '오늘 마감'
  return `D-${days}`
}

function SchedulePanel({ workspace, production }) {
  const [events, setEvents] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: '연습', date: '', time: '', location: '', note: '' })
  const [status, setStatus] = useState('')
  const path = `${workspace.id}/${production.id}/data/schedule.json`

  useEffect(() => {
    supabase.storage.from('stageflow-files').download(path).then(async ({ data }) => {
      if (!data) return
      try {
        const parsed = JSON.parse(await data.text())
        setEvents(Array.isArray(parsed.events) ? parsed.events : [])
      } catch { /* 새 공연은 일정이 없을 수 있어요. */ }
    })
  }, [path])

  async function persist(next, message) {
    const body = new Blob([JSON.stringify({ events: next, updatedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' })
    const { error } = await supabase.storage.from('stageflow-files').upload(path, body, { upsert: true, contentType: 'application/json' })
    if (error) {
      setStatus(`저장 실패: ${error.message}`)
      return false
    }
    setEvents(next)
    setStatus(message)
    return true
  }

  async function addEvent(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.date) return
    const item = { id: crypto.randomUUID(), ...form, title: form.title.trim(), location: form.location.trim(), note: form.note.trim(), createdAt: new Date().toISOString() }
    if (await persist([...events, item], '일정을 추가했어요.')) {
      setForm({ title: '', type: form.type, date: '', time: '', location: '', note: '' })
      setShowForm(false)
    }
  }

  const removeEvent = (id) => {
    if (window.confirm('이 일정을 삭제할까요?')) persist(events.filter((item) => item.id !== id), '일정을 삭제했어요.')
  }
  const ordered = [...events].sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`))
  const now = new Date().toISOString().slice(0, 10)
  const upcoming = ordered.filter((item) => item.date >= now)
  const past = ordered.filter((item) => item.date < now).reverse()
  return <section className="schedule-panel"><div className="section-heading"><div><p className="eyebrow">PRODUCTION CALENDAR</p><h2>일정</h2></div><button className="primary compact" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> 일정</button></div>{showForm && <form className="panel schedule-form" onSubmit={addEvent}><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="일정 제목" /><div className="two-col"><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>연습</option><option>리허설</option><option>공연</option><option>회의</option><option>기타</option></select><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="장소" /></div><div className="two-col"><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /><input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} /></div><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="준비물, 참여 인원, 메모" /><button className="primary">저장</button></form>}{status && <p className="notice">{status}</p>}<ScheduleGroup title="다가오는 일정" events={upcoming} remove={removeEvent} empty="예정된 일정이 없어요." /><ScheduleGroup title="지난 일정" events={past.slice(0, 10)} remove={removeEvent} empty="지난 일정이 없어요." /></section>
}

function ScheduleGroup({ title, events, remove, empty }) {
  return <section className="schedule-group"><div className="compact-heading"><div><span>SCHEDULE</span><h2>{title}</h2></div><small>{events.length}개</small></div>{events.length ? <div className="schedule-list">{events.map((item) => <article key={item.id}><div className="schedule-date"><strong>{new Date(`${item.date}T00:00:00`).getDate()}</strong><span>{new Date(`${item.date}T00:00:00`).toLocaleDateString('ko-KR', { month: 'short' })}</span></div><div><span>{item.type}</span><strong>{item.title}</strong><p>{[item.time, item.location].filter(Boolean).join(' · ') || '시간·장소 미정'}</p>{item.note && <small>{item.note}</small>}</div><button className="icon-button danger" onClick={() => remove(item.id)} aria-label="일정 삭제"><Trash2 size={16} /></button></article>)}</div> : <p className="schedule-empty">{empty}</p>}</section>
}
function Empty({ icon, title, description, action }) { return <div className="empty">{icon}<strong>{title}</strong><span>{description}</span>{action && <button className="primary compact" onClick={action}><Plus size={17} /> 추가하기</button>}</div> }
function BrandMark({ icon }) { return <div className="brand-mark">{icon}</div> }
function Loading() { return <div className="center"><div className="spinner" /><span>StageFlow 불러오는 중…</span></div> }

function splitCells(value) {
  const delimiter = value.includes('\t') ? /\t+/ : value.includes('|') ? /\s*\|\s*/ : / {2,}|,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/
  return value.split(delimiter).map((cell) => cell.trim().replace(/^\"|\"$/g, '')).filter(Boolean)
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
  const structuredRows = parseStructuredProductionTable(source)
  if (structuredRows.length) return structuredRows
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

function parseStructuredProductionTable(source) {
  if (!source.includes('\t') && !source.includes('|')) return []
  const rows = new Map()
  const pendingCastLinks = []
  let current = null
  let columns = null
  const lines = source.replace(/\r/g, '').split('\n')

  const clean = (value) => String(value || '').replace(/^"|"$/g, '').replace(/\s+/g, ' ').trim()
  const split = (line) => (line.includes('\t') ? line.split('\t') : line.split('|')).map(clean)
  const put = (row, key, value) => {
    const next = clean(value)
    if (!next || /^(없음|없음\?|미정|-|x)$/i.test(next)) return
    if (!row[key]) row[key] = next
    else if (!normalizeMatch(row[key]).includes(normalizeMatch(next))) row[key] += ` / ${next}`
  }
  const headerMap = (cells) => {
    const result = {}
    cells.forEach((cell, index) => {
      const label = normalizeMatch(cell)
      if (/^(번호|순번|no)$/.test(label)) result.number = index
      else if (/^(배우|배우명|이름|성명|actor)$/.test(label)) result.actor = index
      else if (/^(배역|배역명|역할|캐릭터|role)$/.test(label)) result.role = index
      else if (/(등장|참여|출연).*(장면|넘버|곡)|^(장면번호|넘버번호|songno|sceneno)$/.test(label)) result.sceneRefs = index
      else if (/^(넘버|장면|곡명|제목|number)$/.test(label)) result.title = index
      else if (/메인배역|주요배역|주연/.test(label)) result.main = index
      else if (/등장앙상블|등장인물|출연앙상블/.test(label)) result.ensemble = index
      else if (/백앙상블|대기앙상블/.test(label)) result.backstage = index
      else if (/^(음악|mr|ar)$/.test(label)) result.music = index
      else if (/동선|안무/.test(label)) result.movement = index
      else if (/진도|현황|상태/.test(label)) result.status = index
      else if (/^(큐종류|큐타입|큐구분|파트)$/.test(label)) result.cueType = index
      else if (/^(큐|큐내용|큐명|큐설명|내용)$/.test(label)) result.cueLabel = index
      else if (/큐사인|큐시점|트리거|실행시점|go사인/.test(label)) result.cueTrigger = index
      else if (/^(의상|의상명|착장|룩|look)$/.test(label)) result.costume = index
      else if (/의상배역|캐릭터명|착용배역/.test(label)) result.costumeRole = index
      else if (/체인지|환복|갈아입|변경시점/.test(label)) result.changeNote = index
      else if (/^(구분|종류|분류)$/.test(label)) result.kind = index
      else if (/소품명|대도구명|품목명|물품명/.test(label)) result.propName = index
      else if (/^in$|반입|등장/.test(label)) result.inBy = index
      else if (/^out$|반출|퇴장/.test(label)) result.outBy = index
      else if (/비고|메모|참고/.test(label)) result.note = index
    })
    if (result.cueLabel !== undefined && result.kind !== undefined && result.propName === undefined) {
      result.cueType = result.kind
      delete result.kind
    }
    return Object.keys(result).length >= 2 ? result : null
  }
  const sceneLead = (cells, map) => {
    if (map?.number !== undefined) {
      const number = Number(clean(cells[map.number]).match(/\d{1,3}/)?.[0])
      const title = clean(cells[map.title])
      if (number) return { number, title }
    }
    if (map?.title !== undefined) {
      const reference = clean(cells[map.title])
      const combined = reference.match(/^(\d{1,3})\s*[.)-]\s*(.+)$/)
      if (combined) return { number: Number(combined[1]), title: clean(combined[2]) }
      if (/^\d{1,3}$/.test(reference)) return null
    }
    for (let index = 0; index < Math.min(3, cells.length); index += 1) {
      const match = clean(cells[index]).match(/^(\d{1,3})\s*[.)-]?\s*(.*)$/)
      if (match) {
        const trailing = clean(match[2])
        const title = trailing || clean(cells[index + 1])
        if (title && !/^(o|x)$/i.test(title)) return { number: Number(match[1]), title }
      }
    }
    return null
  }

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue
    const cells = split(rawLine)
    const detectedHeader = headerMap(cells)
    if (detectedHeader) { columns = detectedHeader; continue }
    if (columns?.sceneRefs !== undefined && (columns.actor !== undefined || columns.role !== undefined)) {
      const actor = clean(cells[columns.actor])
      const role = clean(cells[columns.role])
      const refs = clean(cells[columns.sceneRefs]).split(/\s*[,/·|]\s*|\s+(?=\d)/).filter(Boolean)
      refs.forEach((ref) => pendingCastLinks.push({ ref, actor, role }))
      continue
    }
    let lead = sceneLead(cells, columns)
    if (!lead && columns?.title !== undefined) {
      const reference = clean(cells[columns.title])
      const referenceNumber = Number(reference.match(/^\d{1,3}/)?.[0])
      const byNumber = referenceNumber ? rows.get(referenceNumber) : null
      const normalizedReference = normalizeMatch(reference.replace(/^\d{1,3}\s*[.)-]?\s*/, ''))
      const byTitle = [...rows.values()].find((row) => {
        const normalizedTitle = normalizeMatch(row.title)
        return normalizedReference && (normalizedTitle === normalizedReference || normalizedTitle.includes(normalizedReference) || normalizedReference.includes(normalizedTitle))
      })
      const matched = byNumber || byTitle
      if (matched) lead = { number: matched.number, title: matched.title }
    }
    if (lead) {
      current = rows.get(lead.number) || { number: lead.number, title: lead.title, main: '', ensemble: '', backstage: '', music: '', movement: '', status: '', props: [], costumes: [], cues: [] }
      if (lead.title) current.title = lead.title
      rows.set(lead.number, current)
    }
    if (!current) continue
    const map = columns || {}
    const offset = lead ? cells.findIndex((cell) => /^(\d{1,3})(?:\s*[.)-]|$)/.test(cell)) + 1 : 0
    put(current, 'main', map.main !== undefined ? cells[map.main] : columns ? '' : cells[offset])
    put(current, 'ensemble', map.ensemble !== undefined ? cells[map.ensemble] : columns ? '' : cells[offset + 1])
    put(current, 'backstage', map.backstage !== undefined ? cells[map.backstage] : columns ? '' : cells[offset + 2])
    put(current, 'music', map.music !== undefined ? cells[map.music] : '')
    put(current, 'movement', map.movement !== undefined ? cells[map.movement] : '')
    put(current, 'status', map.status !== undefined ? cells[map.status] : '')

    const cueLabel = map.cueLabel !== undefined ? clean(cells[map.cueLabel]) : ''
    const cueTrigger = map.cueTrigger !== undefined ? clean(cells[map.cueTrigger]) : ''
    const cueType = map.cueType !== undefined ? clean(cells[map.cueType]) : '무대'
    if (cueLabel || cueTrigger) {
      const cue = { type: cueType || '무대', label: cueLabel || cueTrigger, trigger: cueTrigger }
      if (!current.cues.some((item) => normalizeMatch(`${item.type}${item.label}${item.trigger}`) === normalizeMatch(`${cue.type}${cue.label}${cue.trigger}`))) current.cues.push(cue)
    }

    const costumeName = map.costume !== undefined ? clean(cells[map.costume]) : ''
    if (costumeName && !/^(없음|미정|-)$/.test(costumeName)) {
      const costume = { character: map.costumeRole !== undefined ? clean(cells[map.costumeRole]) : map.role !== undefined ? clean(cells[map.role]) : '', name: costumeName, changeNote: map.changeNote !== undefined ? clean(cells[map.changeNote]) : '' }
      if (!current.costumes.some((item) => normalizeMatch(`${item.character}${item.name}`) === normalizeMatch(`${costume.character}${costume.name}`))) current.costumes.push(costume)
    }

    let kind = map.kind !== undefined ? clean(cells[map.kind]) : ''
    let name = map.propName !== undefined ? clean(cells[map.propName]) : ''
    if (!name) {
      const kindIndex = cells.findIndex((cell) => /^(소품|대도구)$/.test(clean(cell)))
      if (kindIndex >= 0) { kind = clean(cells[kindIndex]); name = clean(cells[kindIndex + 1]) }
    }
    if (name && !/^(없음|미정|-)$/.test(name)) {
      const item = {
        kind: kind === '대도구' ? '대도구' : '소품',
        name,
        inBy: map.inBy !== undefined ? clean(cells[map.inBy]) : '',
        outBy: map.outBy !== undefined ? clean(cells[map.outBy]) : '',
        note: map.note !== undefined ? clean(cells[map.note]) : '',
      }
      if (!current.props.some((prop) => normalizeMatch(prop.name) === normalizeMatch(item.name) && prop.kind === item.kind)) current.props.push(item)
    }
  }
  const resolvedRows = [...rows.values()]
  pendingCastLinks.forEach((link) => {
    const number = Number(link.ref.match(/\d{1,3}/)?.[0])
    const normalizedRef = normalizeMatch(link.ref.replace(/^\d{1,3}\s*[.)-]?\s*/, ''))
    const target = (number && rows.get(number)) || resolvedRows.find((row) => {
      const title = normalizeMatch(row.title)
      return normalizedRef && (title === normalizedRef || title.includes(normalizedRef) || normalizedRef.includes(title))
    })
    if (!target) return
    const castLabel = link.role && link.actor && normalizeMatch(link.role) !== normalizeMatch(link.actor) ? `${link.role} (${link.actor})` : link.role || link.actor
    if (castLabel) put(target, 'main', castLabel)
  })
  return resolvedRows.filter((row) => row.number && row.title).sort((a, b) => a.number - b.number)
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

function formatSceneSummarySelected(row, targets) {
  return formatSceneSummary({
    ...row,
    main: targets.scenes || targets.cast ? row.main : '',
    ensemble: targets.scenes || targets.cast ? row.ensemble : '',
    backstage: targets.scenes || targets.cast ? row.backstage : '',
    music: targets.scenes ? row.music : '', movement: targets.scenes ? row.movement : '', status: targets.scenes ? row.status : '',
    props: targets.props ? (row.props || []) : [], costumes: targets.costumes ? (row.costumes || []) : [], cues: targets.cues ? (row.cues || []) : [],
  })
}

function mergeSummaryLines(existing = '', incoming = '') {
  const lines = String(existing || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const keys = new Set(lines.map(normalizeMatch))
  String(incoming || '').split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const key = normalizeMatch(line)
    if (key && !keys.has(key)) { lines.push(line); keys.add(key) }
  })
  return lines.join('\n')
}
