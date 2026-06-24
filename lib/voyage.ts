const VOYAGE_MODEL = 'voyage-3-large'
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'

// Voyage caps requests at 120,000 tokens; stay well under that since our
// token count is an estimate, not an exact tokenizer count.
const MAX_TOKENS_PER_BATCH = 100_000
const BATCH_DELAY_MS = 200

type VoyageInputType = 'document' | 'query'

interface VoyageResponseItem {
  embedding: number[]
  index: number
}

// No tokenizer dependency in this project; ~4 chars/token is a standard
// rough estimate for English text and leaves enough margin below the cap.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function batchByTokenLimit(texts: string[], maxTokens: number): string[][] {
  const batches: string[][] = []
  let current: string[] = []
  let currentTokens = 0

  for (const text of texts) {
    const tokens = estimateTokens(text)
    if (current.length > 0 && currentTokens + tokens > maxTokens) {
      batches.push(current)
      current = []
      currentTokens = 0
    }
    current.push(text)
    currentTokens += tokens
  }
  if (current.length > 0) batches.push(current)
  return batches
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function embed(texts: string[], inputType: VoyageInputType): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Voyage API ${res.status}: ${body}`)
  }

  const data = await res.json()
  const items: VoyageResponseItem[] = data.data
  items.sort((a, b) => a.index - b.index)
  return items.map((item) => item.embedding)
}

async function embedInBatches(texts: string[], inputType: VoyageInputType): Promise<number[][]> {
  const batches = batchByTokenLimit(texts, MAX_TOKENS_PER_BATCH)
  const results: number[][] = []

  for (let i = 0; i < batches.length; i++) {
    try {
      const batchEmbeddings = await embed(batches[i], inputType)
      results.push(...batchEmbeddings)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(
        `Voyage embedding failed on batch ${i + 1}/${batches.length} (${batches[i].length} chunks): ${message}`
      )
    }

    if (i < batches.length - 1) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  return results
}

export const embedDocuments = (texts: string[]) => embedInBatches(texts, 'document')
export const embedQuery = (text: string) => embed([text], 'query').then((vecs) => vecs[0])
