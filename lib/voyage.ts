const VOYAGE_MODEL = 'voyage-3-large'
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'

type VoyageInputType = 'document' | 'query'

interface VoyageResponseItem {
  embedding: number[]
  index: number
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

export const embedDocuments = (texts: string[]) => embed(texts, 'document')
export const embedQuery = (text: string) => embed([text], 'query').then((vecs) => vecs[0])
