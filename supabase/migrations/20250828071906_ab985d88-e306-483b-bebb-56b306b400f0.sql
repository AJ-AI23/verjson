-- Create workspace_crowdin_settings table for storing encrypted Crowdin API tokens
CREATE TABLE public.workspace_crowdin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  encrypted_api_token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  
  -- Ensure only one setting per workspace
  CONSTRAINT unique_workspace_crowdin_settings UNIQUE(workspace_id)
);

-- Enable Row Level Security
ALTER TABLE public.workspace_crowdin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for workspace owners only
CREATE POLICY "Workspace owners can manage crowdin settings" 
ON public.workspace_crowdin_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM workspaces w 
  WHERE w.id = workspace_crowdin_settings.workspace_id 
  AND w.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM workspaces w 
  WHERE w.id = workspace_crowdin_settings.workspace_id 
  AND w.user_id = auth.uid()
));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_workspace_crowdin_settings_updated_at
BEFORE UPDATE ON public.workspace_crowdin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();