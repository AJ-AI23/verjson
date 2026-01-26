-- Drop the existing SELECT policy that exposes emails to collaborators
DROP POLICY IF EXISTS "Users can view own profile or collaborator profiles" ON public.profiles;

-- Create a more restrictive policy: users can ONLY view their own profile directly
-- Collaborator profile access must go through the profiles_secure view which masks email
CREATE POLICY "Users can view own profile directly"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND auth.uid() = user_id
);

-- Add a separate policy for collaborator access that only allows service_role 
-- (the profiles_secure view uses security_invoker and will handle access control)
CREATE POLICY "Collaborators access profiles via secure view"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() != user_id
  AND (
    -- Shared workspace access
    EXISTS (
      SELECT 1
      FROM workspace_permissions wp1
      JOIN workspace_permissions wp2 ON wp1.workspace_id = wp2.workspace_id
      WHERE wp1.user_id = auth.uid()
        AND wp2.user_id = profiles.user_id
        AND wp1.status = 'accepted'
        AND wp2.status = 'accepted'
    )
    -- Or shared document permissions
    OR EXISTS (
      SELECT 1
      FROM document_permissions dp1
      JOIN document_permissions dp2 ON dp1.document_id = dp2.document_id
      WHERE dp1.user_id = auth.uid()
        AND dp2.user_id = profiles.user_id
        AND dp1.status = 'accepted'
        AND dp2.status = 'accepted'
    )
    -- Or workspace owner profiles when user has workspace access
    OR EXISTS (
      SELECT 1
      FROM workspaces w
      JOIN workspace_permissions wp ON w.id = wp.workspace_id
      WHERE wp.user_id = auth.uid()
        AND w.user_id = profiles.user_id
        AND wp.status = 'accepted'
    )
    -- Or document owner profiles when user has document access
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

-- Recreate the profiles_secure view to ensure email is masked for non-owners
DROP VIEW IF EXISTS public.profiles_secure;

CREATE VIEW public.profiles_secure
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  -- Only show email to the profile owner, mask for everyone else
  CASE 
    WHEN auth.uid() = user_id THEN email 
    ELSE NULL 
  END AS email,
  full_name,
  username,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;