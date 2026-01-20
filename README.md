# 🧠 Mini-RAG System

A minimal, production-ready Retrieval-Augmented Generation system built with **Gemini**, **Supabase pgvector**, and **Cohere Reranking**.

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│   FastAPI       │────▶│   Supabase      │
│   (HTML/JS)     │     │   Backend       │     │   (pgvector)    │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
              │  Gemini   │ │ Gemini  │ │  Cohere   │
              │ Embedding │ │   LLM   │ │ Reranker  │
              └───────────┘ └─────────┘ └───────────┘
```

## ✨ Features

| Feature | Implementation |
|---------|---------------|
| **Chunking** | Token-based with overlap (800 tokens, 120 overlap) |
| **Embeddings** | Cohere `embed-english-v3.0` (1024 dimensions) |
| **Vector Store** | Supabase pgvector with cosine similarity |
| **Reranking** | Cohere `rerank-english-v3.0` |
| **LLM** | Gemini 2.5 Flash (`gemini-2.5-flash-preview-05-20`) |
| **Citations** | Inline [1], [2] format with source tracking |
| **File Support** | PDF and TXT upload |

## 🚀 Quick Start

### 1. Clone & Install

```bash
cd mini-rag/backend
pip install -r requirements.txt
```

### 2. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `schema.sql`
3. Get your URL and API key from **Settings → API**

### 3. Configure Environment

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
COHERE_API_KEY=your_cohere_key
```

### 4. Run

```bash
cd backend
uvicorn main:app --reload
```

Open `frontend/index.html` in your browser.

## 📁 Project Structure

```
mini-rag/
├── backend/
│   ├── main.py          # FastAPI endpoints
│   ├── db.py            # Supabase + embeddings
│   ├── rag.py           # RAG pipeline with reranking
│   ├── reranker.py      # Cohere reranking
│   ├── chunking.py      # Token-based text splitting
│   ├── pdf_utils.py     # PDF text extraction
│   ├── schema.sql       # Database setup
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── index.html       # UI
    └── script.js        # API calls
```

## 🔄 RAG Pipeline

1. **Ingest**: Text/PDF → Chunk → Embed → Store in Supabase
2. **Query**:
   - Embed query with Cohere
   - Vector search (retrieve top 20 candidates)
   - **Rerank** with Cohere (narrow to top 5)
   - Generate answer with Gemini + citations

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/ingest` | Ingest text with source |
| `POST` | `/ingest-file` | Upload PDF/TXT file |
| `POST` | `/query` | Ask a question |

## ⚖️ Design Tradeoffs

| Choice | Reasoning |
|--------|-----------|
| **No streaming** | Simpler implementation; Gemini Flash is fast enough |
| **No authentication** | Out of scope for assessment; add JWT/API keys for prod |
| **No hybrid search** | Pure vector search + reranking provides good results |
| **Gemini over GPT** | Free tier, good quality, integrated embeddings |
| **Cohere reranker** | Industry-standard, free tier available |
| **Supabase over Pinecone** | SQL + vector in one, free tier, easier setup |

## 🔐 Security Notes

- `.env` is gitignored — never commit secrets
- Use `service_role` key on backend only
- CORS is open (`*`) for dev — restrict in production
- No input sanitization — add for production

## 🚀 Deployment

### Backend (Render)

1. Push to GitHub
2. Create new Web Service on Render
3. Set environment variables
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend (Netlify/Vercel)

1. Update `API` URL in `script.js` to your Render URL
2. Deploy `frontend/` folder

## 📈 Future Improvements

- [ ] Streaming responses
- [ ] MMR (Maximal Marginal Relevance) for diversity
- [ ] Conversation memory
- [ ] Multi-document sources
- [ ] Authentication
- [ ] Rate limiting

---

Built for AI Engineer Assessment • Track B
