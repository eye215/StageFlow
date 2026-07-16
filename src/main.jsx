import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './danger.css'
import './reset.css'
import './approval-alert.css'
import './share-deletion.css'
import './team-panel.css'
import './role-switch.css'
import './task-filter.css'
import './home-task-scope.css'
import './task-urgency.css'
import './pdf-extraction.css'
import './import-cast-preview.css'
import './import-cast-edit.css'
import './import-merge.css'
import './import-prop-edit.css'
import './cast-cleanup-preview.css'
import './cast-status-filter.css'
import './actor-run-flow.css'
import './connected-overview.css'
import './actor-home.css'
import './scene-hub.css'
import './scene-card-polish.css'
import './production-create-modal.css'
import './mobile-system.css'
import './visual-refresh.css'
import './design-v5.css'
import './shared-player.css'
import './mobile-v6.css'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('StageFlow render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="app-crash"><div><span>STAGEFLOW RECOVERY</span><h1>화면을 다시 불러올게요</h1><p>저장된 공연 데이터는 그대로예요. 아래 버튼으로 앱을 새로 시작해주세요.</p><code>{this.state.error?.message || '알 수 없는 화면 오류'}</code><button onClick={() => window.location.reload()}>다시 불러오기</button></div></main>
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>
)
