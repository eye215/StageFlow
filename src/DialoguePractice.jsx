import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, FileText, Mic, Pause, Play, RefreshCw,
  RotateCcw, SkipForward, Sparkles, Upload, Volume2, VolumeX,
} from 'lucide-react'
import { supabase } from './supabase'

let dialoguePdfRuntimePromise

function normalizeKey(value = '') {
  return String(value).normalize('NFKC').toLowerCase().replace(/[（(][^）)]*[）)]/g, '').replace(/[^0-9a-z가-힣]/g, '')
}

function normalizeLine(value = '') {
  return String(value).replace(/\([^)]*\)|（[^）]*）/g, '').normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]/g, '')
}

function cleanStoredName(value = '') {
  const encoded = String(value).match(/^\d{13}(?:-[A-Fa-f0-9]{8})?--([A-Za-z0-9_-]+)(\.[A-Za-z0-9]+)?$/)
  if (!encoded) return String(value).replace(/^\d{13}-/, '')
  try {
    const base64 = encoded[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    return `${new TextDecoder().decode(bytes)}${encoded[2] || ''}`
  } catch {
    return value
  }
}

async function loadDialoguePdfRuntime() {
  if (!dialoguePdfRuntimePromise) {
    dialoguePdfRuntimePromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    }).catch((error) => {
      dialoguePdfRuntimePromise = null
      throw error
    })
  }
  return dialoguePdfRuntimePromise
}

async function extractPdfDialogueText(blob) {
  const pdfjs = await loadDialoguePdfRuntime()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const rows = []
    ;(content.items || []).forEach((item) => {
      if (!String(item.str || '').trim()) return
      const x = Number(item.transform?.[4] || 0)
      const y = Number(item.transform?.[5] || 0)
      let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 3)
      if (!row) { row = { y, items: [] }; rows.push(row) }
      row.items.push({ x, text: String(item.str).trim() })
    })
    pages.push(rows.sort((left, right) => right.y - left.y).map((row) => row.items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' ')).join('\n'))
  }
  return pages.join('\n')
}

async function decodeTextBlob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const payload = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes
  try { return new TextDecoder('utf-8', { fatal: true }).decode(payload) }
  catch {
    try { return new TextDecoder('euc-kr').decode(payload) }
    catch { return new TextDecoder().decode(payload) }
  }
}

function sceneHeading(line, scenes) {
  const value = String(line || '').trim()
  let match = value.match(/^(?:ACT\s*\d+\s*[-·:]?\s*)?(?:SCENE|#SCENE|장면)\s*#?\s*(\d+)\s*(?:-\s*(\d+))?\s*[-–—.:]?\s*(.*)$/i)
  if (!match) {
    const numbered = value.match(/^(\d+)\s*[.)]\s*(.+)$/)
    if (numbered && scenes.some((scene) => Number(scene.scene_no) === Number(numbered[1]) || normalizeKey(scene.title) === normalizeKey(numbered[2]))) match = [value, numbered[1], '', numbered[2]]
  }
  if (!match) return null
  const sceneNo = Number(match[1])
  const detailNo = match[2] ? Number(match[2]) : null
  const headingTitle = String(match[3] || '').trim()
  const scene = scenes.find((item) => Number(item.scene_no) === sceneNo)
    || scenes.find((item) => headingTitle && (normalizeKey(item.title) === normalizeKey(headingTitle) || normalizeKey(item.title).includes(normalizeKey(headingTitle)) || normalizeKey(headingTitle).includes(normalizeKey(item.title))))
  return {
    sceneId: scene?.id || '',
    sceneNo,
    sceneTitle: scene?.title || headingTitle || `장면 ${sceneNo}`,
    detailNo,
    sourceHeading: value,
  }
}

function buildRoleIndex(castMembers) {
  const assignments = castMembers.filter((member) => member?.entityType === 'cast_assignment' && String(member.roleName || '').trim())
  const aliases = new Map()
  const add = (alias, member, source) => {
    const key = normalizeKey(alias)
    if (!key) return
    if (!aliases.has(key)) aliases.set(key, { alias: String(alias).trim(), members: [], source })
    const bucket = aliases.get(key)
    if (!bucket.members.some((item) => item.id === member.id)) bucket.members.push(member)
    if (source === 'role') bucket.source = 'role'
  }
  assignments.forEach((member) => {
    add(member.roleName, member, 'role')
    if (member.subRoleName) add(member.subRoleName, member, 'role')
    if (member.roleName && member.subRoleName) add(`${member.roleName} ${member.subRoleName}`, member, 'role')
    if (member.name) add(member.name, member, 'actor')
  })
  return { assignments, aliases }
}

function resolveSpeaker(speakerRaw, currentScene, roleIndex) {
  const speakerKey = normalizeKey(speakerRaw)
  const match = roleIndex.aliases.get(speakerKey)
  let members = match?.members || []
  if (currentScene?.sceneNo != null && members.length > 1) {
    const inScene = members.filter((member) => (member.sceneNumbers || []).some((number) => Number(number) === Number(currentScene.sceneNo)))
    if (inScene.length) members = inScene
  }
  const roles = [...new Set(members.map((member) => member.roleName).filter(Boolean))]
  return {
    speakerRaw: String(speakerRaw).trim(),
    speakerKey,
    roleName: roles.join(' · ') || String(speakerRaw).trim(),
    matchedAssignmentIds: members.map((member) => member.id),
    actors: [...new Set(members.map((member) => member.name).filter(Boolean))],
    pairs: [...new Set(members.map((member) => member.pairGroup).filter(Boolean))],
    confidence: match ? (match.source === 'role' ? 'role' : 'actor') : 'unmatched',
  }
}

function splitKnownDialogue(line, roleIndex) {
  const roleAliases = [...roleIndex.aliases.values()].filter((item) => item.source === 'role').map((item) => item.alias).filter((item) => item.length > 0).sort((left, right) => right.length - left.length)
  if (!roleAliases.length) return []
  const escaped = roleAliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const marker = new RegExp(`(^|\\s)(${escaped.join('|')})\\s*[:：]\\s*`, 'gi')
  const matches = [...String(line).matchAll(marker)]
  if (!matches.length) return []
  return matches.map((match, index) => ({
    speaker: match[2],
    text: String(line).slice((match.index || 0) + match[0].length, matches[index + 1]?.index ?? String(line).length).trim(),
  })).filter((item) => item.text)
}

export function parseDialogueScript(source, scenes = [], castMembers = []) {
  const roleIndex = buildRoleIndex(castMembers)
  const lines = []
  let currentScene = scenes[0] ? { sceneId: scenes[0].id, sceneNo: Number(scenes[0].scene_no), sceneTitle: scenes[0].title, detailNo: null, sourceHeading: '' } : { sceneId: '', sceneNo: null, sceneTitle: '대본 전체', detailNo: null, sourceHeading: '' }
  let pendingSpeaker = ''
  const addLine = (speaker, text, lineNumber) => {
    const cleanText = String(text || '').trim()
    if (!cleanText || /^[-–—·•]+$/.test(cleanText)) return
    const direction = cleanText.match(/^[（(]([^）)]*)[）)]\s*(.*)$/)
    const speakerMatch = resolveSpeaker(speaker, currentScene, roleIndex)
    lines.push({
      id: `${currentScene.sceneId || currentScene.sceneNo || 'all'}-${lineNumber}-${lines.length}`,
      order: lines.length,
      ...currentScene,
      ...speakerMatch,
      text: direction?.[2]?.trim() || cleanText,
      stageDirection: direction?.[1]?.trim() || '',
      sourceLine: lineNumber,
    })
  }
  String(source || '').replace(/\r/g, '').split('\n').forEach((rawLine, index) => {
    const line = rawLine.replace(/\s+$/g, '').trim()
    if (!line) return
    const heading = sceneHeading(line, scenes)
    if (heading) { currentScene = heading; pendingSpeaker = ''; return }
    const exactRole = roleIndex.aliases.get(normalizeKey(line))
    if (exactRole && line.length <= 35) { pendingSpeaker = exactRole.alias; return }
    const knownSegments = splitKnownDialogue(line, roleIndex)
    if (knownSegments.length) { knownSegments.forEach((item) => addLine(item.speaker, item.text, index + 1)); pendingSpeaker = ''; return }
    const explicit = line.match(/^([^:：]{1,40})\s*[:：]\s*(.+)$/)
    if (explicit && !/^(조명|음향|영상|무대|소품|의상|장소|시간|scene|song)$/i.test(explicit[1].trim())) { addLine(explicit[1], explicit[2], index + 1); pendingSpeaker = ''; return }
    if (pendingSpeaker && !/^[（(].*[）)]$/.test(line)) { addLine(pendingSpeaker, line, index + 1); pendingSpeaker = '' }
  })
  const sceneGroups = [...lines.reduce((map, line) => {
    const key = line.sceneId || `scene-${line.sceneNo ?? 'all'}-${line.detailNo ?? ''}`
    if (!map.has(key)) map.set(key, { key, sceneId: line.sceneId, sceneNo: line.sceneNo, sceneTitle: line.sceneTitle, detailNo: line.detailNo, lines: [] })
    map.get(key).lines.push(line)
    return map
  }, new Map()).values()]
  const unmatchedSpeakers = [...new Map(lines.filter((line) => line.confidence === 'unmatched').map((line) => [line.speakerKey, line.speakerRaw])).values()]
  return { lines, scenes: sceneGroups, unmatchedSpeakers, assignments: roleIndex.assignments }
}

function lineSimilarity(left, right) {
  const a = normalizeLine(left)
  const b = normalizeLine(right)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length)
  const aChars = new Set(a)
  const bChars = new Set(b)
  const overlap = [...aChars].filter((character) => bChars.has(character)).length
  return (2 * overlap) / (aChars.size + bChars.size)
}

function DialogueMessage({ item }) {
  if (item.type === 'system') return <div className="dialogue-message system">{item.text}</div>
  return <div className={`dialogue-message ${item.type}`}><span>{item.role}</span><p>{item.text}</p>{item.feedback && <small>{item.feedback}</small>}</div>
}

export default function DialoguePractice({ workspace, production, scenes, castMembers, session, draftText = '', initialSceneNo = null }) {
  const dataPath = `${workspace.id}/${production.id}/data/dialogue-script.json`
  const [sourceText, setSourceText] = useState(draftText)
  const [sourceName, setSourceName] = useState(draftText.trim() ? '현재 자동정리 대본' : '')
  const [parsed, setParsed] = useState(() => parseDialogueScript(draftText, scenes, castMembers))
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('대본과 배역을 연결하는 중이에요…')
  const [selectedScene, setSelectedScene] = useState(initialSceneNo == null ? 'all' : `${initialSceneNo}:`)
  const [selectedPair, setSelectedPair] = useState('')
  const [selectedRoles, setSelectedRoles] = useState([])
  const [showSource, setShowSource] = useState(false)
  const [stage, setStage] = useState('setup')
  const [messages, setMessages] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [speechRate, setSpeechRate] = useState(1.15)
  const [speaking, setSpeaking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [turnFlash, setTurnFlash] = useState(false)
  const chatRef = useRef(null)
  const recognitionRef = useRef(null)
  const runTokenRef = useRef(0)

  const assignments = useMemo(() => castMembers.filter((member) => member?.entityType === 'cast_assignment' && member.roleName), [castMembers])
  const pairNames = useMemo(() => [...new Set(assignments.map((member) => member.pairGroup).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'ko')), [assignments])
  const ownAssignments = useMemo(() => assignments.filter((member) => member.userId === session.user.id), [assignments, session.user.id])
  const roleOptions = useMemo(() => assignments.filter((member) => !selectedPair || normalizeKey(member.pairGroup) === normalizeKey(selectedPair)), [assignments, selectedPair])
  const unmatchedRoleOptions = useMemo(() => parsed.unmatchedSpeakers.map((speaker) => ({ id: `speaker:${normalizeKey(speaker)}`, roleName: speaker, name: '배우 연결 필요', pairGroup: '' })), [parsed.unmatchedSpeakers])
  const sceneOptions = parsed.scenes
  const visibleLines = useMemo(() => selectedScene === 'all' ? parsed.lines : parsed.lines.filter((line) => `${line.sceneNo ?? 'all'}:${line.detailNo ?? ''}` === selectedScene), [parsed.lines, selectedScene])
  const currentLine = visibleLines[currentIndex]
  const isMyLine = (line) => Boolean(line && (line.matchedAssignmentIds.some((id) => selectedRoles.includes(`assignment:${id}`)) || selectedRoles.includes(`speaker:${line.speakerKey}`)))

  useEffect(() => {
    const preferredPair = ownAssignments[0]?.pairGroup || pairNames[0] || ''
    setSelectedPair((current) => current || preferredPair)
    if (ownAssignments.length) setSelectedRoles(ownAssignments.map((member) => `assignment:${member.id}`))
  }, [ownAssignments, pairNames])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, currentIndex])

  useEffect(() => () => {
    runTokenRef.current += 1
    window.speechSynthesis?.cancel()
    recognitionRef.current?.abort?.()
  }, [])

  async function persistDialogue(nextParsed, nextSourceName, nextSourceText) {
    const payload = { version: 2, sourceName: nextSourceName, sourceText: String(nextSourceText || ''), analyzedAt: new Date().toISOString(), lines: nextParsed.lines }
    const { error } = await supabase.storage.from('stageflow-files').upload(dataPath, new Blob([JSON.stringify(payload)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
    if (error) throw error
  }

  function applyParsed(text, name, persist = true) {
    const next = parseDialogueScript(text, scenes, castMembers)
    setSourceText(text)
    setSourceName(name)
    setParsed(next)
    setSelectedScene(initialSceneNo == null ? 'all' : `${initialSceneNo}:`)
    setStage('setup')
    setStatus(next.lines.length ? `${next.lines.length}개 대사를 ${next.scenes.length}개 장면에 연결했어요.` : '대사를 찾지 못했어요. “배역: 대사” 형식과 장면 표기를 확인해주세요.')
    if (persist && next.lines.length) void persistDialogue(next, name, text).catch((error) => setStatus(`대사는 연결했지만 저장하지 못했어요: ${error.message}`))
    return next
  }

  async function loadLatestSource() {
    setLoading(true)
    setStatus('최근 대본 원본을 읽는 중이에요…')
    try {
      const base = `${workspace.id}/${production.id}/imports`
      const { data, error } = await supabase.storage.from('stageflow-files').list(base, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
      if (error) throw error
      const candidates = (data || []).filter((item) => item.id && /\.(txt|pdf)$/i.test(cleanStoredName(item.name)))
      if (!candidates.length) {
        if (draftText.trim()) { applyParsed(draftText, '현재 자동정리 대본'); return }
        throw new Error('공연 데이터에서 TXT 또는 PDF 대본을 찾지 못했어요.')
      }
      const item = candidates.find((candidate) => /\.txt$/i.test(cleanStoredName(candidate.name))) || candidates[0]
      const { data: blob, error: downloadError } = await supabase.storage.from('stageflow-files').download(`${base}/${item.name}`)
      if (downloadError || !blob) throw downloadError || new Error('대본 파일을 내려받지 못했어요.')
      const name = cleanStoredName(item.name)
      const text = /\.pdf$/i.test(name) ? await extractPdfDialogueText(blob) : await decodeTextBlob(blob)
      applyParsed(text, name)
    } catch (error) {
      setStatus(`대본 자동 연결 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    async function initialize() {
      setLoading(true)
      try {
        const { data } = await supabase.storage.from('stageflow-files').download(dataPath)
        if (data) {
          const saved = JSON.parse(await data.text())
          if (active && String(saved.sourceText || '').trim()) {
            applyParsed(saved.sourceText, saved.sourceName || '저장된 대본', false)
            setLoading(false)
            return
          }
          if (active && Array.isArray(saved.lines) && saved.lines.length) {
            const restored = { lines: saved.lines, scenes: [...saved.lines.reduce((map, line) => {
              const key = line.sceneId || `scene-${line.sceneNo ?? 'all'}-${line.detailNo ?? ''}`
              if (!map.has(key)) map.set(key, { key, sceneId: line.sceneId, sceneNo: line.sceneNo, sceneTitle: line.sceneTitle, detailNo: line.detailNo, lines: [] })
              map.get(key).lines.push(line)
              return map
            }, new Map()).values()], unmatchedSpeakers: [...new Set(saved.lines.filter((line) => line.confidence === 'unmatched').map((line) => line.speakerRaw))] }
            setParsed(restored)
            setSourceName(saved.sourceName || '저장된 대본')
            setStatus(`${restored.lines.length}개 대사를 불러왔어요.`)
            setLoading(false)
            return
          }
        }
      } catch { /* 저장된 분석이 없으면 최근 대본을 자동 분석합니다. */ }
      if (active) await loadLatestSource()
    }
    void initialize()
    return () => { active = false }
    // 공연이 바뀔 때만 해당 공연의 대사를 다시 읽습니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [production.id])

  async function handleFile(file) {
    if (!file) return
    setLoading(true)
    setStatus(`${file.name} 대사를 읽는 중이에요…`)
    try {
      const text = /\.pdf$/i.test(file.name) ? await extractPdfDialogueText(file) : await decodeTextBlob(file)
      applyParsed(text, file.name)
    } catch (error) {
      setStatus(`대본 읽기 실패: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  function toggleRole(token) {
    setSelectedRoles((current) => current.includes(token) ? current.filter((item) => item !== token) : [...current, token])
  }

  function beep() {
    if (!alertEnabled) return
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 820
      gain.gain.setValueAtTime(0.08, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25)
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.25)
      window.setTimeout(() => context.close().catch(() => {}), 500)
    } catch { /* 알림음 미지원 환경에서는 화면 강조만 사용합니다. */ }
  }

  function speak(text, token) {
    if (!voiceEnabled || !window.speechSynthesis) return Promise.resolve()
    return new Promise((resolve) => {
      const spoken = String(text).replace(/[（(][^）)]*[）)]/g, '').trim()
      if (!spoken || token !== runTokenRef.current) { resolve(); return }
      const utterance = new SpeechSynthesisUtterance(spoken)
      utterance.lang = 'ko-KR'; utterance.rate = speechRate
      let settled = false
      const finish = () => { if (settled) return; settled = true; setSpeaking(false); resolve() }
      utterance.onend = finish; utterance.onerror = finish
      setSpeaking(true)
      window.speechSynthesis.speak(utterance)
      window.setTimeout(finish, Math.min(18000, Math.max(3000, spoken.length * 180)))
    })
  }

  async function playFrom(startIndex) {
    const token = ++runTokenRef.current
    window.speechSynthesis?.cancel()
    let index = startIndex
    setCurrentIndex(index)
    while (index < visibleLines.length && token === runTokenRef.current && !isMyLine(visibleLines[index])) {
      const line = visibleLines[index]
      setMessages((current) => [...current, { id: `partner-${line.id}-${Date.now()}`, type: 'partner', role: line.roleName || line.speakerRaw, text: line.text }])
      await speak(line.text, token)
      index += 1
      setCurrentIndex(index)
    }
    if (token !== runTokenRef.current) return
    if (index < visibleLines.length) {
      beep(); setTurnFlash(true); window.setTimeout(() => setTurnFlash(false), 900)
    } else {
      setMessages((current) => [...current, { id: `done-${Date.now()}`, type: 'system', text: '이 장면의 대사 연습이 끝났어요. 수고했어요!' }])
    }
  }

  function startPractice() {
    if (!visibleLines.length) { setStatus('선택한 장면에 연습할 대사가 없어요.'); return }
    if (!selectedRoles.length) { setStatus('내가 연습할 배역을 하나 이상 선택해주세요.'); return }
    setStage('practice')
    setMessages([{ id: `start-${Date.now()}`, type: 'system', text: `${selectedScene === 'all' ? '전체 대본' : sceneOptions.find((scene) => `${scene.sceneNo ?? 'all'}:${scene.detailNo ?? ''}` === selectedScene)?.sceneTitle || '선택 장면'} 연습을 시작해요.` }])
    void playFrom(0)
  }

  function submitLine(value = input) {
    const answer = String(value || '').trim()
    if (!answer || !currentLine || !isMyLine(currentLine)) return
    const score = lineSimilarity(answer, currentLine.text)
    setMessages((current) => [...current, { id: `user-${currentLine.id}-${Date.now()}`, type: 'user', role: currentLine.roleName || currentLine.speakerRaw, text: answer, feedback: score >= 0.82 ? '좋아요, 대사가 잘 맞아요.' : `원래 대사 · ${currentLine.text}` }])
    setInput('')
    void playFrom(currentIndex + 1)
  }

  function restart() {
    runTokenRef.current += 1
    window.speechSynthesis?.cancel()
    recognitionRef.current?.abort?.()
    setRecording(false)
    setMessages([{ id: `restart-${Date.now()}`, type: 'system', text: '장면을 처음부터 다시 시작해요.' }])
    void playFrom(0)
  }

  function toggleRecording() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) { setStatus('이 브라우저는 음성 인식을 지원하지 않아요. 키보드로 대사를 입력해주세요.'); return }
    if (recording) { recognitionRef.current?.stop?.(); setRecording(false); return }
    window.speechSynthesis?.cancel(); runTokenRef.current += 1
    const recognition = new Recognition()
    recognition.lang = 'ko-KR'; recognition.interimResults = false; recognition.continuous = false
    recognition.onresult = (event) => { const transcript = event.results?.[0]?.[0]?.transcript || ''; setInput(transcript); setRecording(false); submitLine(transcript) }
    recognition.onerror = () => { setRecording(false); setStatus('음성을 인식하지 못했어요. 다시 눌러 말해주세요.') }
    recognition.onend = () => setRecording(false)
    recognitionRef.current = recognition
    recognition.start(); setRecording(true)
  }

  if (stage === 'practice') return <section className={`dialogue-practice practice ${turnFlash ? 'my-turn' : ''}`}>
    <header className="dialogue-run-head"><div><span>DIALOGUE RUN</span><h2>대사 연습하기</h2><p>{sourceName || '공연 대본'} · {currentIndex + 1}/{visibleLines.length}</p></div><button type="button" onClick={() => { runTokenRef.current += 1; window.speechSynthesis?.cancel(); setStage('setup') }}><Pause /> 설정</button></header>
    <div className="dialogue-progress"><i style={{ width: `${visibleLines.length ? Math.min(100, (currentIndex / visibleLines.length) * 100) : 0}%` }} /></div>
    {currentLine && isMyLine(currentLine) && <section className="dialogue-turn-card"><Sparkles /><div><span>내 차례</span><strong>{currentLine.roleName || currentLine.speakerRaw}</strong>{currentLine.stageDirection && <small>지문 · {currentLine.stageDirection}</small>}</div></section>}
    <div className="dialogue-chat" ref={chatRef}>{messages.map((item) => <DialogueMessage item={item} key={item.id} />)}</div>
    <div className="dialogue-input"><input value={input} disabled={!currentLine || !isMyLine(currentLine)} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitLine() }} placeholder={currentLine && isMyLine(currentLine) ? '대사를 입력하거나 마이크로 말해보세요' : '상대 대사를 듣는 중이에요'} /><button className={recording ? 'recording' : ''} type="button" disabled={!currentLine || !isMyLine(currentLine)} onClick={toggleRecording} aria-label="음성으로 대사 말하기"><Mic /></button><button type="button" disabled={!input.trim() || !currentLine || !isMyLine(currentLine)} onClick={() => submitLine()}><Play /></button></div>
    <div className="dialogue-run-actions"><button type="button" onClick={() => { window.speechSynthesis?.cancel(); setSpeaking(false) }}><SkipForward /> {speaking ? '음성 넘기기' : '음성 정지'}</button><button type="button" onClick={restart}><RotateCcw /> 다시 시작</button></div>
  </section>

  return <section className="dialogue-practice setup">
    <header className="dialogue-hero"><div className="dialogue-hero-icon"><Sparkles /></div><div><span>ACTOR PRACTICE</span><h2>대사 연습하기</h2><p>공연 대본의 장면과 배역을 자동으로 연결해 상대 대사를 읽어드려요.</p></div></header>
    {status && <p className={parsed.lines.length ? 'dialogue-status ready' : 'dialogue-status'}>{parsed.lines.length ? <CheckCircle2 /> : <AlertTriangle />}{status}</p>}
    <section className="dialogue-source-card"><div><FileText /><span><b>{sourceName || '연결된 대본 없음'}</b><small>{parsed.lines.length}개 대사 · {parsed.scenes.length}개 장면 · 미연결 화자 {parsed.unmatchedSpeakers.length}명</small></span></div><button type="button" disabled={loading} onClick={loadLatestSource}><RefreshCw /> {loading ? '연결 중' : '최신 대본 다시 연결'}</button><label><Upload /> 다른 TXT·PDF 불러오기<input type="file" accept=".txt,.pdf,text/plain,application/pdf" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = '' }} /></label></section>
    <section className="dialogue-setup-card"><div className="dialogue-step"><b>1</b><span><strong>연습할 장면</strong><small>대본에서 찾은 장면만 표시해요.</small></span></div><select value={selectedScene} onChange={(event) => setSelectedScene(event.target.value)}><option value="all">전체 대본 · {parsed.lines.length}개 대사</option>{sceneOptions.map((scene) => <option key={scene.key} value={`${scene.sceneNo ?? 'all'}:${scene.detailNo ?? ''}`}>{scene.sceneNo != null ? `${scene.sceneNo}${scene.detailNo != null ? `-${scene.detailNo}` : ''}. ` : ''}{scene.sceneTitle} · {scene.lines.length}개</option>)}</select></section>
    <section className="dialogue-setup-card"><div className="dialogue-step"><b>2</b><span><strong>내 배역 선택</strong><small>내 계정에 연결된 배역은 자동 선택돼요.</small></span></div>{pairNames.length > 0 && <div className="dialogue-pairs">{pairNames.map((pair) => <button type="button" className={normalizeKey(pair) === normalizeKey(selectedPair) ? 'active' : ''} key={pair} onClick={() => setSelectedPair(pair)}>{pair}</button>)}</div>}<div className="dialogue-role-options">{roleOptions.map((member) => { const token = `assignment:${member.id}`; return <button type="button" className={selectedRoles.includes(token) ? 'selected' : ''} key={member.id} onClick={() => toggleRole(token)}><CheckCircle2 /><span><b>{member.roleName}{member.subRoleName ? ` · ${member.subRoleName}` : ''}</b><small>{member.name}{member.pairGroup ? ` · ${member.pairGroup}` : ''}</small></span></button> })}{unmatchedRoleOptions.map((member) => <button type="button" className={selectedRoles.includes(member.id) ? 'selected unmatched' : 'unmatched'} key={member.id} onClick={() => toggleRole(member.id)}><AlertTriangle /><span><b>{member.roleName}</b><small>{member.name}</small></span></button>)}</div></section>
    <section className="dialogue-options"><button type="button" className={voiceEnabled ? 'active' : ''} onClick={() => setVoiceEnabled((value) => !value)}>{voiceEnabled ? <Volume2 /> : <VolumeX />}<span><b>상대 대사 음성</b><small>{voiceEnabled ? '켜짐' : '꺼짐'}</small></span></button><button type="button" className={alertEnabled ? 'active' : ''} onClick={() => setAlertEnabled((value) => !value)}><Sparkles /><span><b>내 차례 알림</b><small>{alertEnabled ? '켜짐' : '꺼짐'}</small></span></button><label><span>음성 속도 <b>{speechRate.toFixed(1)}x</b></span><input type="range" min="0.8" max="1.8" step="0.1" value={speechRate} onChange={(event) => setSpeechRate(Number(event.target.value))} /></label></section>
    <button className="dialogue-start" type="button" disabled={loading || !visibleLines.length || !selectedRoles.length} onClick={startPractice}><Play fill="currentColor" /><span><b>대사 연습 시작</b><small>{visibleLines.length}개 대사 · {selectedRoles.length}개 배역 선택</small></span></button>
    <button className="dialogue-source-toggle" type="button" onClick={() => setShowSource((value) => !value)}>{showSource ? '대본 텍스트 닫기' : '대본 텍스트 확인·수정'}</button>{showSource && <div className="dialogue-source-editor"><textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="배역: 대사 형식의 대본을 붙여넣으세요." /><button type="button" onClick={() => applyParsed(sourceText, sourceName || '직접 입력 대본')}><RefreshCw /> 수정한 텍스트 다시 연결</button></div>}
  </section>
}
