import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, LogOut, Plus, Sparkles, Theater, Trash2 } from 'lucide-react'
import { supabase } from './supabase'

const emptyProduction = { title: '', venue: '', performance_start_date: '' }
const emptyScene = { title: '', act_no: 1, scene_no: 1, summary: '' }

export default function App() {
  const [session, setSession] = useState(null)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [workspace, setWorkspace] = useState(null)
  const [workspaceName, setWorkspaceName] = useState('')
  const [productions, setProductions] = useState([])
  const [productionForm, setProductionForm] = useState(emptyProduction)
  const [selected, setSelected] = useState(null)
  const [scenes, setScenes] = useState([])
  const [sceneForm, setSceneForm] = useState(emptyScene)
  const [showProductionForm, setShowProductionForm] = useState(false)
  const [showSceneForm, setShowSceneForm] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
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
    if (selected) loadScenes(selected.id)
  }, [selected])

  async function sendMagicLink(e) {
    e.preventDefault()
    setMessage('로그인 링크를 보내는 중…')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setMessage(error ? error.message : '메일함에서 StageFlow 로그인 링크를 눌러주세요.')
  }

  async function loadWorkspace() {
    setLoading(true)
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', session.user.id)
      .limit(1)
    const current = memberships?.[0]?.workspaces || null
    setWorkspace(current)
    if (current) await loadProductions(current.id)
    setLoading(false)
  }

  async function createWorkspace(e) {
    e.preventDefault()
    if (!workspaceName.trim()) return
    const { data, error } = await supabase.rpc('create_workspace', { workspace_name: workspaceName.trim() })
    if (error) return setMessage(error.message)
    setWorkspaceName('')
    await loadWorkspace()
    setMessage(data ? '팀 작업공간을 만들었어요.' : '')
  }

  async function loadProductions(workspaceId) {
    const { data, error } = await supabase
      .from('productions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (!error) setProductions(data || [])
  }

  async function createProduction(e) {
    e.preventDefault()
    const { error } = await supabase.from('productions').insert({
      ...productionForm,
      workspace_id: workspace.id,
      created_by: session.user.id,
      performance_start_date: productionForm.performance_start_date || null,
    })
    if (error) return setMessage(error.message)
    setProductionForm(emptyProduction)
    setShowProductionForm(false)
    await loadProductions(workspace.id)
  }

  async function deleteProduction(id) {
    if (!confirm('이 공연과 연결된 장면을 모두 삭제할까요?')) return
    await supabase.from('productions').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    await loadProductions(workspace.id)
  }

  async function loadScenes(productionId) {
    const { data } = await supabase
      .from('scenes')
      .select('*')
      .eq('production_id', productionId)
      .order('sort_order')
      .order('scene_no')
    setScenes(data || [])
  }

  async function createScene(e) {
    e.preventDefault()
    const { error } = await supabase.from('scenes').insert({
      ...sceneForm,
      production_id: selected.id,
      sort_order: scenes.length,
    })
    if (error) return setMessage(error.message)
    setSceneForm({ ...emptyScene, scene_no: scenes.length + 1 })
    setShowSceneForm(false)
    await loadScenes(selected.id)
  }

  async function deleteScene(id) {
    await supabase.from('scenes').delete().eq('id', id)
    await loadScenes(selected.id)
  }

  const progress = useMemo(() => {
    if (!selected) return 0
    return Math.min(100, scenes.length * 10)
  }, [selected, scenes])

  if (loading) return <div className="center"><div className="spinner" /></div>

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark"><Theater size={34} /></div>
          <p className="eyebrow">MUSICAL PRODUCTION OS</p>
          <h1>StageFlow</h1>
          <p className="muted">장면, 배우, 의상, 소품과 큐를 한곳에서 관리하세요.</p>
          <form onSubmit={sendMagicLink} className="stack">
            <label>이메일</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            <button className="primary" type="submit">로그인 링크 받기</button>
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    )
  }

  if (!workspace) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark"><Sparkles size={32} /></div>
          <h1>첫 팀을 만들어볼까요?</h1>
          <p className="muted">공연팀 이름을 입력하면 바로 시작할 수 있어요.</p>
          <form onSubmit={createWorkspace} className="stack">
            <label>팀 이름</label>
            <input required value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="예: 잭더리퍼 2026" />
            <button className="primary">팀 만들기</button>
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    )
  }

  if (selected) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <button className="icon-button" onClick={() => setSelected(null)}><ChevronLeft /></button>
          <div className="topbar-title"><span>{workspace.name}</span><strong>{selected.title}</strong></div>
          <button className="icon-button" onClick={() => supabase.auth.signOut()}><LogOut /></button>
        </header>

        <main className="content">
          <section className="hero production-hero">
            <p className="eyebrow">PRODUCTION</p>
            <h1>{selected.title}</h1>
            <p>{selected.venue || '공연 장소 미정'} · {selected.performance_start_date || '공연일 미정'}</p>
            <div className="progress"><span style={{ width: `${progress}%` }} /></div>
            <small>준비도 {progress}% · 등록 장면 {scenes.length}개</small>
          </section>

          <div className="section-heading">
            <div><p className="eyebrow">SCENES</p><h2>장면 관리</h2></div>
            <button className="primary compact" onClick={() => setShowSceneForm(v => !v)}><Plus size={18} /> 장면</button>
          </div>

          {showSceneForm && (
            <form className="panel form-grid" onSubmit={createScene}>
              <input required placeholder="장면 제목" value={sceneForm.title} onChange={e => setSceneForm({ ...sceneForm, title: e.target.value })} />
              <div className="two-col">
                <input type="number" min="1" value={sceneForm.act_no} onChange={e => setSceneForm({ ...sceneForm, act_no: Number(e.target.value) })} placeholder="Act" />
                <input type="number" min="0" step="0.1" value={sceneForm.scene_no} onChange={e => setSceneForm({ ...sceneForm, scene_no: Number(e.target.value) })} placeholder="Scene" />
              </div>
              <textarea placeholder="장면 설명" value={sceneForm.summary} onChange={e => setSceneForm({ ...sceneForm, summary: e.target.value })} />
              <button className="primary">저장</button>
            </form>
          )}

          <section className="scene-list">
            {scenes.length === 0 && <div className="empty"><Theater size={34} /><strong>아직 장면이 없어요</strong><span>첫 장면을 등록해 공연 흐름을 만들어보세요.</span></div>}
            {scenes.map(scene => (
              <article className="scene-card" key={scene.id}>
                <div className="scene-index">{scene.scene_no}</div>
                <div className="scene-copy"><span>ACT {scene.act_no}</span><h3>{scene.title}</h3><p>{scene.summary || '설명 없음'}</p></div>
                <button className="icon-button danger" onClick={() => deleteScene(scene.id)}><Trash2 size={18} /></button>
              </article>
            ))}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-inline"><Theater size={24} /><strong>StageFlow</strong></div>
        <button className="icon-button" onClick={() => supabase.auth.signOut()}><LogOut /></button>
      </header>
      <main className="content">
        <section className="hero">
          <p className="eyebrow">WELCOME BACK</p>
          <h1>{workspace.name}</h1>
          <p>공연 준비 현황을 한눈에 확인하세요.</p>
        </section>

        <div className="section-heading">
          <div><p className="eyebrow">PRODUCTIONS</p><h2>내 공연</h2></div>
          <button className="primary compact" onClick={() => setShowProductionForm(v => !v)}><Plus size={18} /> 공연</button>
        </div>

        {showProductionForm && (
          <form className="panel form-grid" onSubmit={createProduction}>
            <input required placeholder="공연명" value={productionForm.title} onChange={e => setProductionForm({ ...productionForm, title: e.target.value })} />
            <input placeholder="공연 장소" value={productionForm.venue} onChange={e => setProductionForm({ ...productionForm, venue: e.target.value })} />
            <input type="date" value={productionForm.performance_start_date} onChange={e => setProductionForm({ ...productionForm, performance_start_date: e.target.value })} />
            <button className="primary">공연 만들기</button>
          </form>
        )}

        <section className="production-grid">
          {productions.length === 0 && <div className="empty"><CalendarDays size={34} /><strong>아직 공연이 없어요</strong><span>새 공연을 만들고 준비를 시작하세요.</span></div>}
          {productions.map(item => (
            <article className="production-card" key={item.id} onClick={() => setSelected(item)}>
              <div className="card-top"><span className="status">{item.status}</span><button className="icon-button danger" onClick={e => { e.stopPropagation(); deleteProduction(item.id) }}><Trash2 size={17} /></button></div>
              <div className="poster"><Theater size={34} /></div>
              <h3>{item.title}</h3>
              <p>{item.venue || '장소 미정'}</p>
              <small>{item.performance_start_date || '공연일 미정'}</small>
            </article>
          ))}
        </section>
        {message && <p className="notice">{message}</p>}
      </main>
    </div>
  )
}
