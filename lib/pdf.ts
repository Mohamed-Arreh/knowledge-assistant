import { PDFParse } from 'pdf-parse'

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText({ pageJoiner: '\n\n' })
    return result.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  } finally {
    await parser.destroy()
  }
}