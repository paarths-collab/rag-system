import cohere
from supabase import create_client
import os
import dotenv
import hashlib

dotenv.load_dotenv()

# Initialize Cohere client for embeddings
co = cohere.Client(os.getenv("COHERE_API_KEY"))

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Supabase URL and Key must be set in .env file")

supabase = create_client(supabase_url, supabase_key)

def embed_text(text):
    """Generate embedding for text using Cohere (1024 dimensions)."""
    response = co.embed(
        texts=[text],
        model="embed-english-v3.0",
        input_type="search_document"
    )
    return response.embeddings[0]

def embed_query(text):
    """Generate embedding for query using Cohere."""
    response = co.embed(
        texts=[text],
        model="embed-english-v3.0",
        input_type="search_query"
    )
    return response.embeddings[0]

def hash_content(content: str) -> str:
    """Generate SHA-256 hash of content for deduplication."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def is_duplicate(content_hash: str) -> bool:
    """Check if a document with this hash already exists."""
    result = supabase.table("ingested_documents").select("id").eq("content_hash", content_hash).execute()
    return len(result.data) > 0

def register_document(content_hash: str, source_name: str, chunk_count: int):
    """Register a document after successful ingestion."""
    supabase.table("ingested_documents").insert({
        "content_hash": content_hash,
        "source_name": source_name,
        "chunk_count": chunk_count
    }).execute()

def store_chunk(text, source, chunk_index=0):
    """Store a text chunk with its embedding and metadata."""
    embedding = embed_text(text)
    supabase.table("documents").insert({
        "content": text,
        "embedding": embedding,
        "source": source,
        "chunk_index": chunk_index
    }).execute()

def search_chunks(query_embedding, limit=20):
    """
    Search for similar chunks using vector similarity.
    Returns more results (20) for reranking to filter down.
    """
    return supabase.rpc(
        "match_documents",
        {
            "query_embedding": query_embedding,
            "match_threshold": 0.3,
            "match_count": limit
        }
    ).execute().data
