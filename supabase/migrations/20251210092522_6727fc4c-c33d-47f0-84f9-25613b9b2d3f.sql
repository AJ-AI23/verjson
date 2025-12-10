-- Drop the existing SELECT policy that may be too permissive
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a more secure SELECT policy that allows:
-- 1. Users to view their own profile
-- 2. Users to view profiles of collaborators (workspace members or document shared users)
CREATE POLICY "Users can view own profile or collaborator profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User's own profile
  auth.uid() = user_id
  OR
  -- Profiles of users in same workspace (via workspace_permissions)
  EXISTS (
    SELECT 1 FROM public.workspace_permissions wp1
    JOIN public.workspace_permissions wp2 ON wp1.workspace_id = wp2.workspace_id
    WHERE wp1.user_id = auth.uid()
      AND wp2.user_id = profiles.user_id
      AND wp1.status = 'accepted'
      AND wp2.status = 'accepted'
  )
  OR
  -- Profiles of users who share a document (via document_permissions)
  EXISTS (
    SELECT 1 FROM public.document_permissions dp1
    JOIN public.document_permissions dp2 ON dp1.document_id = dp2.document_id
    WHERE dp1.user_id = auth.uid()
      AND dp2.user_id = profiles.user_id
      AND dp1.status = 'accepted'
      AND dp2.status = 'accepted'
  )
  OR
  -- Profiles of workspace owners for workspaces user has access to
  EXISTS (
    SELECT 1 FROM public.workspaces w
    JOIN public.workspace_permissions wp ON w.id = wp.workspace_id
    WHERE wp.user_id = auth.uid()
      AND w.user_id = profiles.user_id
      AND wp.status = 'accepted'
  )
  OR
  -- Profiles of document owners for documents user has access to
  EXISTS (
    SELECT 1 FROM public.documents d
    JOIN public.document_permissions dp ON d.id = dp.document_id
    WHERE dp.user_id = auth.uid()
      AND d.user_id = profiles.user_id
      AND dp.status = 'accepted'
  )
);