# Internal Knowledge Assistant — Build Spec (Project #2)

A RAG app: upload documents, ask questions in plain English, get answers grounded **only** in those documents. Framed as an **internal knowledge base assistant** ("ask your company's docs anything"). This is your second portfolio project and your hands-on proof of RAG / embeddings / vector search.

**Scope rule:** v1 is deliberately tiny — one clean flow, deployed, demoable. No auth, no multi-user, no fancy UI. **Target: 2–4 days.** Resist adding features until it's live.

---

## The stack

| Piece | Tool | Why |
|---|---|---|
| App | Next.js (App Router), TypeScript | Same as project #1 — nothing new |
| Embeddings | **Voyage AI** (`voyage-3-large` or `voyage-3`) | Anthropic's recommended embedding provider; Claude has none of its own |
| Vector store | **pgvector** on Supabase | The one new piece — a Postgres extension for storing/searching vectors |
| Generation | **Claude API** | Writes the grounded answer |
| Hosting | Vercel | Same as before |

You'll need a **Voyage API key** (sign up at voyageai.com) alongside your existing Anthropic key.

---

## The RAG flow (what you're building, in 5 steps)

**Ingestion (when a doc is uploaded):**
1. **Extract** the text from the uploaded file (start with `.txt` / `.md` to keep it simple; add PDF parsing later).
2. **Chunk** it into ~500–800 token passages with a little overlap (~50–100 tokens) so context isn't cut mid-thought.
3. **Embed** each chunk via the Voyage API (`input_type: "document"`) → you get a vector per chunk.
4. **Store** each chunk's text + its vector in a pgvector table.

**Query (when a user asks a question):**
5. **Embed the question** via Voyage (`input_type: "query"`), **search** pgvector for the nearest chunk vectors (cosine similarity), take the top ~4–6, then send **question + those chunks** to Claude with an instruction like *"Answer using only the context below; if it's not there, say you don't know."* Return Claude's answer, optionally showing which chunks it used.

That's the whole thing. Steps 3 and 5 are the embedding calls; step 5's search is the "vector search" everyone wants on a resume.

---

## pgvector setup (the new part)

In your Supabase project's SQL editor:

```sql
-- 1. Enable the extension
create extension if not exists vector;

-- 2. Table for document chunks + their embeddings
-- 1536 = dimension count; match it to your embedding model
-- (voyage-3-large = 1024). Set this to your model's dimension.
create table documents (
  id bigserial primary key,
  content text,                       -- the chunk text
  embedding vector(1024),             -- the chunk's vector (match model dims!)
  source text,                        -- which file it came from
  created_at timestamptz default now()
);

-- 3. A SQL function to find the most similar chunks to a query vector
create or replace function match_documents (
  query_embedding vector(1024),
  match_count int default 5
)
returns table (id bigint, content text, source text, similarity float)
language sql stable
as $$
  select
    documents.id,
    documents.content,
    documents.source,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
```

`<=>` is pgvector's cosine-distance operator. The function returns the closest chunks to whatever query vector you pass in. You call it from your app via Supabase's `rpc('match_documents', {...})`.

> Match `vector(N)` to your embedding model's dimensions: voyage-3-large = **1024**. If you switch models, the number changes.

---

## Build order (so it stays a few days, not weeks)

1. **Scaffold** a fresh Next.js + TypeScript app; add your Supabase client (reuse your setup from project #1).
2. **pgvector setup** — run the SQL above in Supabase. Confirm the `documents` table and `match_documents` function exist.
3. **Ingestion endpoint** — an API route that takes pasted text (simplest) or an uploaded `.txt`, chunks it, embeds each chunk via Voyage, and inserts rows into `documents`. Test by ingesting one document and checking rows appear.
4. **Query endpoint** — an API route that takes a question, embeds it (Voyage, `input_type: "query"`), calls `match_documents` to get top chunks, sends question + chunks to Claude, returns the answer.
5. **Minimal UI** — one page: a box to paste/upload a doc, a box to ask a question, an area that shows the answer (and optionally the source chunks it used). Plain and clean.
6. **Seed it for the demo** — ingest a few "company handbook / policies"-style sample docs so it reads as a real internal knowledge assistant, not an empty toy.
7. **Deploy to Vercel**, add env vars (`VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, Supabase keys), confirm it works live.

---

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=...
VOYAGE_API_KEY=...
```

---

## v2 ideas (ONLY after v1 is deployed — do not build these now)

- PDF parsing (so users upload real PDFs, not just text)
- Source citations shown inline with each answer
- Multi-document / "collections"
- Auth + multi-tenant (reuse the RLS pattern from project #1 — nice story: "same multi-tenant approach as my other project")

---

## What this gets you

- A second deployed, demoable project → a real portfolio, not a one-off.
- Honest command of **RAG, embeddings, vector search, pgvector** — you built each step, so you can explain it cold in an interview.
- A recognizable business use case (internal knowledge assistant) that companies actively pay to build.
- A clean stack story: *Claude for generation + Voyage for embeddings (Anthropic's recommended pairing) + pgvector for retrieval.*
