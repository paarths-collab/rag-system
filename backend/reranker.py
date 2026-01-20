import cohere
import os
import numpy as np

co = cohere.Client(os.getenv("COHERE_API_KEY"))

def deduplicate_chunks(chunks, threshold=0.85):
    """
    Remove near-duplicate chunks based on embedding similarity.
    Keeps semantically diverse results.
    """
    if not chunks:
        return []
    
    unique = [chunks[0]]
    
    for chunk in chunks[1:]:
        is_duplicate = False
        for u in unique:
            # Simple text overlap check (fast)
            overlap = len(set(chunk["content"].split()) & set(u["content"].split()))
            total = len(set(chunk["content"].split()) | set(u["content"].split()))
            if total > 0 and overlap / total > threshold:
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique.append(chunk)
    
    return unique

def group_by_source(chunks, max_per_source=2):
    """
    Limit chunks per source to ensure diversity.
    Keeps at most max_per_source chunks from each source file.
    """
    source_counts = {}
    filtered = []
    
    for chunk in chunks:
        source = chunk.get("source", "unknown")
        count = source_counts.get(source, 0)
        
        if count < max_per_source:
            filtered.append(chunk)
            source_counts[source] = count + 1
    
    return filtered

def rerank(query: str, documents: list, top_n: int = 5) -> list:
    """
    Rerank documents using Cohere's rerank model with deduplication.
    
    Pipeline:
    1. Deduplicate similar chunks
    2. Group by source (max 2 per file)
    3. Rerank with Cohere
    4. Return top N diverse results
    """
    if not documents:
        return []
    
    # Step 1: Deduplicate near-identical chunks
    deduped = deduplicate_chunks(documents, threshold=0.7)
    
    # Step 2: Group by source to ensure diversity
    grouped = group_by_source(deduped, max_per_source=3)
    
    # If we have very few chunks left, use what we have
    if len(grouped) < 2:
        grouped = deduped[:10]
    
    texts = [d["content"] for d in grouped]
    
    try:
        results = co.rerank(
            model="rerank-english-v3.0",
            query=query,
            documents=texts,
            top_n=min(top_n, len(grouped))
        )
        
        # Return documents in reranked order with relevance scores
        reranked = []
        for r in results.results:
            doc = grouped[r.index].copy()
            doc["relevance_score"] = r.relevance_score
            reranked.append(doc)
        
        return reranked
    except Exception as e:
        print(f"Reranking failed: {e}, falling back to original order")
        return grouped[:top_n]

def compress_citation(text, max_chars=350):
    """Compress citation text for display (not embeddings)."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(' ', 1)[0] + "..."
