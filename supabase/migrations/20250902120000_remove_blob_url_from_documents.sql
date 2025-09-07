
-- Migration to remove the blob_url column from the documents table

ALTER TABLE documents
DROP COLUMN blob_url;
