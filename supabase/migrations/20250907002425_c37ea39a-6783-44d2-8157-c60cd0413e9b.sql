-- Phase 1: Clean up notifications table and add workspace_id
-- Add workspace_id column to notifications for workspace-related notifications
ALTER TABLE public.notifications 
ADD COLUMN workspace_id uuid;

-- Remove invitation-specific fields from notifications table
ALTER TABLE public.notifications 
DROP COLUMN IF EXISTS invitation_type,
DROP COLUMN IF EXISTS invitation_data,
DROP COLUMN IF EXISTS status;

-- Phase 3: Ensure both tables are in realtime publication
-- Add notifications table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Add workspace_permissions table to realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_permissions;

-- Set replica identity for proper realtime updates
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.workspace_permissions REPLICA IDENTITY FULL;