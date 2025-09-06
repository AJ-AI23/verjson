-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view workspaces with permissions" ON public.workspaces;

-- Create a security definer function to check workspace permissions without recursion
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(workspace_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_permissions wp
    WHERE wp.workspace_id = $1
    AND wp.user_id = $2
    AND wp.status = 'accepted'
  );
$$;

-- Create a new policy using the security definer function
CREATE POLICY "Users can view workspaces with permissions" 
ON public.workspaces 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  public.user_has_workspace_access(id, auth.uid())
);