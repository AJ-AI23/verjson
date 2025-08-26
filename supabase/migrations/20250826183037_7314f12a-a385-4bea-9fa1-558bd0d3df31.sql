-- Fix infinite recursion in workspace_permissions policies

-- Drop the problematic workspace_permissions policy
DROP POLICY IF EXISTS "Users can view permissions for their workspaces" ON public.workspace_permissions;

-- Create a simplified policy that doesn't cause circular references
CREATE POLICY "Users can view workspace permissions" 
ON public.workspace_permissions 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.id = workspace_permissions.workspace_id 
    AND w.user_id = auth.uid()
  )
);