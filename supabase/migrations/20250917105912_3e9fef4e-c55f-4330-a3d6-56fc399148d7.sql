-- Fix RLS policy on document_versions to include document_permissions check
DROP POLICY IF EXISTS "Users can view their document versions" ON document_versions;

CREATE POLICY "Users can view document versions with proper access" 
ON document_versions 
FOR SELECT 
USING (
  (auth.uid() = user_id) OR 
  (EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = document_versions.document_id 
    AND (
      -- Document owner
      d.user_id = auth.uid() OR 
      -- Workspace permissions
      EXISTS (
        SELECT 1 FROM workspace_permissions wp
        WHERE wp.workspace_id = d.workspace_id 
        AND wp.user_id = auth.uid() 
        AND wp.status = 'accepted'
      ) OR
      -- Document permissions (direct sharing)
      EXISTS (
        SELECT 1 FROM document_permissions dp
        WHERE dp.document_id = d.id 
        AND dp.user_id = auth.uid() 
        AND dp.status = 'accepted'
      )
    )
  ))
);