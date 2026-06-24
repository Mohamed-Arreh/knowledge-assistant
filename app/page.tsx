'use client'

import { useState, useRef } from 'react'

type MatchedChunk = {
  id: number
  content: string
  source: string
  similarity: number
}

export default function Home() {
  const [pastedText, setPastedText] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [ingestStatus, setIngestStatus] = useState<string | null>(null)
  const [ingesting, setIngesting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [sources, setSources] = useState<MatchedChunk[]>([])
  const [querying, setQuerying] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault()
    setIngesting(true)
    setIngestStatus(null)

    try {
      const file = fileRef.current?.files?.[0]
      let res: Response

      if (file) {
        const form = new FormData()
        form.append('file', file)
        if (sourceName) form.append('source', sourceName)
        res = await fetch('/api/ingest', { method: 'POST', body: form })
      } else {
        if (!pastedText.trim()) {
          setIngestStatus('Paste some text or upload a file first.')
          setIngesting(false)
          return
        }
        res = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: pastedText, source: sourceName || 'pasted text' }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setIngestStatus(`Error: ${data.error}`)
      } else {
        setIngestStatus(`Ingested ${data.chunks} chunks from "${data.source}".`)
        setPastedText('')
        setSourceName('')
        if (fileRef.current) fileRef.current.value = ''
      }
    } catch {
      setIngestStatus('Network error — is the dev server running?')
    } finally {
      setIngesting(false)
    }
  }

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    setQuerying(true)
    setAnswer(null)
    setSources([])
    setQueryError(null)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) {
        setQueryError(data.error)
      } else {
        setAnswer(data.answer)
        setSources(data.sources ?? [])
      }
    } catch {
      setQueryError('Network error — is the dev server running?')
    } finally {
      setQuerying(false)
    }
  }

  return (
    <div className="min-h-full bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">

        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Internal Knowledge Assistant</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload documents, then ask questions grounded in their content.
          </p>
        </header>

        {/* Ingest */}
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-medium text-gray-800">Ingest a document</h2>
          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Paste text</label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={6}
                placeholder="Paste document content here…"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">or upload a file</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.csv,.pdf"
              className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />

            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Source name <span className="text-gray-400">(optional — defaults to filename or "pasted text")</span>
              </label>
              <input
                type="text"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. employee-handbook.txt"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={ingesting}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ingesting ? 'Ingesting…' : 'Ingest'}
              </button>
              {ingestStatus && (
                <p className={`text-sm ${ingestStatus.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {ingestStatus}
                </p>
              )}
            </div>
          </form>
        </section>

        {/* Query */}
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-base font-medium text-gray-800">Ask a question</h2>
          <form onSubmit={handleQuery} className="space-y-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="What would you like to know?"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              type="submit"
              disabled={querying || !question.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {querying ? 'Searching…' : 'Ask'}
            </button>
          </form>
        </section>

        {/* Answer + Sources */}
        {(answer || queryError) && (
          <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            {queryError && (
              <p className="text-sm text-red-600">{queryError}</p>
            )}
            {answer && (
              <>
                <h2 className="text-base font-medium text-gray-800">Answer</h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{answer}</p>
                {sources.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                      {sources.length} source chunk{sources.length !== 1 ? 's' : ''} used
                    </summary>
                    <div className="mt-3 space-y-3">
                      {sources.map((s) => (
                        <div
                          key={s.id}
                          className="border border-gray-100 rounded-md p-3 space-y-1 text-xs text-gray-600"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-700">{s.source}</span>
                            <span className="text-gray-400">{(s.similarity * 100).toFixed(1)}% match</span>
                          </div>
                          <p className="whitespace-pre-wrap line-clamp-4">{s.content}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </section>
        )}

      </div>
    </div>
  )
}
