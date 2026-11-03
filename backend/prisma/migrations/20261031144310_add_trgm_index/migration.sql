CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX candidates_search_text_trgm_idx
  ON candidates USING GIN ("searchText" gin_trgm_ops);