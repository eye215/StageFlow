import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, ChevronLeft, Clapperboard, Home, LogOut, MapPin,
  Play, Plus, Settings, Sparkles, Theater, Trash2, Users,
} from 'lucide-react'
import { supabase } from './supabase'
import './auth.css'

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
    setProductionTab('overview')
    setShowIndex(0)
  }, [selected])

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
    else setProductions(data || [])
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

  const progress = useMemo(() => Math.min(100, scenes.length * 10), [scenes])
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
    />
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-inline"><Theater size={24} /><strong>StageFlow</strong></div>
        <button className="avatar" onClick={() => supabase.auth.signOut()} aria-label="로그아웃">
          {session.user.email?.[0]?.toUpperCase() || 'U'}
        </button>
      </header>
      <main className="content">
        <section className="welcome-block">
          <p className="eyebrow">WELCOME BACK</p><h1>오늘도 무대를 완성해봐요.</h1>
          <p>{workspace.name}의 공연 준비 현황입니다.</p>
        </section>
        <section className="today-card"><div><span>오늘의 StageFlow</span><h3>{productions.length ? `${productions.length}개 공연을 준비 중이에요` : '첫 공연을 만들어보세요'}</h3></div><Sparkles /></section>
        <div className="section-heading"><div><p className="eyebrow">PRODUCTIONS</p><h2>내 공연</h2></div><button className="primary compact" onClick={() => setShowProductionForm((v) => !v)}><Plus size={18} /> 공연</button></div>
        {showProductionForm && <ProductionForm form={productionForm} setForm={setProductionForm} submit={createProduction} busy={busy} />}
        <section className="production-grid">
          {!productions.length && <Empty icon={<CalendarDays />} title="아직 공연이 없어요" description="첫 공연을 만들고 준비를 시작해보세요." />}
          {productions.map((item, index) => <ProductionCard key={item.id} item={item} index={index} open={() => setSelected(item)} remove={() => deleteProduction(item.id)} />)}
        </section>
        {notice && <p className="notice">{notice}</p>}
      </main>
      <nav className="bottom-nav"><button className="active"><Home /><span>홈</span></button><button><Theater /><span>공연</span></button><button><Users /><span>팀</span></button><button><Settings /><span>설정</span></button></nav>
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

function ProductionView(props) {
  const { workspace, production, scenes, tab, setTab, goBack, daysLeft, progress, showIndex, setShowIndex, form, setForm, createScene, deleteScene, showForm, setShowForm, notice, busy } = props
  const current = scenes[showIndex]
  const next = scenes[showIndex + 1]
  return <div className="app-shell">
    <header className="topbar"><button className="icon-button" onClick={goBack}><ChevronLeft /></button><div className="topbar-title"><span>{workspace.name}</span><strong>{production.title}</strong></div><span className="header-spacer" /></header>
    <main className="content production-content">
      <section className="production-cover"><div className="cover-glow" /><div className="cover-copy"><span className="status">준비 중</span><h1>{production.title}</h1><p><MapPin size={15} /> {production.venue || '공연 장소 미정'}</p><div className="cover-meta"><span>{production.performance_start_date || '공연일 미정'}</span>{daysLeft !== null && <strong>{daysLeft >= 0 ? `D-${daysLeft}` : '공연 종료'}</strong>}</div></div></section>
      <nav className="segmented"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>개요</button><button className={tab === 'scenes' ? 'active' : ''} onClick={() => setTab('scenes')}>장면</button><button className={tab === 'show' ? 'active' : ''} onClick={() => setTab('show')}>공연모드</button></nav>
      {tab === 'overview' && <><section className="metric-grid"><article className="metric-card"><span>준비도</span><strong>{progress}%</strong><div className="progress"><i style={{ width: `${progress}%` }} /></div></article><article className="metric-card"><span>등록 장면</span><strong>{scenes.length}</strong><small>Scenes</small></article></section><section className="quick-grid"><button onClick={() => setTab('scenes')}><Clapperboard /><span>장면 관리</span><small>{scenes.length}개</small></button><button><Users /><span>배우·배역</span><small>다음 버전</small></button><button onClick={() => setTab('show')}><Play /><span>공연 모드</span><small>GO 큐</small></button><button><Settings /><span>공연 설정</span><small>정보 관리</small></button></section></>}
      {tab === 'scenes' && <><div className="section-heading"><div><p className="eyebrow">SCENES</p><h2>장면 관리</h2></div><button className="primary compact" onClick={() => setShowForm((v) => !v)}><Plus size={18} /> 장면</button></div>{showForm && <SceneForm form={form} setForm={setForm} submit={createScene} busy={busy} />}<section className="scene-list">{!scenes.length && <Empty icon={<Clapperboard />} title="아직 장면이 없어요" description="첫 장면을 등록해 공연 흐름을 만들어보세요." action={() => setShowForm(true)} />}{scenes.map((scene) => <SceneCard key={scene.id} scene={scene} remove={() => deleteScene(scene.id)} />)}</section></>}
      {tab === 'show' && <section className="show-mode">{!current ? <Empty icon={<Play />} title="진행할 장면이 없어요" description="장면을 먼저 등록해주세요." action={() => setTab('scenes')} /> : <><div className="show-head"><span>NOW PLAYING</span><strong>{showIndex + 1} / {scenes.length}</strong></div><article className="current-scene"><p>ACT {current.act_no} · SCENE {current.scene_no}</p><h2>{current.title}</h2><span>{current.summary || '등록된 장면 설명이 없습니다.'}</span></article><article className="next-cue"><span>NEXT</span><strong>{next ? next.title : 'Curtain Call'}</strong></article><div className="show-actions"><button disabled={!showIndex} onClick={() => setShowIndex((i) => Math.max(0, i - 1))}>이전</button><button className="go-button" disabled={!next} onClick={() => setShowIndex((i) => Math.min(scenes.length - 1, i + 1))}>GO <Play fill="currentColor" /></button></div></>}</section>}
      {notice && <p className="notice">{notice}</p>}
    </main>
  </div>
}

function ProductionForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="공연명" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><input placeholder="공연 장소" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /><input type="date" value={form.performance_start_date} onChange={(e) => setForm({ ...form, performance_start_date: e.target.value })} /><button className="primary" disabled={busy}>공연 만들기</button></form> }
function SceneForm({ form, setForm, submit, busy }) { return <form className="panel form-grid" onSubmit={submit}><input required placeholder="장면 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><div className="two-col"><input type="number" min="1" value={form.act_no} onChange={(e) => setForm({ ...form, act_no: Number(e.target.value) })} /><input type="number" min="0" step="0.1" value={form.scene_no} onChange={(e) => setForm({ ...form, scene_no: Number(e.target.value) })} /></div><textarea placeholder="장면 설명" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /><button className="primary" disabled={busy}>장면 저장</button></form> }
function ProductionCard({ item, index, open, remove }) { return <article className="production-card" onClick={open}><div className={`poster poster-${index % 3}`}><Theater size={38} /></div><div className="production-info"><div className="card-top"><span className="status">준비 중</span><button className="icon-button danger" onClick={(e) => { e.stopPropagation(); remove() }} aria-label="공연 삭제"><Trash2 size={17} /></button></div><h3>{item.title}</h3><p>{item.venue || '장소 미정'}</p><small>{item.performance_start_date || '공연일 미정'}</small></div></article> }
function SceneCard({ scene, remove }) { return <article className="scene-card"><div className="scene-index">{scene.scene_no}</div><div className="scene-copy"><span>ACT {scene.act_no}</span><h3>{scene.title}</h3><p>{scene.summary || '설명 없음'}</p></div><button className="icon-button danger" onClick={remove} aria-label="장면 삭제"><Trash2 size={18} /></button></article> }
function Empty({ icon, title, description, action }) { return <div className="empty">{icon}<strong>{title}</strong><span>{description}</span>{action && <button className="primary compact" onClick={action}><Plus size={17} /> 추가하기</button>}</div> }
function BrandMark({ icon }) { return <div className="brand-mark">{icon}</div> }
function Loading() { return <div className="center"><div className="spinner" /><span>StageFlow 불러오는 중…</span></div> }
