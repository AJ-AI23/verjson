-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view own profile or collaborator profiles" ON public.profiles;

-- Create a new SELECT policy with explicit authentication check first
CREATE POLICY "Users can view own profile or collaborator profiles"
ON public.profiles
FOR SELECT
USING (
  -- First, require authentication - deny all unauthenticated access
  auth.uid() IS NOT NULL
  AND (
    -- User can view their own profile
    auth.uid() = user_id
    -- Or view profiles of users in shared workspaces
    OR EXISTS (
      SELECT 1
      FROM workspace_permissions wp1
      JOIN workspace_permissions wp2 ON wp1.workspace_id = wp2.workspace_id
      WHERE wp1.user_id = auth.uid()
        AND wp2.user_id = profiles.user_id
        AND wp1.status = 'accepted'
        AND wp2.status = 'accepted'
    )
    -- Or view profiles of users with shared document permissions
    OR EXISTS (
      SELECT 1
      FROM document_permissions dp1
      JOIN document_permissions dp2 ON dp1.document_id = dp2.document_id
      WHERE dp1.user_id = auth.uid()
        AND dp2.user_id = profiles.user_id
        AND dp1.status = 'accepted'
        AND dp2.status = 'accepted'
    )
    -- Or view workspace owner profiles when user has workspace access
    OR EXISTS (
      SELECT 1
      FROM workspaces w
      JOIN workspace_permissions wp ON w.id = wp.workspace_id
      WHERE wp.user_id = auth.uid()
        AND w.user_id = profiles.user_id
        AND wp.status = 'accepted'
    )
    -- Or view document owner profiles when user has document access
    OR EXISTS (
      SELECT 1
      FROM documents d
      JOIN document_permissions dp ON d.id = dp.document_id
      WHERE dp.user_id = auth.uid()
        AND d.user_id = profiles.user_id
        AND dp.status = 'accepted'
    )
  )
);