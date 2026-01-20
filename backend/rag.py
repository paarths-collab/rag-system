import google.generativeai as genai
from db import embed_query, search_chunks
from reranker import rerank, compress_citation
import os
import dotenv

dotenv.load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def answer_query(query):
    """
    RAG pipeline: Embed query -> Vector search -> Deduplicate -> Rerank -> Generate answer
    """
    # Step 1: Embed query with Cohere
    query_embedding = embed_query(query)
    
    # Step 2: Vector search (retrieve more candidates for filtering)
    retrieved = search_chunks(query_embedding, limit=25)

    if not retrieved:
        return "I couldn't find any relevant information in the uploaded documents to answer this question.", []

    # Step 3: Rerank with Cohere (includes deduplication + source grouping)
    reranked = rerank(query, retrieved, top_n=5)

    # Step 4: Build context with citations
    context = ""
    citations = []

    for i, c in enumerate(reranked):
        similarity = c.get("similarity", 0)
        relevance = c.get("relevance_score", similarity)
        
        context += f"[{i+1}] {c['content']}\n\n"
        citations.append({
            "id": i+1,
            "source": c["source"],
            "text": compress_citation(c["content"]),  # Compressed for display
            "similarity": round(similarity, 3),
            "relevance": round(relevance, 3)
        })

    # Step 5: Generate answer with Gemini (improved prompt)
    prompt = f"""You are a helpful assistant that answers questions based ONLY on the provided sources.

RULES:
1. Use ONLY the information from the sources below to answer.
2. Every claim must have a citation like [1], [2], etc.
3. Use each source at most once - do not repeat the same idea.
4. If sources contain redundant information, summarize once with a single citation.
5. If the sources don't contain enough information, say so explicitly.
6. Do not make up information or use knowledge outside these sources.
7. Be concise but thorough.

SOURCES:
{context}

QUESTION: {query}

ANSWER:"""

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    return response.text, citations
