import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, ChevronLeft, Clapperboard, Home, LogOut, MapPin, Menu,
  MoreHorizontal, Play, Plus, Settings, Sparkles, Theater, Trash2, Users
} from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState('home')
  const [productionTab, setProductionTab] = useState('overview')
  const [showIndex, setShowIndex] = useState(0)

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
    if (selected) {
      loadScenes(selected.id)
      setProductionTab('overview')
      setShowIndex(0)
    }
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
    if (!confirm('이 장면을 삭제할까요?')) return
    await supabase.from('scenes').delete().eq('id', id)
    await loadScenes(selected.id)
  }

  const progress = useMemo(() => Math.min(100, scenes.length * 10), [scenes])
  const currentScene = scenes[showIndex]
  const nextScene = scenes[showIndex + 1]
  const daysLeft = useMemo(() => {
    if (!selected?.performance_start_date) return null
    return Math.ceil((new Date(selected.performance_start_date) - new Date()) / 86400000)
  }, [selected])

  if (loading) return <div className="center"><div className="spinner" /></div>

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="brand-mark"><Theater size={34} /></div>
          <p className="eyebrow">MUSICAL PRODUCTION OS</p>
          <h1>StageFlow</h1>
          <p className="muted">공연의 모든 흐름을 한곳에서 관리하세요.</p>
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
          <button className="icon-button"><MoreHorizontal /></button>
        </header>

        <main className="content production-content">
          <section className="production-cover">
            <div className="cover-glow" />
            <div className="cover-copy">
              <span className="status">{selected.status || 'preparing'}</span>
              <h1>{selected.title}</h1>
              <p><MapPin size={15} /> {selected.venue || '공연 장소 미정'}</p>
              <div className="cover-meta">
                <span>{selected.performance_start_date || '공연일 미정'}</span>
                {daysLeft !== null && <strong>{daysLeft >= 0 ? `D-${daysLeft}` : '공연 종료'}</strong>}
              </div>
            </div>
          </section>

          <nav className="segmented">
            <button className={productionTab === 'overview' ? 'active' : ''} onClick={() => setProductionTab('overview')}>홈</button>
            <button className={productionTab === 'scenes' ? 'active' : ''} onClick={() => setProductionTab('scenes')}>장면</button>
            <button className={productionTab === 'show' ? 'active' : ''} onClick={() => setProductionTab('show')}>공연모드</button>
          </nav>

          {productionTab === 'overview' && (
            <>
              <section className="metric-grid">
                <article className="metric-card"><span>준비도</span><strong>{progress}%</strong><div className="progress"><i style={{ width: `${progress}%` }} /></div></article>
                <article className="metric-card"><span>등록 장면</span><strong>{scenes.length}</strong><small>Scene</small></article>
              </section>
              <section className="quick-grid">
                <button onClick={() => setProductionTab('scenes')}><Clapperboard /><span>장면 관리</span><small>{scenes.length}개</small></button>
                <button><Users /><span>배우·배역</span><small>준비 중</small></button>
                <button><Play /><span>큐시트</span><small>준비 중</small></button>
                <button><Settings /><span>공연 설정</span><small>정보 관리</small></button>
              </section>
              <div className="section-heading compact-heading"><div><p className="eyebrow">NEXT</p><h2>다음 장면</h2></div></div>
              {scenes[0] ? <SceneCard scene={scenes[0]} onDelete={deleteScene} /> : <EmptyScene onAdd={() => { setProductionTab('scenes'); setShowSceneForm(true) }} />}
            </>
          )}

          {productionTab === 'scenes' && (
            <>
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
                {scenes.length === 0 && <EmptyScene onAdd={() => setShowSceneForm(true)} />}
                {scenes.map(scene => <SceneCard key={scene.id} scene={scene} onDelete={deleteScene} />)}
              </section>
            </>
          )}

          {productionTab === 'show' && (
            <section className="show-mode">
              {!currentScene ? (
                <EmptyScene onAdd={() => { setProductionTab('scenes'); setShowSceneForm(true) }} />
              ) : (
                <>
                  <div className="show-head"><span>NOW PLAYING</span><strong>{showIndex + 1} / {scenes.length}</strong></div>
                  <article className="current-scene">
                    <p>ACT {currentScene.act_no} · SCENE {currentScene.scene_no}</p>
                    <h2>{currentScene.title}</h2>
                    <span>{currentScene.summary || '장면 설명이 없습니다.'}</span>
                  </article>
                  <article className="next-cue"><span>NEXT</span><strong>{nextScene ? nextScene.title : 'Curtain Call'}</strong></article>
                  <div className="show-actions">
                    <button disabled={showIndex === 0} onClick={() => setShowIndex(i => Math.max(0, i - 1))}>이전</button>
                    <button className="go-button" onClick={() => setShowIndex(i => Math.min(scenes.length - 1, i + 1))}>GO <Play fill="currentColor" /></button>
                  </div>
                </>
              )}
            </section>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar home-topbar">
        <div className="brand-inline"><Theater size={24} /><strong>StageFlow</strong></div>
        <button className="avatar" onClick={() => supabase.auth.signOut()}>{session.user.email?.[0]?.toUpperCase() || 'U'}</button>
      </header>
      <main className="content home-content">
        {activeTab === 'home' && (
          <>
            <section className="welcome-block">
              <p className="eyebrow">WELCOME BACK</p>
              <h1>안녕하세요 👋</h1>
              <p>{workspace.name}의 공연 준비를 이어가세요.</p>
            </section>
            <section className="today-card">
              <div><span>오늘의 준비</span><h3>{productions.length ? '공연 흐름 점검하기' : '첫 공연을 만들어보세요'}</h3></div>
              <Sparkles />
            </section>
          </>
        )}

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
          {productions.map((item, index) => (
            <article className="production-card" key={item.id} onClick={() => setSelected(item)}>
              <div className={`poster poster-${index % 3}`}><Theater size={38} /></div>
              <div className="production-info">
                <div className="card-top"><span className="status">{item.status || 'preparing'}</span><button className="icon-button danger" onClick={e => { e.stopPropagation(); deleteProduction(item.id) }}><Trash2 size={17} /></button></div>
                <h3>{item.title}</h3>
                <p>{item.venue || '장소 미정'}</p>
                <small>{item.performance_start_date || '공연일 미정'}</small>
              </div>
            </article>
          ))}
        </section>
        {message && <p className="notice">{message}</p>}
      </main>
      <nav className="bottom-nav">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}><Home /><span>홈</span></button>
        <button className={activeTab === 'productions' ? 'active' : ''} onClick={() => setActiveTab('productions')}><Theater /><span>공연</span></button>
        <button><Menu /><span>자료</span></button>
        <button><Settings /><span>설정</span></button>
      </nav>
    </div>
  )
}

function SceneCard({ scene, onDelete }) {
  return (
    <article className="scene-card">
      <div className="scene-index">{scene.scene_no}</div>
      <div className="scene-copy"><span>ACT {scene.act_no}</span><h3>{scene.title}</h3><p>{scene.summary || '설명 없음'}</p></div>
      <button className="icon-button danger" onClick={() => onDelete(scene.id)}><Trash2 size={18} /></button>
    </article>
  )
}

function EmptyScene({ onAdd }) {
  return <div className="empty"><Clapperboard size={34} /><strong>아직 장면이 없어요</strong><span>첫 장면을 등록해 공연 흐름을 만들어보세요.</span><button className="primary compact" onClick={onAdd}><Plus size={17} /> 장면 추가</button></div>
}
