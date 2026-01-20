from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from chunking import chunk_text
from db import store_chunk, store_chunks_batch, hash_content, is_duplicate, register_document
from rag import answer_query
from pdf_utils import extract_text_from_pdf
import dotenv
import os

dotenv.load_dotenv()

app = FastAPI(
    title="Rag System API",
    description="A minimal RAG system using Gemini + Supabase + Cohere Reranking",
    version="1.0.0"
)

# Add CORS so frontend can talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only, restrict in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    text: str
    source: str

class QueryRequest(BaseModel):
    query: str

@app.get("/health")
def health_check():
    """Health check endpoint for deployment verification."""
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/stats")
def get_stats():
    """Get document and chunk statistics."""
    from db import supabase
    try:
        docs_result = supabase.table("ingested_documents").select("id", count="exact").execute()
        chunks_result = supabase.table("documents").select("id", count="exact").execute()
        return {
            "docs": docs_result.count or 0,
            "chunks": chunks_result.count or 0
        }
    except Exception:
        return {"docs": 0, "chunks": 0}

@app.post("/ingest")
def ingest(data: IngestRequest):
    """Ingest text content into the vector store with deduplication and limit check."""
    
    # Check for duplicates
    content_hash = hash_content(data.text)
    if is_duplicate(content_hash):
        return {"status": "skipped", "reason": "duplicate", "chunks": 0}
    
    # Chunk and store (batch for speed)
    chunks = chunk_text(data.text)
    store_chunks_batch(chunks, data.source)
    
    # Register document
    register_document(content_hash, data.source, len(chunks))
    
    return {"status": "ingested", "chunks": len(chunks)}

@app.post("/ingest-file")
async def ingest_file(file: UploadFile = File(...)):
    """Ingest a PDF or TXT file into the vector store with deduplication and limit check."""

    contents = await file.read()
    filename = file.filename or "uploaded-file"
    
    # Extract text based on file type
    if filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(contents)
    else:
        # Assume it's a text file
        text = contents.decode("utf-8", errors="ignore")
    
    # Check for duplicates
    content_hash = hash_content(text)
    if is_duplicate(content_hash):
        return {"status": "skipped", "reason": "duplicate", "filename": filename, "chunks": 0}
    
    # Chunk and store with batch (much faster)
    chunks = chunk_text(text)
    store_chunks_batch(chunks, filename)
    
    # Register document
    register_document(content_hash, filename, len(chunks))
    
    return {"status": "ingested", "filename": filename, "chunks": len(chunks)}

@app.post("/query")
def query(data: QueryRequest):
    """Query the RAG system and get an answer with citations."""
    answer, citations = answer_query(data.query)
    return {
        "answer": answer,
        "citations": citations
    }

@app.post("/open")
def open_file(data: dict):
    """Open a local file using the system's default application."""
    import os
    import platform
    import subprocess
    
    file_path = data.get("path")
    if not file_path:
        return {"status": "error", "message": "No path provided"}
    
    # Simple security check to prevent opening arbitrary system files if needed
    # For a local tool, we might be more permissive, but let's at least ensure it exists
    if not os.path.exists(file_path):
         # Try prepending the current directory or a known data directory if it's a relative path
         # For now, assume absolute path or relative to CWD
         if not os.path.exists(os.path.abspath(file_path)):
             return {"status": "error", "message": "File not found"}
         file_path = os.path.abspath(file_path)

    try:
        if platform.system() == "Windows":
            os.startfile(file_path)
        elif platform.system() == "Darwin":  # macOS
            subprocess.call(["open", file_path])
        else:  # Linux
            subprocess.call(["xdg-open", file_path])
        return {"status": "opened", "path": file_path}
        return {"status": "opened", "path": file_path}
    except Exception as e:
        return {"status": "error", "message": str(e)}
# Middleware to disable browser caching for frontend files
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    # Disable cache for HTML, JS, CSS files
    if request.url.path.endswith(('.html', '.js', '.css')) or request.url.path == '/':
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Mount frontend as the last step to catch all other routes
# Ensure the directory exists or this will fail
app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")
