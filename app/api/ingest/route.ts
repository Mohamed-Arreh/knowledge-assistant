import { supabase } from '@/lib/supabase'
import { chunkText } from '@/lib/chunker'
import { embedDocuments } from '@/lib/voyage'
import { extractPdfText } from '@/lib/pdf'

export async function POST(request: Request) {
  let content: string
  let source: string

  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }
    const isPdf =
      file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
    if (isPdf) {
      const buffer = await file.arrayBuffer()
      content = await extractPdfText(new Uint8Array(buffer))
    } else {
      content = await file.text()
    }
    source = (formData.get('source') as string) || file.name
  } else {
    const body = await request.json()
    content = body.content ?? ''
    source = body.source ?? 'pasted text'
  }

  if (!content.trim()) {
    return Response.json({ error: 'No content provided' }, { status: 400 })
  }

  const chunks = chunkText(content)
  const embeddings = await embedDocuments(chunks)

  const rows = chunks.map((chunk, i) => ({
    content: chunk,
    embedding: embeddings[i],
    source,
  }))

  const { error } = await supabase.from('documents').insert(rows)
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ chunks: chunks.length, source })
}
