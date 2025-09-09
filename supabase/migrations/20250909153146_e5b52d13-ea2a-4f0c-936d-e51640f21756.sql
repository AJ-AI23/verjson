-- Add status and import_source columns to document_versions table
ALTER TABLE document_versions 
ADD COLUMN status TEXT DEFAULT 'visible' CHECK (status IN ('pending', 'visible')),
ADD COLUMN import_source TEXT DEFAULT 'manual';

-- Create index for efficient pending version queries
CREATE INDEX idx_document_versions_status ON document_versions(document_id, status) WHERE status = 'pending';

-- Update RLS policies to allow users to view their pending versions
DROP POLICY IF EXISTS "Users can view their document versions" ON document_versions;
CREATE POLICY "Users can view their document versions" ON document_versions
FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = document_versions.document_id 
    AND (
      d.user_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM workspace_permissions wp 
        WHERE wp.workspace_id = d.workspace_id 
        AND wp.user_id = auth.uid() 
        AND wp.status = 'accepted'
      )
    )
  )
);