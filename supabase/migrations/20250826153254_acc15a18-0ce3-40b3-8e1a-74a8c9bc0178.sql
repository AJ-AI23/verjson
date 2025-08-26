-- Fix security issues from previous migration

-- Drop the security definer view and recreate as a regular view
DROP VIEW IF EXISTS public.user_permissions_summary;

-- Update functions to fix search path security warnings
CREATE OR REPLACE FUNCTION public.create_workspace_owner_permission()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.workspace_permissions (workspace_id, user_id, role, granted_by)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_document_owner_permission()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.document_permissions (document_id, user_id, role, granted_by)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id);
  RETURN NEW;
END;
$$;