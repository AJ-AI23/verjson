-- Create workspace_crowdin_settings table
CREATE TABLE public.workspace_crowdin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  encrypted_api_token TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Enable Row Level Security
ALTER TABLE public.workspace_crowdin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for workspace_crowdin_settings
CREATE POLICY "Users can view crowdin settings for their workspaces" 
ON public.workspace_crowdin_settings 
FOR SELECT 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w WHERE w.user_id = auth.uid()
    UNION
    SELECT wp.workspace_id FROM workspace_permissions wp WHERE wp.user_id = auth.uid() AND wp.status = 'accepted'
  )
);

CREATE POLICY "Users can create crowdin settings for their workspaces" 
ON public.workspace_crowdin_settings 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT w.id FROM workspaces w WHERE w.user_id = auth.uid()
    UNION
    SELECT wp.workspace_id FROM workspace_permissions wp WHERE wp.user_id = auth.uid() AND wp.status = 'accepted'
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Users can update crowdin settings for their workspaces" 
ON public.workspace_crowdin_settings 
FOR UPDATE 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w WHERE w.user_id = auth.uid()
    UNION
    SELECT wp.workspace_id FROM workspace_permissions wp WHERE wp.user_id = auth.uid() AND wp.status = 'accepted'
  )
);

CREATE POLICY "Users can delete crowdin settings for their workspaces" 
ON public.workspace_crowdin_settings 
FOR DELETE 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w WHERE w.user_id = auth.uid()
    UNION
    SELECT wp.workspace_id FROM workspace_permissions wp WHERE wp.user_id = auth.uid() AND wp.status = 'accepted'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_workspace_crowdin_settings_updated_at
BEFORE UPDATE ON public.workspace_crowdin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();