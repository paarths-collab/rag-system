-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Drop existing table if you want to start fresh (optional)
-- drop table if exists documents;

-- Create a table to store your documents
-- Using 1024 dimensions for Cohere embed-english-v3.0
create table documents (
  id uuid primary key default gen_random_uuid(),
  content text,
  embedding vector(1024),
  source text,
  chunk_index int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Create an index for faster similarity search
create index on documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1024),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  source text,
  chunk_index int,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    documents.source,
    documents.chunk_index,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Table to track ingested documents (for deduplication)
create table if not exists ingested_documents (
  id uuid primary key default gen_random_uuid(),
  content_hash text unique not null,
  source_name text,
  chunk_count int,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
