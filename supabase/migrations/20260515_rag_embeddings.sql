CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
  id         BIGSERIAL PRIMARY KEY,
  summary_id BIGINT NOT NULL REFERENCES event_summaries(id) ON DELETE CASCADE,
  group_id   BIGINT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  chunk_type TEXT NOT NULL,
  embedding  vector(3072),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON document_chunks (group_id);

CREATE OR REPLACE FUNCTION match_documents(
  p_group_id    BIGINT,
  p_embedding   vector(3072),
  p_match_count INT DEFAULT 5
)
RETURNS TABLE (
  id         BIGINT,
  content    TEXT,
  chunk_type TEXT,
  metadata   JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE AS $$
  SELECT id, content, chunk_type, metadata,
         1 - (embedding <=> p_embedding) AS similarity
  FROM document_chunks
  WHERE group_id = p_group_id
    AND embedding IS NOT NULL
  ORDER BY embedding <=> p_embedding
  LIMIT p_match_count;
$$;
