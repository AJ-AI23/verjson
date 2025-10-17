-- Add import_url column to documents table to store URL for documents imported from URLs
ALTER TABLE documents ADD COLUMN import_url TEXT;