-- Add authentication fields to documents table for URL imports
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS import_auth_method TEXT CHECK (import_auth_method IN ('basic', 'bearer')),
ADD COLUMN IF NOT EXISTS import_auth_credentials TEXT; -- Will store encrypted credentials

-- Add comment explaining the field
COMMENT ON COLUMN documents.import_auth_method IS 'Authentication method for import_url: basic or bearer';
COMMENT ON COLUMN documents.import_auth_credentials IS 'Encrypted authentication credentials for import_url';