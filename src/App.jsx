import React, { useRef, useState, useEffect } from 'react'
import './App.css'

const defaultGlobalStylePrompt = 'Abstract meditation background, a single glowing lotus flower floating on calm foggy water ripples, ultra realistic textured watercolor paper texture, soft watercolor painting, bleeding ink edges, pastel colors, fluid brush strokes, cinematic lighting, masterwork, 8k --seed 55555 --v flux'

function parseGeminiPlanTable(text) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const tableLines = lines.filter(line => line.includes('|'))
  const headerIndex = tableLines.findIndex(line => /таймкод|timecode/i.test(line))
  if (headerIndex < 0) return []

  const parseRow = (line) => line.replace(/^\|\s*|\s*\|$/g, '').split('|').map(cell => cell.trim())
  const rows = []
  for (const line of tableLines.slice(headerIndex + 1)) {
    if (/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*){3,}\|?$/.test(line)) continue
    const cells = parseRow(line)
    if (cells.length >= 4 && cells.slice(0, 4).some(Boolean)) {
      rows.push(cells.slice(0, 4))
    }
  }
  return rows
}

export default function App() {
  const [sessionId] = useState(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  })
  const [file, setFile] = useState(null)
  const defaultGeminiAudioPrompt = `Прослушай этот аудиофайл с медитацией. Обрати внимание: в записи очень много длинных пауз и периодов тишины между редкими словами ведущего. Твоя задача — составить подробный покадровый план для создания визуального ряда (видео для YouTube).

Картинки должны быть максимально нейтральными, гипнотическими, расслабляющими, без резких деталей, чтобы помогать медитации, а не отвлекать от неё. На длинных паузах картинка НЕ должна меняться слишком часто — одна сцена должна удерживать атмосферу.

Выведи результат строго в виде markdown-таблицы со следующими колонками:

1. **Таймкод (От - До)**: Укажи точные границы кадра. Если идет длинная пауза, пусть этот кадр длится всё время паузы.
2. **Тип момента**: Укажи, что происходит ("Голос ведущего" или "Длинная пауза/Тишина").
3. **Описание атмосферы**: Коротко опиши настроение звука в этот момент (например: "Плавное погружение", "Глубокая тишина", "Фоновый шум ветра").
4. **Промпт для генерации (на английском)**: Напиши готовый детальный промпт для нейросети (Midjourney/DALL-E).

Правила для промптов:
- Пиши только на английском языке.
- Используй ключевые слова: "cinematic lighting, soft focus, minimal design, zen aesthetics, calming pastel colors, slow gradient, 4k, clean composition".
- Исключи из промптов: людей, лица, текст, яркие неоновые цвета, резкие геометрические формы, суету. Картинки должны быть абстрактными или природными (туман, рассвет, гладь воды, облака, текстура камня).

Пример строки таблицы:

| 00:00 - 05:30 | Длинная пауза | Абсолютная тишина, расслабление | Minimalist abstract background, soft smooth color gradient from deep blue to warm sand, calming fog, zen style, slow cinematic light, 4k, high details, no people --ar 16:9 |`
  const [geminiAudioPrompt, setGeminiAudioPrompt] = useState(defaultGeminiAudioPrompt)
  const [isGeminiAudioPromptOpen, setIsGeminiAudioPromptOpen] = useState(false)
  const [geminiPlanTable, setGeminiPlanTable] = useState([])
  const [imageUrl, setImageUrl] = useState(null)
  const [styles, setStyles] = useState([])
  const [styleName, setStyleName] = useState('')
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0)
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000'

  useEffect(() => {
    try {
      const cookieMatch = document.cookie.match('(^|;)\\s*styles=\\s*([^;]+)')
      if (cookieMatch) {
        const decoded = decodeURIComponent(cookieMatch[2])
        setStyles(JSON.parse(decoded))
        return
      }
    } catch (e) {}
    const ls = localStorage.getItem('via_styles')
    if (ls) setStyles(JSON.parse(ls))
  }, [])

  const persistStyles = (newStyles) => {
    try {
      const encoded = encodeURIComponent(JSON.stringify(newStyles))
      document.cookie = `styles=${encoded}; path=/; max-age=${60 * 60 * 24 * 365}`
    } catch (e) {
      localStorage.setItem('via_styles', JSON.stringify(newStyles))
    }
    localStorage.setItem('via_styles', JSON.stringify(newStyles))
  }

  const saveStyle = () => {
    if (!styleName) return alert('Enter a style name')
    const newStyle = { name: styleName, params: {} }
    const newStyles = [...styles, newStyle]
    setStyles(newStyles)
    setStyleName('')
    persistStyles(newStyles)
  }

  const deleteStyle = (i) => {
    const newStyles = styles.filter((_, idx) => idx !== i)
    setStyles(newStyles)
    persistStyles(newStyles)
    if (selectedStyleIndex >= newStyles.length) setSelectedStyleIndex(0)
  }

  const sendAudioToGemini = async () => {
    if (!file) return alert('Select an audio file')
    if (!geminiAudioPrompt.trim()) return alert('Enter a prompt for Gemini')
    setGeminiLoading(true)
    try {
      const formData = new FormData()
      formData.append('message', geminiAudioPrompt.trim())
      formData.append('audio', file)
      formData.append('history', JSON.stringify([]))
      formData.append('sessionId', sessionId)
      formData.append('model', selectedGeminiModel)
      const res = await fetch(`${apiBase}/api/gemini-chat`, {
        method: 'POST',
        headers: { 'X-Session-ID': sessionId },
        body: formData
      })
      const parsed = await res.json()
      const answer = res.ok ? getGeminiText(parsed) : ''
      if (answer) setGeminiPlanTable(parseGeminiPlanTable(answer))
      setGeminiHistory(history => [...history, {
        id: Date.now(),
        question: `${geminiAudioPrompt.trim()} (Audio: ${file.name})`,
        answer,
        error: res.ok ? '' : getGeminiText(parsed)
      }])
    } catch (err) {
      setGeminiHistory(history => [...history, {
        id: Date.now(),
        question: `${geminiAudioPrompt.trim()} (Audio: ${file.name})`,
        answer: '',
        error: err.message || String(err)
      }])
    } finally {
      setGeminiLoading(false)
    }
  }

  // Plan/state management
  const [plan, setPlan] = useState([])
  const [globalStylePrompt, setGlobalStylePrompt] = useState(defaultGlobalStylePrompt)
  const [globalStylePromptDraft, setGlobalStylePromptDraft] = useState(defaultGlobalStylePrompt)
  const [isGlobalStylePromptOpen, setIsGlobalStylePromptOpen] = useState(false)

  useEffect(() => {
    try {
      const m = document.cookie.match('(^|;)\\s*global_style=\\s*([^;]*)')
      if (m) {
        const savedPrompt = decodeURIComponent(m[2])
        setGlobalStylePrompt(savedPrompt)
        setGlobalStylePromptDraft(savedPrompt)
      }
    } catch (e) {}
  }, [])

  const saveGlobalStyle = () => {
    const value = globalStylePromptDraft.trim()
    setGlobalStylePrompt(value)
    setIsGlobalStylePromptOpen(false)
    try {
      document.cookie = `global_style=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}`
    } catch (e) {
      localStorage.setItem('global_style', value)
    }
  }

  const addStep = () => {
    const id = Date.now()
    const newStep = { id, title: 'New step', summary: '', prompt: '', images: [], open: true }
    const p = [...plan, newStep]
    setPlan(p)
  }

  const updateStep = (id, patch) => {
    const p = plan.map(s => s.id === id ? { ...s, ...patch } : s)
    setPlan(p)
  }

  const deleteStep = (id) => {
    if (!confirm('Delete this step?')) return
    setPlan(plan.filter(s => s.id !== id))
  }

  const toggleOpen = (id) => updateStep(id, { open: !plan.find(s => s.id === id)?.open })

  const generatePromptForStep = async (step) => {
    const res = await fetch(`${apiBase}/api/generate-prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stepText: step.summary || step.title }) })
    const j = await res.json()
    if (j.prompt) updateStep(step.id, { prompt: j.prompt })
  }

  const generateImageForStep = async (step) => {
    const finalPrompt = [globalStylePrompt || '', step.prompt || '', step.summary || ''].filter(Boolean).join(' -- ')
    const style = styles[selectedStyleIndex] || null
    const res = await fetch(`${apiBase}/api/generate-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: finalPrompt, style }) })
    const j = await res.json()
    if (j.imageUrl) {
      const img = { url: j.imageUrl, prompt: finalPrompt, saved: false }
      updateStep(step.id, { images: [...(step.images || []), img] })
    }
  }

  const saveImage = (stepId, idx) => {
    const step = plan.find(s => s.id === stepId)
    if (!step) return
    const images = [...step.images]
    images[idx] = { ...images[idx], saved: true }
    updateStep(stepId, { images })
    try {
      const saves = JSON.parse(localStorage.getItem('via_image_saves') || '{}')
      saves[images[idx].url] = { savedAt: Date.now(), prompt: images[idx].prompt }
      localStorage.setItem('via_image_saves', JSON.stringify(saves))
    } catch (e) {}
  }

  const deleteImage = (stepId, idx) => {
    if (!confirm('Delete this image from the step?')) return
    const step = plan.find(s => s.id === stepId)
    if (!step) return
    const images = step.images.filter((_, i) => i !== idx)
    updateStep(stepId, { images })
  }

  const editImagePrompt = (stepId, idx) => {
    const step = plan.find(s => s.id === stepId)
    if (!step) return
    const img = step.images[idx]
    const newPrompt = window.prompt('Edit prompt used for this image', img.prompt)
    if (newPrompt !== null) {
      const images = [...step.images]
      images[idx] = { ...images[idx], prompt: newPrompt }
      updateStep(stepId, { images })
    }
  }

  const regenerateImage = async (stepId, idx) => {
    const step = plan.find(s => s.id === stepId)
    if (!step) return
    const img = step.images[idx]
    const res = await fetch(`${apiBase}/api/generate-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: img.prompt, style: styles[selectedStyleIndex] || null }) })
    const j = await res.json()
    if (j.imageUrl) {
      const images = [...step.images]
      images[idx] = { ...images[idx], url: j.imageUrl }
      updateStep(stepId, { images })
    }
  }

  // Gemini chat UI state
  const [geminiMessage, setGeminiMessage] = useState('')
  const geminiModels = [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', free: true },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', free: true },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', free: true },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', free: true },
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', free: true },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', free: true },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', free: false },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', free: true },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', free: true },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', free: false }
  ]
  const [selectedGeminiModel, setSelectedGeminiModel] = useState(geminiModels[0].id)
  const [geminiAudioFile, setGeminiAudioFile] = useState(null)
  const geminiAudioInputRef = useRef(null)
  const [geminiHistory, setGeminiHistory] = useState([])
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [pollinationsPrompt, setPollinationsPrompt] = useState('')
  const [pollinationsImageUrl, setPollinationsImageUrl] = useState('')
  const [pollinationsError, setPollinationsError] = useState('')
  const [pollinationsLoading, setPollinationsLoading] = useState(false)
  const [pollinationsProgress, setPollinationsProgress] = useState(0)

  const getGeminiText = (data) => {
    if (data?.candidates?.[0]?.content?.parts) {
      return data.candidates[0].content.parts.map(part => part.text || '').join('').trim()
    }
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  }

  const sendGeminiMessage = async () => {
    const message = geminiMessage.trim()
    if (!message) return alert('Enter a message to send to Gemini')
    setGeminiMessage('')
    const audioFile = geminiAudioFile?.size > 0 ? geminiAudioFile : null
    setGeminiLoading(true)
    try {
      const context = geminiHistory.flatMap(entry => [
        { role: 'user', parts: [{ text: entry.question }] },
        ...(entry.answer ? [{ role: 'model', parts: [{ text: entry.answer }] }] : [])
      ])
      const request = audioFile
        ? (() => {
          const formData = new FormData()
          if (message) formData.append('message', message)
          formData.append('audio', audioFile)
          formData.append('history', JSON.stringify(context))
          formData.append('sessionId', sessionId)
          formData.append('model', selectedGeminiModel)
          return { headers: { 'X-Session-ID': sessionId }, body: formData }
        })()
        : {
          headers: { 'Content-Type': 'application/json', 'X-Session-ID': sessionId },
          body: JSON.stringify({ message, history: context, sessionId, model: selectedGeminiModel })
        }
      const res = await fetch(`${apiBase}/api/gemini-chat`, { method: 'POST', ...request })
      const text = await res.text()
      try {
        const parsed = JSON.parse(text)
        setGeminiHistory(history => [...history, {
          id: Date.now(),
          question: audioFile ? `${message} (Audio: ${audioFile.name})` : message,
          answer: res.ok ? getGeminiText(parsed) : '',
          error: res.ok ? '' : getGeminiText(parsed)
        }])
      } catch (e) {
        setGeminiHistory(history => [...history, {
          id: Date.now(),
          question: audioFile ? `${message} (Audio: ${audioFile.name})` : message,
          answer: res.ok ? text : '',
          error: res.ok ? '' : text
        }])
      }
    } catch (err) {
      setGeminiHistory(history => [...history, { id: Date.now(), question: audioFile ? `${message} (Audio: ${audioFile.name})` : message, answer: '', error: err.message || String(err) }])
    } finally {
      setGeminiAudioFile(null)
      if (geminiAudioInputRef.current) geminiAudioInputRef.current.value = ''
      setGeminiLoading(false)
    }
  }

  const generatePollinationsImage = async () => {
    if (!pollinationsPrompt.trim()) return alert('Enter an image prompt')
    setPollinationsError('')
    setPollinationsImageUrl('')
    setPollinationsLoading(true)
    setPollinationsProgress(10)
    try {
      const res = await fetch(`${apiBase}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pollinationsPrompt })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Image generation failed')
      setPollinationsImageUrl(data.imageUrl)
      setPollinationsProgress(35)
    } catch (err) {
      setPollinationsError(err.message || String(err))
      setPollinationsLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>ViaToAnima — Story Builder</h1>

      <details className="main-section" open>
        <summary><h2>Header — Global style prompt (saved to session)</h2></summary>
        {isGlobalStylePromptOpen ? (
          <div className="global-style-editor">
            <textarea aria-label="Global style prompt" value={globalStylePromptDraft} onChange={e => setGlobalStylePromptDraft(e.target.value)} rows={4} />
            <button onClick={saveGlobalStyle}>Save</button>
          </div>
        ) : (
          <button className="global-style-preview" onClick={() => {
            setGlobalStylePromptDraft(globalStylePrompt)
            setIsGlobalStylePromptOpen(true)
          }}>
            {globalStylePrompt || 'clicl to edit default image settings'}
          </button>
        )}
      </details>

      <details className="main-section" open>
        <summary><h2>1) Upload audio</h2></summary>
        <input type="file" accept="audio/*" onChange={e => setFile(e.target.files[0])} />
        <label className="gemini-model-picker">
          <span>Gemini version</span>
          <select className={geminiModels.find(model => model.id === selectedGeminiModel)?.free ? 'gemini-select-free' : 'gemini-select-paid'} value={selectedGeminiModel} onChange={e => setSelectedGeminiModel(e.target.value)} disabled={geminiLoading}>
            <optgroup label="Free models">
              {geminiModels.filter(model => model.free).map(model => <option key={model.id} value={model.id}>{model.name} (FREE)</option>)}
            </optgroup>
            <optgroup label="Paid models">
              {geminiModels.filter(model => !model.free).map(model => <option key={model.id} value={model.id}>{model.name} (PAID)</option>)}
            </optgroup>
          </select>
          <strong className={geminiModels.find(model => model.id === selectedGeminiModel)?.free ? 'gemini-free' : 'gemini-paid'}>
            {geminiModels.find(model => model.id === selectedGeminiModel)?.free ? 'FREE' : 'PAID'}
          </strong>
        </label>
        <div className="audio-actions">
          <button onClick={sendAudioToGemini} disabled={geminiLoading}>{geminiLoading ? 'Sending...' : 'Send audio to Gemini'}</button>
        </div>
        <div className="audio-prompt">
          <button className="audio-prompt-preview" onClick={() => setIsGeminiAudioPromptOpen(open => !open)} aria-expanded={isGeminiAudioPromptOpen}>
            {geminiAudioPrompt.trim().split(/\s+/).slice(0, 3).join(' ')}...
          </button>
          {isGeminiAudioPromptOpen && <textarea aria-label="Gemini audio prompt" value={geminiAudioPrompt} onChange={e => setGeminiAudioPrompt(e.target.value)} rows={12} />}
        </div>
      </details>

      <details className="main-section" open>
        <summary><h2>2) Analyze & Plan</h2></summary>
        {geminiPlanTable.length > 0 && (
          <div className="gemini-plan-result">
            <h3>Gemini visual plan</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Таймкод (От - До)</th>
                    <th>Тип момента</th>
                    <th>Описание атмосферы</th>
                    <th>Промпт для генерации (на английском)</th>
                  </tr>
                </thead>
                <tbody>
                  {geminiPlanTable.map((row, index) => (
                    <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button onClick={addStep}>Add Step</button>
        </div>
        <div style={{ marginTop: 12 }}>
          {plan.map((s, i) => (
            <div key={s.id} className="plan-step">
              <div className="step-header" onClick={() => toggleOpen(s.id)}>
                <div>
                  <span className="step-title">{s.title}</span>
                  <div style={{ fontSize: 12, color: '#666' }}>{s.summary}</div>
                </div>
                <div>
                  <button onClick={(e) => { e.stopPropagation(); updateStep(s.id, { title: window.prompt('Edit title', s.title) || s.title }) }}>Edit title</button>
                  <button onClick={(e) => { e.stopPropagation(); deleteStep(s.id) }} style={{ marginLeft: 8 }}>Delete step</button>
                </div>
              </div>
              {s.open && (
                <div className="step-body">
                  <div>
                    <label>Summary:</label>
                    <input value={s.summary} onChange={e => updateStep(s.id, { summary: e.target.value })} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <label>Prompt (editable):</label>
                    <textarea value={s.prompt} onChange={e => updateStep(s.id, { prompt: e.target.value })} rows={3} />
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => generatePromptForStep(s)}>Ask Gemini to generate prompt</button>
                      <button onClick={() => generateImageForStep(s)} style={{ marginLeft: 8 }}>Generate image(s)</button>
                    </div>
                  </div>

                  <div className="image-gallery">
                    {(s.images || []).map((img, idx) => (
                      <div className="thumb" key={idx}>
                        <img src={img.url} alt={`img-${idx}`} />
                        {img.saved && <div className="saved-badge">Saved</div>}
                        <div className="controls">
                          <button className="ctrl-btn" onClick={() => saveImage(s.id, idx)}>Save</button>
                          <button className="ctrl-btn" onClick={() => editImagePrompt(s.id, idx)}>Edit</button>
                          <button className="ctrl-btn" onClick={() => deleteImage(s.id, idx)}>Delete</button>
                          <button className="ctrl-btn" onClick={() => regenerateImage(s.id, idx)}>Regenerate</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="main-section">
        <summary><h2>Styles (profiles)</h2></summary>
        <div>
          <strong>Saved styles:</strong>
          <div>
            {styles.length === 0 && <em>No styles saved.</em>}
            {styles.map((s, i) => (
              <label key={i} style={{ display: 'block', marginTop: 6 }}>
                <input type="radio" name="style" checked={selectedStyleIndex === i} onChange={() => setSelectedStyleIndex(i)} /> {s.name}
                <button style={{ marginLeft: 8 }} onClick={() => deleteStyle(i)}>Delete</button>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <input placeholder="Style name" value={styleName} onChange={e => setStyleName(e.target.value)} />
            <button onClick={saveStyle} style={{ marginLeft: 8 }}>Save style</button>
          </div>
        </div>
      </details>

      <details className="main-section">
        <summary><h2>Chat with Gemini</h2></summary>
        <div className="gemini-chat">
          <div className="gemini-history" aria-live="polite">
            {geminiHistory.length === 0 && <p className="gemini-empty">Your Gemini answers will appear here.</p>}
            {geminiHistory.map(entry => (
              <article className="gemini-entry" key={entry.id}>
                <div className="gemini-question"><strong>You</strong><p>{entry.question}</p></div>
                {entry.answer && <div className="gemini-answer"><strong>Gemini</strong><p>{entry.answer}</p></div>}
                {entry.error && <div className="gemini-error"><strong>Gemini error</strong><p>{entry.error}</p></div>}
              </article>
            ))}
            {geminiLoading && <div className="gemini-answer"><strong>Gemini</strong><p>Thinking...</p></div>}
          </div>
          <div className="gemini-composer">
            <textarea placeholder="Type a message for Gemini..." value={geminiMessage} onChange={e => setGeminiMessage(e.target.value)} rows={4} />
            <label className="gemini-audio-picker">
              <span>{geminiAudioFile ? geminiAudioFile.name : 'Attach audio'}</span>
              <input ref={geminiAudioInputRef} type="file" accept="audio/*" onChange={e => setGeminiAudioFile(e.target.files[0] || null)} />
            </label>
            <button onClick={sendGeminiMessage} disabled={geminiLoading}>{geminiLoading ? 'Sending...' : 'Send to Gemini'}</button>
          </div>
        </div>
      </details>

      <details className="main-section">
        <summary><h2>Generate image with Pollinations</h2></summary>
        <textarea
          placeholder="Describe the image you want to create..."
          value={pollinationsPrompt}
          onChange={e => setPollinationsPrompt(e.target.value)}
          rows={4}
          aria-label="Pollinations image prompt"
        />
        <button onClick={generatePollinationsImage} disabled={pollinationsLoading}>
          {pollinationsLoading ? 'Generating image...' : 'Generate image'}
        </button>
        {pollinationsLoading && (
          <div className="generation-progress" role="status" aria-live="polite">
            <progress value={pollinationsProgress} max="100" />
            <span>{pollinationsProgress}%</span>
          </div>
        )}
        {pollinationsError && <p className="generation-error">{pollinationsError}</p>}
        {pollinationsImageUrl && (
          <div className="generated-image-result">
            <img
              src={pollinationsImageUrl}
              alt={pollinationsPrompt}
              onLoad={() => { setPollinationsProgress(100); setPollinationsLoading(false) }}
              onError={() => { setPollinationsError('Pollinations could not load this image. Try a different prompt.'); setPollinationsLoading(false) }}
            />
            <a href={pollinationsImageUrl} target="_blank" rel="noreferrer">Open full-size image</a>
          </div>
        )}
      </details>

    </div>
  )
}
