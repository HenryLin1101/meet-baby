-- 1. summary_id 改為 nullable（支援非會議摘要的 chunk）
ALTER TABLE document_chunks ALTER COLUMN summary_id DROP NOT NULL;

-- 2. 新增 source_type、source_url、drive_file_id 欄位
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'meeting_summary',
  ADD COLUMN IF NOT EXISTS source_url  TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_document_chunks_drive_file_id
  ON document_chunks (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- 3. 追蹤已 index 的 Drive 檔案（用來偵測新增/修改）
CREATE TABLE IF NOT EXISTS drive_indexed_files (
  id                  BIGSERIAL PRIMARY KEY,
  group_id            BIGINT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  drive_file_id       TEXT NOT NULL,
  file_name           TEXT,
  mime_type           TEXT,
  drive_modified_time TIMESTAMPTZ,
  indexed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_indexed_files_group_id
  ON drive_indexed_files (group_id);
