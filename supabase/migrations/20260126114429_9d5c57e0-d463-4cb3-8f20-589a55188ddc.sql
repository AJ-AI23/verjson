-- Ensure RLS is enabled on workspace_crowdin_settings table
ALTER TABLE public.workspace_crowdin_settings ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner as well (prevents bypassing RLS)
ALTER TABLE public.workspace_crowdin_settings FORCE ROW LEVEL SECURITY;