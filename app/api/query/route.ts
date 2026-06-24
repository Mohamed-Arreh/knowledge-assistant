import { supabase } from '@/lib/supabase'
import { embedQuery } from '@/lib/voyage'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

type MatchedChunk = {
  id: number
  content: string
  source: string
  similarity: number
}

const SYSTEM_PROMPT =
  'You are an assistant for an internal knowledge base. ' +
  'Answer the question using only the context provided. ' +
  'If the answer is not in the context, say "I don\'t have information about that in the provided documents." ' +
  'Do not draw on outside knowledge.'

export async function POST(request: Request) {
  const body = await request.json()
  const question: string = body.question ?? ''

  if (!question.trim()) {
    return Response.json({ error: 'No question provided' }, { status: 400 })
  }

  // 1. Embed the question as a query vector
  const queryEmbedding = await embedQuery(question)

  // 2. Find the closest chunks via pgvector cosine search
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: 5,
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const chunks = data as MatchedChunk[]

  if (chunks.length === 0) {
    return Response.json({
      answer: "No documents have been uploaded yet. Please ingest some documents first.",
      sources: [],
    })
  }

  // 3. Build the context block Claude will read
  const context = chunks
    .map((c) => `[Source: ${c.source}]\n${c.content}`)
    .join('\n\n---\n\n')

  // 4. Generate the grounded answer
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Context:\n\n${context}\n\n---\n\nQuestion: ${question}`,
      },
    ],
  })

  const answerBlock = message.content[0]
  const answer = answerBlock.type === 'text' ? answerBlock.text : ''

  return Response.json({ answer, sources: chunks })
}
