import { extractText, getDocumentProxy } from 'unpdf'

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: true })
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}