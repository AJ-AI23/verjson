-- Add RLS policy to allow users to view workspaces they have permissions for
CREATE POLICY "Users can view workspaces with permissions" 
ON public.workspaces 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM workspace_permissions wp 
    WHERE wp.workspace_id = workspaces.id 
    AND wp.user_id = auth.uid()
    AND wp.status = 'accepted'
  )
);