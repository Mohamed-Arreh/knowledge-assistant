export function chunkText(
  text: string,
  chunkSize = 2400,
  overlap = 300
): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= chunkSize) return [trimmed]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    let boundary = end

    if (end < text.length) {
      // Prefer a paragraph break nearest to the target size
      const paraBreak = text.lastIndexOf('\n\n', end)
      if (paraBreak > start + chunkSize / 2) {
        boundary = paraBreak + 2
      } else {
        // Fall back to a sentence break
        const sentBreak = text.lastIndexOf('. ', end)
        if (sentBreak > start + chunkSize / 2) {
          boundary = sentBreak + 2
        }
      }
    }

    const chunk = text.slice(start, boundary).trim()
    if (chunk) chunks.push(chunk)

    // Slide forward, keeping `overlap` chars from the end of this chunk.
    // If nextStart wouldn't advance past start, all remaining text is already
    // captured in this chunk — break rather than loop forever.
    const nextStart = boundary - overlap
    if (nextStart <= start) break
    start = nextStart
  }

  return chunks
}
