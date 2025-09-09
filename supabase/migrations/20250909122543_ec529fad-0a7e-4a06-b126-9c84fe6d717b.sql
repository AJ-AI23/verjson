-- Drop the existing restrictive RLS policy
DROP POLICY IF EXISTS "Workspace owners can manage crowdin settings" ON public.workspace_crowdin_settings;

-- Create new RLS policy that allows users with workspace access (owners and collaborators)
CREATE POLICY "Users with workspace access can manage crowdin settings" 
ON public.workspace_crowdin_settings 
FOR ALL 
USING (user_has_workspace_access(workspace_id, auth.uid()))
WITH CHECK (user_has_workspace_access(workspace_id, auth.uid()));