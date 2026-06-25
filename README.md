# Internal Knowledge Assistant

I built this to learn RAG, embeddings, and vector search hands-on while pivoting into AI development — every step of the pipeline is implemented directly rather than pulled from a framework, so I can explain exactly how it works.

A retrieval-augmented generation (RAG) app: upload documents, ask questions in plain English, and get answers grounded **only** in those documents — with the exact source passages shown alongside each answer.

Built as an "ask your company's docs anything" internal knowledge base.

**Live demo:** [knowledge-assistant-mu.vercel.app](https://knowledge-assistant-mu.vercel.app)

---

## What it does

Paste text or upload a document, and the app breaks it into passages, converts each into a vector embedding, and stores it. When you ask a question, it embeds the question, finds the most semantically similar passages, and asks Claude to answer using only those passages. Every answer shows the source chunks it drew from, with similarity scores — so you can see exactly what grounded the response, and the model says "I don't know" rather than inventing an answer when the documents don't cover it.

Because retrieval matches on **meaning rather than keywords**, a question about "vacation days" will surface a passage about "paid time off" even with no shared words.

---

## Stack

| Layer | Tool |
|---|---|
| App framework | Next.js (App Router), TypeScript |
| Embeddings | Voyage AI (`voyage-3-large`, 1024-dim) |
| Vector store | pgvector on Supabase (PostgreSQL) |
| Answer generation | Claude API |
| Hosting | Vercel |

Voyage is Anthropic's recommended embedding provider, so the pairing is *Claude for generation + Voyage for embeddings + pgvector for retrieval* — a clean, production-shaped RAG stack.

---

## How the RAG pipeline works

**Ingestion (when a document is added):**
1. **Extract** the text (supports pasted text and PDF upload).
2. **Chunk** it into overlapping passages so context isn't cut mid-thought.
3. **Embed** each chunk via Voyage (`input_type: "document"`).
4. **Store** each chunk's text and vector in a pgvector table.

**Query (when a question is asked):**
5. **Embed** the question (`input_type: "query"`), run a cosine-similarity search in pgvector for the nearest chunks, then send the question plus those chunks to Claude with an instruction to answer only from the provided context. Return the grounded answer and the source chunks used.

---

## Notable engineering details

- **Asymmetric embeddings** — documents and queries are embedded with different `input_type` values (`document` vs `query`), which Voyage uses to optimize retrieval relevance.
- **Batched ingestion** — large documents are split into token-bounded batches before embedding, staying under the embedding API's per-request token cap so multi-hundred-page PDFs ingest without errors.
- **Text sanitization** — extracted PDF text is stripped of null bytes and control characters that PostgreSQL rejects, so messy real-world PDFs ingest cleanly.
- **Serverless-safe PDF parsing** — uses `unpdf`, a PDF text-extraction library built for serverless environments, so PDF ingestion works reliably on the deployed Vercel function (a previous library failed to bundle into the serverless runtime).

---

## Running locally

```bash
git clone https://github.com/Mohamed-Arreh/knowledge-assistant.git
cd knowledge-assistant
npm install
```

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
VOYAGE_API_KEY=your_voyage_key
```

Set up the database by running the pgvector schema in your Supabase SQL editor (enable the `vector` extension, create the `documents` table with a `vector(1024)` embedding column, and add the `match_documents` cosine-similarity function).

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## License

MIT