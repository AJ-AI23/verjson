-- Refactor notifications table: add workspace_id and remove invitation fields
-- Add workspace_id column for workspace-related notifications
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- Remove invitation-specific fields that should not be in notifications
ALTER TABLE public.notifications 
DROP COLUMN IF EXISTS invitation_type;

ALTER TABLE public.notifications 
DROP COLUMN IF EXISTS invitation_data;

ALTER TABLE public.notifications 
DROP COLUMN IF EXISTS status;