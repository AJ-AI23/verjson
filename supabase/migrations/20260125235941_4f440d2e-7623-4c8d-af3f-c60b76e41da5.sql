-- Drop the existing SELECT policy that exposes emails to collaborators
DROP POLICY IF EXISTS "Users can view own profile or collaborator profiles" ON public.profiles;

-- Create a new policy that still allows viewing collaborator profiles
-- but email column access will be controlled via a view
CREATE POLICY "Users can view own profile or collaborator profiles"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = user_id) 
  OR (EXISTS ( 
    SELECT 1
    FROM (workspace_permissions wp1
      JOIN workspace_permissions wp2 ON ((wp1.workspace_id = wp2.workspace_id)))
    WHERE ((wp1.user_id = auth.uid()) AND (wp2.user_id = profiles.user_id) AND (wp1.status = 'accepted'::text) AND (wp2.status = 'accepted'::text))
  )) 
  OR (EXISTS ( 
    SELECT 1
    FROM (document_permissions dp1
      JOIN document_permissions dp2 ON ((dp1.document_id = dp2.document_id)))
    WHERE ((dp1.user_id = auth.uid()) AND (dp2.user_id = profiles.user_id) AND (dp1.status = 'accepted'::text) AND (dp2.status = 'accepted'::text))
  )) 
  OR (EXISTS ( 
    SELECT 1
    FROM (workspaces w
      JOIN workspace_permissions wp ON ((w.id = wp.workspace_id)))
    WHERE ((wp.user_id = auth.uid()) AND (w.user_id = profiles.user_id) AND (wp.status = 'accepted'::text))
  )) 
  OR (EXISTS ( 
    SELECT 1
    FROM (documents d
      JOIN document_permissions dp ON ((d.id = dp.document_id)))
    WHERE ((dp.user_id = auth.uid()) AND (d.user_id = profiles.user_id) AND (dp.status = 'accepted'::text))
  ))
);

-- Create a secure view that masks email for non-owners
CREATE OR REPLACE VIEW public.profiles_secure
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
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

-- Grant access to the view
GRANT SELECT ON public.profiles_secure TO authenticated;
GRANT SELECT ON public.profiles_secure TO anon;