-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Users with workspace access can manage crowdin settings" ON public.workspace_crowdin_settings;

-- Create new restrictive policies - only workspace owners can access
CREATE POLICY "Workspace owners can view crowdin settings"
ON public.workspace_crowdin_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_crowdin_settings.workspace_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can insert crowdin settings"
ON public.workspace_crowdin_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_crowdin_settings.workspace_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can update crowdin settings"
ON public.workspace_crowdin_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_crowdin_settings.workspace_id
    AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Workspace owners can delete crowdin settings"
ON public.workspace_crowdin_settings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = workspace_crowdin_settings.workspace_id
    AND w.user_id = auth.uid()
  )
);